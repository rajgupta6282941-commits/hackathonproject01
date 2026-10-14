import type { DetectionPriority, DetectionSourceType } from './detection.types.js';

export interface DashboardMetric {
  value: number;
  definition: string;
}

export interface DashboardActivity {
  analysisId: string;
  candidateName: string;
  brandName: string;
  sourceType: DetectionSourceType;
  platform?: string;
  score: number;
  priority: DetectionPriority;
  analyzedAt: string;
}

export interface DashboardOverview {
  metrics: {
    totalBrands: DashboardMetric;
    totalAnalyses: DashboardMetric;
    highPriorityFindings: DashboardMetric;
    criticalPriorityFindings: DashboardMetric;
    socialAnalyses: DashboardMetric;
    mobileAppAnalyses: DashboardMetric;
  };
  riskDistribution: Record<DetectionPriority, number>;
  sourceDistribution: { sourceType: DetectionSourceType | 'other'; count: number }[];
  recentAnalyses: DashboardActivity[];
  trend: {
    available: boolean;
    windowDays: number;
    points: { date: string; count: number }[];
    message?: string;
  };
}
