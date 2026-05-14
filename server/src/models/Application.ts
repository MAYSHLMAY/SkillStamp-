import mongoose, { Schema, Types } from 'mongoose';

export type ApplicationStatus = 'pending' | 'invited' | 'rejected' | 'completed';

export interface AnswerScore {
  accuracy: number;
  speed_proxy: number;
  complexity: number;
  overall: number;
}

export interface ApplicationAnswer {
  challengeIndex: number;
  text: string;
  score?: AnswerScore;
  feedback?: string;
  pasteDetected?: boolean;
}

export interface IApplication {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  candidateId: Types.ObjectId;
  answers: ApplicationAnswer[];
  overallScore?: number;
  status: ApplicationStatus;
  submittedAt?: Date;
  createdAt: Date;
}

const scoreSchema = new Schema<AnswerScore>(
  {
    accuracy: Number,
    speed_proxy: Number,
    complexity: Number,
    overall: Number,
  },
  { _id: false }
);

const answerSchema = new Schema<ApplicationAnswer>(
  {
    challengeIndex: { type: Number, required: true },
    text: { type: String, required: true },
    score: scoreSchema,
    feedback: String,
    pasteDetected: { type: Boolean, default: false },
  },
  { _id: false }
);

const applicationSchema = new Schema<IApplication>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: [answerSchema],
    overallScore: Number,
    status: {
      type: String,
      enum: ['pending', 'invited', 'rejected', 'completed'],
      default: 'pending',
      index: true,
    },
    submittedAt: Date,
  },
  { timestamps: true }
);

applicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });

export const Application = mongoose.model<IApplication>('Application', applicationSchema);
