import { Schema, model, type InferSchemaType } from 'mongoose';

const socialAccountSchema = new Schema({
  platform: { type: String, required: true },
  handle: { type: String, required: true },
  profileUrl: String,
  verificationStatus: { type: String, required: true, enum: ['verified', 'unverified'] },
  evidenceNote: String,
}, { _id: false });

const mobileAppSchema = new Schema({
  platform: { type: String, required: true },
  appName: { type: String, required: true },
  packageId: String,
  bundleId: String,
  publisher: { type: String, required: true },
  storeUrl: String,
  verificationStatus: { type: String, required: true, enum: ['verified', 'unverified'] },
  evidenceNote: String,
}, { _id: false });

const brandSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  officialWebsite: String,
  industry: String,
  description: String,
  logoUrl: String,
  aliases: { type: [String], default: [] },
  trustedDomains: { type: [String], default: [] },
  socialAccounts: { type: [socialAccountSchema], default: [] },
  mobileApps: { type: [mobileAppSchema], default: [] },
}, { timestamps: true, versionKey: false });

export type BrandDocument = InferSchemaType<typeof brandSchema> & { _id: { toString(): string }; createdAt: Date; updatedAt: Date };
export const BrandModel = model('Brand', brandSchema);
