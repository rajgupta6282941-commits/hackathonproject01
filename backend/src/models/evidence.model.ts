import { Schema, model, type InferSchemaType } from 'mongoose';

const evidenceSchema = new Schema({
  evidenceId: { type: String, required: true, unique: true, index: true },
  brandId: { type: Schema.Types.ObjectId, required: true, index: true },
  analysisId: { type: String, index: true },
  sourceType: { type: String, required: true, enum: ['user_submitted', 'authorized_api', 'mock_provider'] },
  sourceProvider: { type: String, required: true },
  platform: String,
  originalReference: String,
  collectedAt: { type: Date, required: true },
  observedAt: Date,
  lastValidatedAt: { type: Date, required: true },
  validationStatus: { type: String, required: true, enum: ['valid', 'limited', 'invalid'] },
  evidenceType: { type: String, required: true, enum: ['social_profile', 'mobile_app', 'website'] },
  normalizedFields: { type: Map, of: String, required: true },
  contentFingerprint: { type: String, required: true },
  provenance: { type: [String], required: true },
  validationErrors: { type: [String], default: [] },
  limitations: { type: [String], default: [] },
}, { timestamps: true, versionKey: false, collection: 'evidence' });

evidenceSchema.index({ brandId: 1, contentFingerprint: 1 }, { unique: true });

export type EvidenceDocument = InferSchemaType<typeof evidenceSchema> & {
  _id: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
};

export const EvidenceModel = model('Evidence', evidenceSchema);
