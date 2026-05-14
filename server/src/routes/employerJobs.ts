import { Router } from 'express';
import { Types } from 'mongoose';
import { Job } from '../models/Job';
import { User } from '../models/User';
import { Application } from '../models/Application';
import { Session } from '../models/Session';
import { requireAuth, requireRole } from '../middleware/auth';
import { generateChallenges } from '../services/ai';

const router = Router();

router.use(requireAuth, requireRole('employer'));

router.get('/', async (req, res) => {
  try {
    const jobs = await Job.find({ employerId: req.auth!.userId })
      .select('title description skills locale challenges published createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const jobIds = jobs.map((j) => j._id);
    const apps = await Application.find({ jobId: { $in: jobIds } })
      .select('jobId overallScore candidateId')
      .lean();
    const users = await User.find({
      _id: { $in: apps.map((a) => a.candidateId) },
    })
      .select('name')
      .lean();
    const nameBy = new Map(users.map((u) => [String(u._id), u.name]));

    const byJob = new Map<
      string,
      { scores: number[]; top: { score: number; name: string; candidateId: string } | null }
    >();
    for (const j of jobs) byJob.set(String(j._id), { scores: [], top: null });
    for (const a of apps) {
      const key = String(a.jobId);
      const bucket = byJob.get(key);
      if (!bucket) continue;
      const sc = a.overallScore ?? 0;
      if (sc > 0) bucket.scores.push(sc);
      const nm = nameBy.get(String(a.candidateId)) ?? 'Candidate';
      if (!bucket.top || sc > bucket.top.score) {
        bucket.top = { score: sc, name: nm, candidateId: String(a.candidateId) };
      }
    }

    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const applicantsWeekReal = await Application.countDocuments({
      jobId: { $in: jobIds },
      submittedAt: { $gte: weekAgo },
    });

    const sessionsCompleted = await Session.countDocuments({
      employerId: req.auth!.userId,
      status: 'sealed',
    });

    const allScores = apps.map((a) => a.overallScore).filter((s): s is number => typeof s === 'number' && s > 0);
    const avgApplicantScore =
      allScores.length > 0 ? Math.round(allScores.reduce((x, y) => x + y, 0) / allScores.length) : 0;

    res.json({
      success: true,
      data: {
        stats: {
          activeJobs: jobs.filter((j) => j.published).length,
          applicantsThisWeek: applicantsWeekReal,
          sessionsCompleted,
          avgApplicantScore,
        },
        jobs: jobs.map((j) => {
          const b = byJob.get(String(j._id)) ?? { scores: [], top: null };
          return {
            id: String(j._id),
            title: j.title,
            description: j.description,
            skills: j.skills,
            locale: j.locale,
            challenges: j.challenges,
            published: j.published,
            createdAt: j.createdAt,
            applicantCount: apps.filter((a) => String(a.jobId) === String(j._id)).length,
            scoreSamples: b.scores.slice(0, 40),
            topScorer: b.top,
          };
        }),
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load jobs' });
  }
});

router.get('/:jobId/applicants', async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      employerId: req.auth!.userId,
    })
      .select('title companyName')
      .lean();
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }
    const apps = await Application.find({ jobId: job._id })
      .select('candidateId answers overallScore status submittedAt')
      .sort({ overallScore: -1, submittedAt: -1 })
      .lean();

    const candidateIds = apps.map((a) => a.candidateId);
    const users = await User.find({ _id: { $in: candidateIds } })
      .select('name')
      .lean();
    const nameById = new Map(users.map((u) => [String(u._id), u.name]));

    const ranked = apps.map((a, i) => ({
      rank: i + 1,
      id: String(a._id),
      candidateId: String(a.candidateId),
      candidateName: nameById.get(String(a.candidateId)) ?? 'Candidate',
      overallScore: a.overallScore ?? 0,
      status: a.status,
      answers: a.answers,
      submittedAt: a.submittedAt,
    }));

    res.json({
      success: true,
      data: {
        job: { id: String(job._id), title: job.title, companyName: job.companyName },
        applicants: ranked,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load applicants' });
  }
});

/** Create draft + challenges, regenerate challenges, or publish */
router.post('/', async (req, res) => {
  try {
    const body = req.body as {
      jobId?: string;
      publish?: boolean;
      regenerate?: boolean;
      title?: string;
      description?: string;
      skills?: string[];
      locale?: 'en' | 'am';
      challenges?: { title: string; description: string; expectedElements: string[]; type?: string }[];
    };

    if (body.jobId && Types.ObjectId.isValid(body.jobId)) {
      const existing = await Job.findOne({
        _id: body.jobId,
        employerId: req.auth!.userId,
      }).lean();
      if (!existing) {
        res.status(404).json({ success: false, error: 'Job not found' });
        return;
      }

      if (body.publish && body.challenges?.length) {
        const updated = await Job.findOneAndUpdate(
          { _id: body.jobId, employerId: req.auth!.userId },
          {
            $set: {
              challenges: body.challenges.map((c) => ({
                title: c.title,
                description: c.description,
                expectedElements: c.expectedElements ?? [],
                type: 'text' as const,
              })),
              published: true,
            },
          },
          { new: true }
        )
          .select('title description skills locale challenges published companyName')
          .lean();
        res.json({ success: true, data: { job: updated } });
        return;
      }

      if (body.regenerate) {
        const challenges = await generateChallenges({
          title: existing.title,
          description: existing.description,
          skills: existing.skills,
          locale: existing.locale,
        });
        const updated = await Job.findOneAndUpdate(
          { _id: body.jobId, employerId: req.auth!.userId },
          { $set: { challenges } },
          { new: true }
        )
          .select('title description skills locale challenges published companyName')
          .lean();
        res.json({ success: true, data: { job: updated } });
        return;
      }
    }

    const { title, description, skills, locale } = body;
    if (!title || !description || !skills?.length) {
      res.status(400).json({ success: false, error: 'Missing job fields' });
      return;
    }
    if (description.length < 100) {
      res.status(400).json({ success: false, error: 'Description must be at least 100 characters' });
      return;
    }

    const employer = await User.findById(req.auth!.userId).select('name').lean();
    const companyName = employer?.name ?? 'Company';

    const challenges = await generateChallenges({
      title,
      description,
      skills,
      locale: locale === 'am' ? 'am' : 'en',
    });

    const job = await Job.create({
      employerId: new Types.ObjectId(req.auth!.userId),
      companyName,
      title,
      description,
      skills,
      locale: locale === 'am' ? 'am' : 'en',
      challenges,
      published: false,
    });

    res.json({ success: true, data: { job: job.toObject() } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to save job' });
  }
});

export default router;
