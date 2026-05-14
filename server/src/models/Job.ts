import mongoose, { Schema, Types } from 'mongoose';

export interface JobChallenge {
  title: string;
  description: string;
  expectedElements: string[];
  type: 'text';
}

export interface IJob {
  _id: Types.ObjectId;
  employerId: Types.ObjectId;
  companyName: string;
  title: string;
  description: string;
  skills: string[];
  locale: 'en' | 'am';
  challenges: JobChallenge[];
  published: boolean;
  createdAt: Date;
}

const challengeSchema = new Schema<JobChallenge>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    expectedElements: [{ type: String, required: true }],
    type: { type: String, enum: ['text'], default: 'text' },
  },
  { _id: false }
);

const jobSchema = new Schema<IJob>(
  {
    employerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyName: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    skills: [{ type: String }],
    locale: { type: String, enum: ['en', 'am'], default: 'en' },
    challenges: [challengeSchema],
    published: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const Job = mongoose.model<IJob>('Job', jobSchema);
