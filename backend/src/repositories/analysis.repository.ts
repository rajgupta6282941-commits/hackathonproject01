import { AnalysisModel, type AnalysisDocument } from '../models/analysis.model.js';
import type { DetectionResult } from '../types/detection.types.js';

export interface AnalysisRepository {
  list(): Promise<AnalysisDocument[]>;
  findById(id: string): Promise<AnalysisDocument | null>;
  create(result: DetectionResult): Promise<AnalysisDocument>;
}

export const analysisRepository: AnalysisRepository = {
  list: () => AnalysisModel.find().sort({ analyzedAt: -1 }).limit(50).exec(),
  findById: (id) => AnalysisModel.findOne({ analysisId: id }).exec(),
  create: (result) => AnalysisModel.create({
    analysisId: result.analysisId,
    brandId: result.brandId,
    brandName: result.matchedBrand.name,
    candidate: result.candidate,
    result,
    analyzedAt: new Date(result.analyzedAt),
  }),
};

export function serializeAnalysis(analysis: AnalysisDocument): DetectionResult {
  return analysis.result as DetectionResult;
}
