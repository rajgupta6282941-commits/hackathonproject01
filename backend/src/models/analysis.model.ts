import { Schema, model, type InferSchemaType } from 'mongoose';

const analysisSchema = new Schema({
  analysisId: { type: String, required: true, unique: true, index: true },
  brandId: { type: Schema.Types.ObjectId, required: true, index: true },
  brandName: { type: String, required: true },
  candidate: { type: Schema.Types.Mixed, required: true },
  result: { type: Schema.Types.Mixed, required: true },
  analyzedAt: { type: Date, required: true, index: true },
}, { timestamps: true, versionKey: false });

export type AnalysisDocument = InferSchemaType<typeof analysisSchema> & {
  _id: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
};

export const AnalysisModel = model('Analysis', analysisSchema);
