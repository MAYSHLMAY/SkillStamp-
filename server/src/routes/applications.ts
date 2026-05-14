import { Router } from 'express';
import { Types } from 'mongoose';
import { Application } from '../models/Application';
import { Job } from '../models/Job';
import { Session } from '../models/Session';
import { requireAuth, requireRole } from '../middleware/auth';
import { scoreAnswer } from '../services/ai';
import { getSocketServer } from '../socket/io';

const router = Router();

router.get('/candidate', requireAuth, requireRole('candidate'), async (req, res) => {
  try {
    const apps = await Application.find({ candidateId: req.auth!.userId })
      .select('jobId answers overallScore status submittedAt')
      .sort({ updatedAt: -1 })
      .lean();
    const jobIds = apps.map((a) => a.jobId);
    const jobs = await Job.find({ _id: { $in: jobIds } })
      .select('title companyName')
      .lean();
    const jobMap = new Map(jobs.map((j) => [String(j._id), j]));
    const activeSessions = await Session.find({
      candidateId: req.auth!.userId,
      status: 'active',
    })
      .select('jobId _id')
      .lean();
    const sessionByJob = new Map(activeSessions.map((s) => [String(s.jobId), String(s._id)]));
    res.json({
      success: true,
      data: apps.map((a) => {
        const j = jobMap.get(String(a.jobId));
        return {
          id: String(a._id),
          jobId: String(a.jobId),
          jobTitle: j?.title ?? 'Job',
          companyName: j?.companyName ?? '',
          answers: a.answers,
          overallScore: a.overallScore,
          status: a.status,
          submittedAt: a.submittedAt,
          activeSessionId: sessionByJob.get(String(a.jobId)) ?? null,
        };
      }),
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load applications' });
  }
});

async function broadcastApplyingCounts(jobId: string): Promise<void> {
  const io = getSocketServer();
  if (!io) return;
  const count = await Application.countDocuments({
    jobId: new Types.ObjectId(jobId),
    status: 'pending',
  });
  io.emit('job:applying_count', { jobId, count });
}

router.post('/:id/answer', requireAuth, requireRole('candidate'), async (req, res) => {
  try {
    const { challengeIndex, text, pasteDetected } = req.body as {
      challengeIndex?: number;
      text?: string;
      pasteDetected?: boolean;
    };
    if (challengeIndex === undefined || !text) {
      res.status(400).json({ success: false, error: 'Missing answer fields' });
      return;
    }
    const application = await Application.findOne({
      _id: req.params.id,
      candidateId: new Types.ObjectId(req.auth!.userId),
    }).lean();
    if (!application) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }
    const job = await Job.findById(application.jobId)
      .select('title challenges')
      .lean();
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }
    const challenge = job.challenges[challengeIndex];
    if (!challenge) {
      res.status(400).json({ success: false, error: 'Invalid challenge' });
      return;
    }

    const score = await scoreAnswer({
      jobTitle: job.title,
      challenge,
      candidateAnswer: text,
    });

    const answers = [...application.answers];
    const idx = answers.findIndex((a) => a.challengeIndex === challengeIndex);
    const entry = {
      challengeIndex,
      text,
      score: {
        accuracy: score.accuracy,
        speed_proxy: score.speed_proxy,
        complexity: score.complexity,
        overall: score.overall,
      },
      feedback: score.feedback,
      pasteDetected: !!pasteDetected,
    };
    if (idx >= 0) answers[idx] = entry;
    else answers.push(entry);

    const scored = answers.filter((a) => a.score?.overall != null);
    const overallScore =
      scored.length > 0
        ? Math.round(
            scored.reduce((s, a) => s + (a.score?.overall ?? 0), 0) / scored.length
          )
        : undefined;

    const allDone = job.challenges.length > 0 && scored.length >= job.challenges.length;
    const update: Record<string, unknown> = {
      answers,
      overallScore,
    };
    if (allDone) {
      update.status = 'pending';
      update.submittedAt = new Date();
    }

    const updated = await Application.findOneAndUpdate(
      { _id: application._id },
      { $set: update },
      { new: true }
    ).lean();

    await broadcastApplyingCounts(String(application.jobId));

    res.json({
      success: true,
      data: {
        score,
        application: {
          id: String(updated!._id),
          answers: updated!.answers,
          overallScore: updated!.overallScore,
          status: updated!.status,
          submittedAt: updated!.submittedAt,
        },
        allDone,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to submit answer' });
  }
});

router.post('/:jobId', requireAuth, requireRole('candidate'), async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      published: true,
    })
      .select('_id')
      .lean();
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }
    const app = await Application.findOneAndUpdate(
      { jobId: job._id, candidateId: new Types.ObjectId(req.auth!.userId) },
      {
        $setOnInsert: {
          jobId: job._id,
          candidateId: new Types.ObjectId(req.auth!.userId),
          answers: [],
          status: 'pending',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    await broadcastApplyingCounts(req.params.jobId);

    res.json({
      success: true,
      data: {
        application: {
          id: String(app!._id),
          jobId: String(app!.jobId),
          status: app!.status,
          answers: app!.answers,
          overallScore: app!.overallScore,
        },
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to apply' });
  }
});

router.patch('/:id/status', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const { status } = req.body as { status?: 'invited' | 'rejected' | 'completed' | 'pending' };
    if (!status || !['invited', 'rejected', 'completed', 'pending'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }
    const application = await Application.findById(req.params.id).lean();
    if (!application) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }
    const job = await Job.findOne({
      _id: application.jobId,
      employerId: new Types.ObjectId(req.auth!.userId),
    })
      .select('_id')
      .lean();
    if (!job) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const updated = await Application.findOneAndUpdate(
      { _id: application._id },
      { $set: { status } },
      { new: true }
    ).lean();

    await broadcastApplyingCounts(String(application.jobId));

    res.json({
      success: true,
      data: {
        application: {
          id: String(updated!._id),
          status: updated!.status,
        },
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

export default router;
