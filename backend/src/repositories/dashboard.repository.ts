import { BrandModel } from '../models/brand.model.js';
import { AnalysisModel } from '../models/analysis.model.js';
import type { DashboardOverview } from '../types/dashboard.types.js';
import type { DetectionPriority, DetectionSourceType } from '../types/detection.types.js';

const priorities: DetectionPriority[] = ['low', 'medium', 'high', 'critical'];

export interface DashboardRepository {
  overview(days: number, limit: number): Promise<DashboardOverview>;
}

export const dashboardRepository: DashboardRepository = {
  async overview(days, limit) {
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [totalBrands, aggregate] = await Promise.all([
      BrandModel.countDocuments().exec(),
      AnalysisModel.aggregate([
        {
          $facet: {
            totals: [{ $group: {
              _id: null,
              total: { $sum: 1 },
              high: { $sum: { $cond: [{ $in: ['$result.priority', ['high', 'critical']] }, 1, 0] } },
              critical: { $sum: { $cond: [{ $eq: ['$result.priority', 'critical'] }, 1, 0] } },
              social: { $sum: { $cond: [{ $eq: ['$result.sourceType', 'social'] }, 1, 0] } },
              mobile: { $sum: { $cond: [{ $eq: ['$result.sourceType', 'mobile_app'] }, 1, 0] } },
            } }],
            risks: [{ $group: { _id: '$result.priority', count: { $sum: 1 } } }],
            sources: [{ $group: { _id: '$result.sourceType', count: { $sum: 1 } } }],
            recent: [{ $sort: { analyzedAt: -1 } }, { $limit: limit }, { $project: {
              _id: 0, analysisId: 1, candidateName: '$candidate.candidateName', brandName: 1,
              sourceType: '$result.sourceType', platform: '$candidate.platform',
              score: '$result.finalPriorityScore', priority: '$result.priority', analyzedAt: 1,
            } }],
            trend: [{ $match: { analyzedAt: { $gte: start } } }, { $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$analyzedAt', timezone: 'UTC' } },
              count: { $sum: 1 },
            } }, { $sort: { _id: 1 } }],
          },
        },
      ]).exec(),
    ]);

    const data = aggregate[0] ?? {};
    const totals = data.totals?.[0] ?? { total: 0, high: 0, critical: 0, social: 0, mobile: 0 };
    const riskDistribution = Object.fromEntries(priorities.map((priority) => [
      priority, data.risks?.find((item: { _id: string }) => item._id === priority)?.count ?? 0,
    ])) as Record<DetectionPriority, number>;
    const sourceDistribution = (data.sources ?? []).map((item: { _id: string; count: number }) => ({
      sourceType: (['social', 'mobile_app'].includes(item._id) ? item._id : 'other') as DetectionSourceType | 'other',
      count: item.count,
    }));
    const points = (data.trend ?? []).map((item: { _id: string; count: number }) => ({ date: item._id, count: item.count }));
    return {
      metrics: {
        totalBrands: { value: totalBrands, definition: 'Saved brand profiles.' },
        totalAnalyses: { value: totals.total, definition: 'Persisted analysis results, not confirmed incidents.' },
        highPriorityFindings: { value: totals.high, definition: 'Recorded analyses rated high or critical.' },
        criticalPriorityFindings: { value: totals.critical, definition: 'Recorded analyses rated critical.' },
        socialAnalyses: { value: totals.social, definition: 'Recorded social-source analyses.' },
        mobileAppAnalyses: { value: totals.mobile, definition: 'Recorded mobile-app analyses.' },
      },
      riskDistribution,
      sourceDistribution,
      recentAnalyses: (data.recent ?? []).map((item: DashboardOverview['recentAnalyses'][number]) => ({
        ...item,
        analyzedAt: new Date(item.analyzedAt).toISOString(),
      })),
      trend: {
        available: points.length >= 2,
        windowDays: days,
        points,
        message: points.length >= 2 ? undefined : 'More recorded analyses are needed to show a reliable trend.',
      },
    };
  },
};
