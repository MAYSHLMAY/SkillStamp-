import { Router } from 'express';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { Session } from '../models/Session';
import { Application } from '../models/Application';
import { Job } from '../models/Job';
import { User } from '../models/User';
import { requireAuth, requireRole } from '../middleware/auth';
import { getSocketServer } from '../socket/io';

const router = Router();

router.post('/', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const { applicationId } = req.body as { applicationId?: string };
    if (!applicationId || !Types.ObjectId.isValid(applicationId)) {
      res.status(400).json({ success: false, error: 'Missing applicationId' });
      return;
    }
    const application = await Application.findById(applicationId).lean();
    if (!application) {
      res.status(404).json({ success: false, error: 'Application not found' });
      return;
    }
    const job = await Job.findOne({
      _id: application.jobId,
      employerId: req.auth!.userId,
    })
      .select('title locale challenges')
      .lean();
    if (!job) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const existing = await Session.findOne({
      jobId: job._id,
      candidateId: application.candidateId,
      status: 'active',
    })
      .select('_id')
      .lean();
    if (existing) {
      res.json({ success: true, data: { sessionId: String(existing._id) } });
      return;
    }

    const candidate = await User.findById(application.candidateId).select('name').lean();
    const welcome =
      job.locale === 'am'
        ? `ሰላም ${candidate?.name ?? ''}፣ እንኳን በደህና መጡ። እንደ ${job.title} ሚና የቅድመ ምርመራ ውጤትዎ ${application.overallScore ?? 0}/100 ነው። ከጥቂት ደቂቃዎች በኋላ የመጀመሪያውን ጥያቄ እንወስዳለን።`
        : `Hi ${candidate?.name ?? 'there'}, welcome. Your pre-screen score for ${job.title} is ${application.overallScore ?? 0}/100. I will start with a short question in a moment.`;

    const session = await Session.create({
      jobId: job._id,
      employerId: new Types.ObjectId(req.auth!.userId),
      candidateId: application.candidateId,
      applicationId: application._id,
      messages: [
        {
          sender: 'ai',
          text: welcome,
          timestamp: new Date(),
          label: 'Interviewer',
        },
      ],
      startTime: new Date(),
      trustScore: 100,
      pasteDetected: false,
      anomalyCount: 0,
      status: 'active',
    });

    await Application.findOneAndUpdate(
      { _id: application._id },
      { $set: { status: 'invited' } },
      { new: true }
    );

    res.json({ success: true, data: { sessionId: String(session._id) } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create session' });
  }
});

