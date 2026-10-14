import { BrandModel, type BrandDocument } from '../models/brand.model.js';
import type { BrandInput } from '../types/brand.types.js';

export interface BrandRepository {
  list(): Promise<BrandDocument[]>;
  findById(id: string): Promise<BrandDocument | null>;
  create(input: BrandInput): Promise<BrandDocument>;
  update(id: string, input: BrandInput): Promise<BrandDocument | null>;
  delete(id: string): Promise<boolean>;
}

export const brandRepository: BrandRepository = {
  list: () => BrandModel.find().sort({ createdAt: -1 }).exec(),
  findById: (id) => BrandModel.findById(id).exec(),
  create: (input) => BrandModel.create(input),
  update: (id, input) => BrandModel.findByIdAndUpdate(id, input, { new: true, runValidators: true }).exec(),
  delete: async (id) => Boolean(await BrandModel.findByIdAndDelete(id).exec()),
};

export function serializeBrand(brand: BrandDocument) {
  return {
    id: brand._id.toString(),
    name: brand.name,
    officialWebsite: brand.officialWebsite,
    industry: brand.industry,
    description: brand.description,
    logoUrl: brand.logoUrl,
    aliases: brand.aliases,
    trustedDomains: brand.trustedDomains,
    socialAccounts: brand.socialAccounts,
    mobileApps: brand.mobileApps,
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  };
}
