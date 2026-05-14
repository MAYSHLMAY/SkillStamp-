import { Router } from 'express';
import { Job } from '../models/Job';
import { Application } from '../models/Application';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const jobs = await Job.find({ published: true })
      .select('title description skills companyName locale createdAt')
      .sort({ createdAt: -1 })
      .lean();
    const ids = jobs.map((j) => j._id);
    const counts = await Application.aggregate<{ _id: unknown; c: number }>([
      { $match: { jobId: { $in: ids }, status: 'pending' } },
      { $group: { _id: '$jobId', c: { $sum: 1 } } },
    ]);
    const map = new Map(counts.map((x) => [String(x._id), x.c]));
    res.json({
      success: true,
      data: jobs.map((j) => ({
        id: String(j._id),
        title: j.title,
        description: j.description,
        skills: j.skills,
        companyName: j.companyName,
        locale: j.locale,
        createdAt: j.createdAt,
        applyingNow: map.get(String(j._id)) ?? 0,
      })),
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load jobs' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, published: true })
      .select('title description skills companyName locale challenges')
      .lean();
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }
    res.json({
      success: true,
      data: {
        id: String(job._id),
        title: job.title,
        description: job.description,
        skills: job.skills,
        companyName: job.companyName,
        locale: job.locale,
        challenges: job.challenges,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load job' });
  }
});

export default router;
