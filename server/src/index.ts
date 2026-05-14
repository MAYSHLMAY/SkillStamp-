import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import http from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import authRoutes from './routes/auth';
import jobsRoutes from './routes/jobs';
import employerJobsRoutes from './routes/employerJobs';
import applicationsRoutes from './routes/applications';
import sessionsRoutes from './routes/sessions';
import internalRoutes from './routes/internal';
import { setSocketServer } from './socket/io';
import { initSocket } from './socket/sessionManager';

const PORT = Number(process.env.PORT) || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skillstamp';
  await mongoose.connect(mongoUri);

  const app = express();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: clientOrigin, methods: ['GET', 'POST'], credentials: true },
  });
  setSocketServer(io);
  initSocket(io);

  app.use(
    cors({
      origin: clientOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/employer/jobs', employerJobsRoutes);
  app.use('/api/applications', applicationsRoutes);
  app.use('/api/sessions', sessionsRoutes);
  app.use('/api/internal', internalRoutes);

  const distPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(distPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next(err);
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  server.listen(PORT, () => {
    process.stdout.write(`SkillStamp API listening on ${PORT}\n`);
  });
}

main().catch((e) => {
  process.stderr.write(String(e));
  process.exit(1);
});
