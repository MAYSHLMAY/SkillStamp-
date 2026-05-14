import mongoose, { Schema, Types } from 'mongoose';

export type SessionSender = 'employer' | 'candidate' | 'ai';
export type SessionStatus = 'active' | 'sealed';

export interface SessionMessage {
  sender: SessionSender;
  text: string;
  timestamp: Date;
  label: string;
}

export interface ISession {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  employerId: Types.ObjectId;
  candidateId: Types.ObjectId;
  applicationId?: Types.ObjectId;
  messages: SessionMessage[];
  startTime: Date;
  endTime?: Date;
  trustScore: number;
  pasteDetected: boolean;
  anomalyCount: number;
  hash?: string;
  blockchainTxHash?: string;
  status: SessionStatus;
  duration?: number;
  createdAt: Date;
}

const messageSchema = new Schema<SessionMessage>(
  {
    sender: { type: String, enum: ['employer', 'candidate', 'ai'], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const sessionSchema = new Schema<ISession>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    employerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
    messages: [messageSchema],
    startTime: { type: Date, required: true },
    endTime: Date,
    trustScore: { type: Number, default: 100 },
    pasteDetected: { type: Boolean, default: false },
    anomalyCount: { type: Number, default: 0 },
    hash: String,
    blockchainTxHash: String,
    status: { type: String, enum: ['active', 'sealed'], default: 'active', index: true },
    duration: Number,
  },
  { timestamps: true }
);

export const Session = mongoose.model<ISession>('Session', sessionSchema);