router.get('/employer', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const sessions = await Session.find({ employerId: req.auth!.userId })
      .select('jobId candidateId messages trustScore pasteDetected status startTime endTime duration hash')
      .sort({ createdAt: -1 })
      .lean();

    const jobIds = [...new Set(sessions.map((s) => String(s.jobId)))];
    const candIds = [...new Set(sessions.map((s) => String(s.candidateId)))];
    const jobs = await Job.find({ _id: { $in: jobIds } })
      .select('title')
      .lean();
    const users = await User.find({ _id: { $in: candIds } })
      .select('name')
      .lean();
    const jobTitle = new Map(jobs.map((j) => [String(j._id), j.title]));
    const candName = new Map(users.map((u) => [String(u._id), u.name]));

    const apps = await Application.find({
      jobId: { $in: jobIds.map((id) => new Types.ObjectId(id)) },
      candidateId: { $in: candIds.map((id) => new Types.ObjectId(id)) },
    })
      .select('jobId candidateId overallScore')
      .lean();
    const scoreKey = (j: string, c: string) => `${j}:${c}`;
    const scoreMap = new Map(apps.map((a) => [scoreKey(String(a.jobId), String(a.candidateId)), a.overallScore ?? 0]));

    res.json({
      success: true,
      data: {
        sessions: sessions.map((s) => ({
          id: String(s._id),
          jobId: String(s.jobId),
          jobTitle: jobTitle.get(String(s.jobId)) ?? 'Job',
          candidateId: String(s.candidateId),
          candidateName: candName.get(String(s.candidateId)) ?? 'Candidate',
          candidateScore: scoreMap.get(scoreKey(String(s.jobId), String(s.candidateId))) ?? 0,
          messages: s.messages,
          trustScore: s.trustScore,
          pasteDetected: s.pasteDetected,
          status: s.status,
          startTime: s.startTime,
          endTime: s.endTime,
          duration: s.duration,
          hash: s.hash,
        })),
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load sessions' });
  }
});

router.get('/candidate', requireAuth, requireRole('candidate'), async (req, res) => {
  try {
    const sessions = await Session.find({ candidateId: req.auth!.userId })
      .select('jobId employerId messages trustScore status startTime endTime duration hash')
      .sort({ createdAt: -1 })
      .lean();

    const jobIds = [...new Set(sessions.map((s) => String(s.jobId)))];
    const empIds = [...new Set(sessions.map((s) => String(s.employerId)))];
    const jobs = await Job.find({ _id: { $in: jobIds } })
      .select('title companyName')
      .lean();
    const users = await User.find({ _id: { $in: empIds } })
      .select('name')
      .lean();
    const jobInfo = new Map(
      jobs.map((j) => [String(j._id), { title: j.title, company: j.companyName }])
    );
    const empName = new Map(users.map((u) => [String(u._id), u.name]));

    res.json({
      success: true,
      data: {
        sessions: sessions.map((s) => ({
          id: String(s._id),
          jobTitle: jobInfo.get(String(s.jobId))?.title ?? 'Job',
          companyName: jobInfo.get(String(s.jobId))?.company ?? '',
          employerName: empName.get(String(s.employerId)) ?? 'Employer',
          messages: s.messages,
          trustScore: s.trustScore,
          status: s.status,
          startTime: s.startTime,
          endTime: s.endTime,
          duration: s.duration,
          hash: s.hash,
        })),
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load sessions' });
  }
});

router.post('/:id/end', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      employerId: req.auth!.userId,
      status: 'active',
    }).lean();
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }
    const endTime = new Date();
    const duration = Math.max(
      0,
      Math.round((endTime.getTime() - new Date(session.startTime).getTime()) / 1000)
    );
    const payload = JSON.stringify({
      messages: session.messages,
      trustScore: session.trustScore,
      timestamps: session.messages.map((m) => m.timestamp),
    });
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    const txHash = process.env.POLYGONSCAN_TX_URL?.split('/tx/')[1] ?? '';

    await Session.findOneAndUpdate(
      { _id: session._id },
      {
        $set: {
          status: 'sealed',
          endTime,
          duration,
          hash,
          blockchainTxHash: txHash,
        },
      },
      { new: true }
    );

    getSocketServer()?.to(`session_${String(session._id)}`).emit('session:sealed', {
      sessionId: String(session._id),
      hash,
      txHash,
    });

    res.json({
      success: true,
      data: {
        sessionId: String(session._id),
        hash,
        txHash,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to seal session' });
  }
});

router.get('/:id/verify', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .select(
        'jobId employerId candidateId messages startTime endTime duration hash blockchainTxHash status trustScore'
      )
      .lean();
    if (!session || session.status !== 'sealed' || !session.hash) {
      res.json({ success: true, data: { valid: false } });
      return;
    }
    const job = await Job.findById(session.jobId).select('title companyName').lean();
    const candidate = await User.findById(session.candidateId).select('name').lean();
    const employer = await User.findById(session.employerId).select('name').lean();

    res.json({
      success: true,
      data: {
        valid: true,
        sessionId: String(session._id),
        candidateName: candidate?.name,
        employerName: employer?.name,
        jobTitle: job?.title,
        companyName: job?.companyName,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        hash: session.hash,
        blockchainTxHash: session.blockchainTxHash,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

export default router;
