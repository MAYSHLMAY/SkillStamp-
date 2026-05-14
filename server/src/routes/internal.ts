import { Router } from 'express';
import { scoreAnswer } from '../services/ai';
import type { JobChallenge } from '../models/Job';

const router = Router();

router.post('/score', async (req, res) => {
  const key = req.headers['x-internal-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }
  try {
    const { jobTitle, challenge, candidateAnswer } = req.body as {
      jobTitle?: string;
      challenge?: JobChallenge;
      candidateAnswer?: string;
    };
    if (!jobTitle || !challenge || !candidateAnswer) {
      res.status(400).json({ success: false, error: 'Missing fields' });
      return;
    }
    const score = await scoreAnswer({ jobTitle, challenge, candidateAnswer });
    res.json({ success: true, data: { score } });
  } catch {
    res.status(500).json({ success: false, error: 'Scoring failed' });
  }
});

export default router;
