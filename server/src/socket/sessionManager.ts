import type { Server, Socket } from 'socket.io';
import { Session } from '../models/Session';
import { Job } from '../models/Job';
import { Application } from '../models/Application';
import { User } from '../models/User';
import {
  lexicalUniqueRatio,
  nextInterviewerQuestion,
  trustColor,
  trustFromSignals,
} from '../services/ai';
import { getSocketServer } from './io';

const employerRooms = new Map<string, Set<string>>();
const employerFocus = new Map<string, string>();
const lexicalHistory = new Map<string, number[]>();
const aiPending = new Map<string, ReturnType<typeof setTimeout> | undefined>();

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((s, x) => s + (x - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

function addEmployerSocket(employerId: string, socketId: string): void {
  let set = employerRooms.get(employerId);
  if (!set) {
    set = new Set();
    employerRooms.set(employerId, set);
  }
  set.add(socketId);
}

function removeEmployerSocket(employerId: string, socketId: string): void {
  const set = employerRooms.get(employerId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) employerRooms.delete(employerId);
}

async function maybeAiReply(io: Server, sessionId: string): Promise<void> {
  const pending = aiPending.get(sessionId);
  if (pending) clearTimeout(pending);
  aiPending.set(
    sessionId,
    setTimeout(async () => {
      aiPending.delete(sessionId);
      const session = await Session.findById(sessionId).lean();
      if (!session || session.status !== 'active') return;
      const job = await Job.findById(session.jobId).lean();
      if (!job) return;
      const employerId = String(session.employerId);
      if (employerFocus.get(employerId) === sessionId) return;

      const last = session.messages[session.messages.length - 1];
      if (last?.sender !== 'candidate') return;

      const app = await Application.findOne({
        jobId: session.jobId,
        candidateId: session.candidateId,
      })
        .select('overallScore')
        .lean();
      const question = await nextInterviewerQuestion({
        jobTitle: job.title,
        candidateScore: app?.overallScore ?? 0,
        challenges: job.challenges.map((c) => ({ title: c.title })),
        messages: session.messages.map((m) => ({ label: m.label, text: m.text })),
        locale: job.locale,
      });
      const msg = {
        sender: 'ai' as const,
        text: question,
        timestamp: new Date(),
        label: 'Interviewer',
      };
      await Session.findOneAndUpdate({ _id: session._id }, { $push: { messages: msg } });
      io.to(`session_${sessionId}`).emit('session:message', {
        sender: 'ai',
        text: question,
        timestamp: msg.timestamp.toISOString(),
        label: 'Interviewer',
      });
    }, 900)
  );
}

async function updateTrustAndSignals(params: {
  io: Server;
  sessionId: string;
  employerId: string;
  text: string;
  pasteDetected?: boolean;
}): Promise<void> {
  const { io, sessionId, employerId, text, pasteDetected } = params;
  const ratio = lexicalUniqueRatio(text);
  const hist = lexicalHistory.get(sessionId) ?? [];
  hist.push(ratio);
  if (hist.length > 30) hist.shift();
  lexicalHistory.set(sessionId, hist);

  const sd = stddev(hist);
  const mean = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : ratio;
  let anomalyInc = 0;
  if (hist.length >= 3 && sd > 0 && Math.abs(ratio - mean) > 2 * sd) anomalyInc = 1;

  const session = await Session.findById(sessionId).lean();
  if (!session) return;

  const updated = await Session.findOneAndUpdate(
    { _id: session._id },
    {
      $set: {
        pasteDetected: session.pasteDetected || !!pasteDetected,
      },
      $inc: { anomalyCount: anomalyInc },
    },
    { new: true }
  ).lean();
  if (!updated) return;

  const pasteCount = updated.pasteDetected ? 1 : 0;
  const trustScore = trustFromSignals(pasteCount, updated.anomalyCount);
  await Session.findOneAndUpdate({ _id: session._id }, { $set: { trustScore } });

  const color = trustColor(trustScore);
  io.to(`employer_${employerId}`).emit('session:trust_update', { sessionId, trustScore, color });

  if (ratio > 0.62 && text.length > 220) {
    io.to(`employer_${employerId}`).emit('session:ai_ping', {
      sessionId,
      message: 'Strong answer detected',
    });
  }
  if (ratio < 0.28 && text.length > 80) {
    io.to(`employer_${employerId}`).emit('session:ai_ping', {
      sessionId,
      message: 'Weak or unusual answer pattern',
    });
  }
}

export function initSocket(io: Server): void {
  io.on('connection', (socket: Socket) => {
    let userId: string | null = null;
    let role: 'candidate' | 'employer' | null = null;

    socket.on('user:connect', (payload: { userId?: string; role?: 'candidate' | 'employer' }) => {
      if (!payload.userId || !payload.role) return;
      userId = payload.userId;
      role = payload.role;
      socket.join(`user_${userId}`);
      if (role === 'employer') {
        addEmployerSocket(userId, socket.id);
        socket.join(`employer_${userId}`);
      }
      io.emit('online:count', io.engine.clientsCount);
    });

    socket.on('session:join', (payload: { sessionId?: string; role?: 'candidate' | 'employer' }) => {
      if (!payload.sessionId || !userId || !payload.role) return;
      socket.join(`session_${payload.sessionId}`);
      if (payload.role === 'employer' && role === 'employer') {
        employerFocus.set(userId, payload.sessionId);
      }
    });

    socket.on(
      'session:message',
      async (payload: {
        sessionId?: string;
        text?: string;
        pasteDetected?: boolean;
      }) => {
        if (!payload.sessionId || !payload.text || !userId || !role) return;
        const ioSrv = getSocketServer();
        if (!ioSrv) return;

        const session = await Session.findById(payload.sessionId).lean();
        if (!session || session.status !== 'active') return;

        const isCandidate = role === 'candidate' && String(session.candidateId) === userId;
        const isEmployer = role === 'employer' && String(session.employerId) === userId;
        if (!isCandidate && !isEmployer) return;

        let displayLabel = 'Interviewer';
        if (isCandidate) {
          const u = await User.findById(userId).select('name').lean();
          displayLabel = u?.name ?? 'Candidate';
        }

        const sender = isCandidate ? ('candidate' as const) : ('employer' as const);
        const msg = {
          sender,
          text: payload.text,
          timestamp: new Date(),
          label: isCandidate ? displayLabel : 'Interviewer',
        };

        await Session.findOneAndUpdate({ _id: session._id }, { $push: { messages: msg } });

        ioSrv.to(`session_${payload.sessionId}`).emit('session:message', {
          sender,
          text: payload.text,
          timestamp: msg.timestamp.toISOString(),
          label: msg.label,
        });

        if (isCandidate) {
          if (payload.pasteDetected) {
            ioSrv.to(`employer_${String(session.employerId)}`).emit('session:paste_detected', {
              sessionId: payload.sessionId,
            });
          }
          await updateTrustAndSignals({
            io: ioSrv,
            sessionId: payload.sessionId,
            employerId: String(session.employerId),
            text: payload.text,
            pasteDetected: payload.pasteDetected,
          });
          await maybeAiReply(ioSrv, payload.sessionId);
        } else {
          employerFocus.set(String(session.employerId), payload.sessionId);
        }
      }
    );

    socket.on('session:typing', (payload: { sessionId?: string }) => {
      if (!payload.sessionId || !userId || !role) return;
      const label =
        role === 'candidate' ? 'Candidate is typing…' : 'Interviewer is typing…';
      socket.to(`session_${payload.sessionId}`).emit('session:typing', { label });
    });

    socket.on('session:stop_typing', (payload: { sessionId?: string }) => {
      if (!payload.sessionId) return;
      socket.to(`session_${payload.sessionId}`).emit('session:stop_typing', {});
    });

    socket.on('disconnect', () => {
      if (userId && role === 'employer') {
        removeEmployerSocket(userId, socket.id);
        if (!employerRooms.get(userId)?.size) {
          employerFocus.delete(userId);
        }
      }
      io.emit('online:count', io.engine.clientsCount);
    });
  });
}
