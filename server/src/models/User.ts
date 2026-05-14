import mongoose, { Schema, Types } from 'mongoose';

export type UserRole = 'candidate' | 'employer';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['candidate', 'employer'], required: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
