import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: 'candidate' | 'employer';
    };
    if (!name || !email || !password || !role) {
      res.status(400).json({ success: false, error: 'Missing fields' });
      return;
    }
    if (!['candidate', 'employer'].includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }
    const existing = await User.findOne({ email: email.toLowerCase() }).select('_id').lean();
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
    });
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ success: false, error: 'Server misconfigured' });
      return;
    }
    const token = jwt.sign({ userId: String(user._id), role: user.role }, secret, {
      expiresIn: '24h',
    });
    res.json({
      success: true,
      data: {
        token,
        user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Missing credentials' });
      return;
    }
    const user = await User.findOne({ email: email.toLowerCase() }).lean();
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ success: false, error: 'Server misconfigured' });
      return;
    }
    const token = jwt.sign({ userId: String(user._id), role: user.role }, secret, {
      expiresIn: '24h',
    });
    res.json({
      success: true,
      data: {
        token,
        user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth!.userId)
      .select('name email role')
      .lean();
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({
      success: true,
      data: { id: String(user._id), name: user.name, email: user.email, role: user.role },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load user' });
  }
});

export default router;
