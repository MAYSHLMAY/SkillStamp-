import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { User } from './models/User';
import { Job } from './models/Job';
import { Application } from './models/Application';
import { Session } from './models/Session';
import { FALLBACK_CHALLENGES } from './services/ai';

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skillstamp';
  await mongoose.connect(uri);

  const existingJobs = await Job.find({
    title: { $in: ['Customer Support Representative', 'Amharic-English Translator'] },
  })
    .select('_id')
    .lean();
  const existingIds = existingJobs.map((j) => j._id);
  if (existingIds.length) {
    await Session.deleteMany({ jobId: { $in: existingIds } });
    await Application.deleteMany({ jobId: { $in: existingIds } });
    await Job.deleteMany({ _id: { $in: existingIds } });
  }

  await User.deleteMany({
    email: {
      $in: [
        'hr@techcorp.et',
        'team@addishr.et',
        'dawit.bekele@example.et',
        'sara.hailu@example.et',
        'mikias.alemu@example.et',
      ],
    },
  });

  const pass = await bcrypt.hash('password123', 10);

  const tech = await User.create({
    name: 'TechCorp Ethiopia',
    email: 'hr@techcorp.et',
    passwordHash: pass,
    role: 'employer',
  });
  const addis = await User.create({
    name: 'AddisHR Solutions',
    email: 'team@addishr.et',
    passwordHash: pass,
    role: 'employer',
  });

  const dawit = await User.create({
    name: 'Dawit Bekele',
    email: 'dawit.bekele@example.et',
    passwordHash: pass,
    role: 'candidate',
  });
  const sara = await User.create({
    name: 'Sara Hailu',
    email: 'sara.hailu@example.et',
    passwordHash: pass,
    role: 'candidate',
  });
  const mikias = await User.create({
    name: 'Mikias Alemu',
    email: 'mikias.alemu@example.et',
    passwordHash: pass,
    role: 'candidate',
  });

  const challengesSupport = FALLBACK_CHALLENGES;
  const challengesTranslator = FALLBACK_CHALLENGES.map((c, i) => ({
    ...c,
    title: `${c.title} (Translation context ${i + 1})`,
    description: `${c.description}\n\nContext: You are supporting Amharic ↔ English communication for a federal office in Addis.`,
  }));

  const jobSupport = await Job.create({
    employerId: tech._id,
    companyName: tech.name,
    title: 'Customer Support Representative',
    description:
      'We need a support representative who can handle inbound tickets, de-escalate frustrated customers, and coordinate with engineering. You will work shifts that overlap with East Africa business hours and occasionally Merkato merchant partners. Minimum 100 characters required here for realism in the demo seed script.',
    skills: ['Communication', 'Zendesk', 'Amharic', 'Problem solving'],
    locale: 'en',
    challenges: challengesSupport,
    published: true,
  });

  const jobTranslate = await Job.create({
    employerId: addis._id,
    companyName: addis.name,
    title: 'Amharic-English Translator',
    description:
      'Translate nuanced HR policies and employee handbooks between Amharic and English for clients across Ethiopia. You must preserve tone, legal precision, and cultural context for teams in Addis Ababa and regional hubs. Minimum 100 characters required here for realism in the demo seed script.',
    skills: ['Translation', 'Amharic', 'English', 'HR terminology'],
    locale: 'en',
    challenges: challengesTranslator,
    published: true,
  });

  const candidates = [dawit, sara, mikias];
  const scoresMatrix = [
    [87, 84, 82],
    [72, 70, 75],
    [61, 58, 64],
  ];

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const [acc, sp, cx] = scoresMatrix[i];
    const overall = Math.round((acc + sp + cx) / 3);
    for (const job of [jobSupport, jobTranslate]) {
      const answers = job.challenges.map((ch, idx) => ({
        challengeIndex: idx,
        text: `Seed answer ${idx + 1} for ${cand.name} regarding ${ch.title}.`,
        score: {
          accuracy: Math.max(40, acc - idx * 3),
          speed_proxy: Math.max(40, sp - idx * 2),
          complexity: Math.max(40, cx - idx * 4),
          overall: Math.max(40, overall - idx * 2),
        },
        feedback: 'Seeded evaluation for demo purposes.',
        pasteDetected: false,
      }));
      await Application.findOneAndUpdate(
        { jobId: job._id, candidateId: cand._id },
        {
          $set: {
            jobId: job._id,
            candidateId: cand._id,
            answers,
            overallScore: overall,
            status: 'pending',
            submittedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    }
  }

  const dawitApp = await Application.findOne({
    jobId: jobSupport._id,
    candidateId: dawit._id,
  }).lean();
  if (dawitApp) {
    const start = new Date(Date.now() - 3600_000);
    const messages = [
      {
        sender: 'ai' as const,
        text: 'Welcome Dawit. Let us begin with a short scenario about customer tone.',
        timestamp: start,
        label: 'Interviewer',
      },
      {
        sender: 'candidate' as const,
        text: 'Thank you — I would acknowledge the issue, verify billing, and follow up in writing.',
        timestamp: new Date(start.getTime() + 120_000),
        label: dawit.name,
      },
    ];
    const endTime = new Date(start.getTime() + 2400_000);
    const payload = JSON.stringify({
      messages,
      trustScore: 88,
      timestamps: messages.map((m) => m.timestamp),
    });
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    await Session.findOneAndUpdate(
      { jobId: jobSupport._id, candidateId: dawit._id, employerId: tech._id },
      {
        $set: {
          jobId: jobSupport._id,
          employerId: tech._id,
          candidateId: dawit._id,
          applicationId: dawitApp._id,
          messages,
          startTime: start,
          endTime,
          trustScore: 88,
          pasteDetected: false,
          anomalyCount: 0,
          hash,
          blockchainTxHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          status: 'sealed',
          duration: Math.round((endTime.getTime() - start.getTime()) / 1000),
        },
      },
      { upsert: true, new: true }
    );
  }

  process.stdout.write('Seed complete.\n');
  await mongoose.disconnect();
}

run().catch((e) => {
  process.stderr.write(String(e));
  process.exit(1);
});
