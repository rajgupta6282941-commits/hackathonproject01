import { randomUUID } from 'node:crypto';
import { EvidenceModel, type EvidenceDocument } from '../models/evidence.model.js';
import type { EvidenceRecord } from '../types/evidence.types.js';

export interface EvidenceRepository {
  findDuplicate(brandId: string, fingerprint: string): Promise<EvidenceDocument | null>;
  create(record: EvidenceRecord): Promise<EvidenceDocument>;
}

export const evidenceRepository: EvidenceRepository = {
  findDuplicate: (brandId, fingerprint) => EvidenceModel.findOne({ brandId, contentFingerprint: fingerprint }).exec(),
  create: (record) => EvidenceModel.create({ ...record, evidenceId: record.evidenceId || randomUUID(), collectedAt: new Date(record.collectedAt), observedAt: record.observedAt ? new Date(record.observedAt) : undefined, lastValidatedAt: new Date(record.lastValidatedAt) }),
};
