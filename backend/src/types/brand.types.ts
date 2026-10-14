export const SOCIAL_PLATFORMS = ['Instagram', 'Facebook', 'X', 'LinkedIn', 'YouTube', 'TikTok'] as const;
export const APP_PLATFORMS = ['Google Play', 'Apple App Store', 'Other'] as const;
export const VERIFICATION_STATUSES = ['verified', 'unverified'] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type AppPlatform = (typeof APP_PLATFORMS)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface SocialAccount {
  platform: SocialPlatform;
  handle: string;
  profileUrl?: string;
  verificationStatus: VerificationStatus;
  evidenceNote?: string;
}

export interface MobileApp {
  platform: AppPlatform;
  appName: string;
  packageId?: string;
  bundleId?: string;
  publisher: string;
  storeUrl?: string;
  verificationStatus: VerificationStatus;
  evidenceNote?: string;
}

export interface Brand {
  id: string;
  name: string;
  officialWebsite?: string;
  industry?: string;
  description?: string;
  logoUrl?: string;
  aliases: string[];
  trustedDomains: string[];
  socialAccounts: SocialAccount[];
  mobileApps: MobileApp[];
  createdAt: string;
  updatedAt: string;
}

export type BrandInput = Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>;
