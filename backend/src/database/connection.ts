import mongoose from 'mongoose';

export async function connectDatabase(uri = process.env.MONGODB_URI): Promise<void> {
  if (!uri?.trim()) throw new Error('MONGODB_URI is required to start the Vikral API.');
  await mongoose.connect(uri);
}

export async function closeDatabase(): Promise<void> {
  await mongoose.disconnect();
}
