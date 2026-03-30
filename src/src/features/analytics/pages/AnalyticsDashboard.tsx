import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { useAuthStore } from '@/features/auth/store/authStore';
import { SourceQualityScoreboard } from '../components/SourceQualityScoreboard';
import { RecruiterPerformanceTable } from '../components/RecruiterPerformanceTable';
import { SyncStatusPanel } from '../components/SyncStatusPanel';
import { FilterBar } from '../components/FilterBar';
import { TrendChart } from '../components/TrendChart';
import { Trophy, Users, RefreshCw, TrendingUp, Filter } from 'lucide-react';

interface SourceQualityItem {
  id: string;
  sourceChannel: string;
  totalApplications: number;
  onboardedCount: number;
  conversionRate: number;
  retention90Day: number;
  avgCompletionRate30Day: number;
  qualityScore: number;
  tier: 'GOLD' | 'SILVER' | 'BRONZE' | 'UNRANKED';
}

interface PeriodFilters {
  period: '30d' | '90d' | '6m' | '12m';
  zoneId?: string;
  serviceType?: string;
}

export function AnalyticsDashboard() {
  const { user } = useAuthStore();
  const isManager = ['ADMIN', 'RECRUITMENT_MANAGER'].includes(user?.role || '');
  
  const [filters, setFilters] = useState<PeriodFilters>({
    period: '90d',
  });
  const [activeTab, setActiveTab] = useState<'scoreboard' | 'recruiters' | 'sync'>('scoreboard');

  const { data: scoreboardData, isLoading, refetch } = useQuery({
    queryKey: ['analytics', 'source-quality', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', filters.period);
      if (filters.zoneId) params.append('zoneId', filters.zoneId);
      if (filters.serviceType) params.append('serviceType', filters.serviceType);
      
      const response = await api.get(`/analytics/source-quality/scoreboard?${params.toString()}`);
      return response.data;
    },
  });

  const calculateTotals = (scoreboard: SourceQualityItem[]) => {
    if (!scoreboard?.length) return { applications: 0, onboarded: 0, avgQuality: 0 };
    
    const totalApps = scoreboard.reduce((sum, s) => sum + s.totalApplications, 0);
    const totalOnboarded = scoreboard.reduce((sum, s) => sum + s.onboardedCount, 0);
    const avgQuality = Math.round(
      scoreboard.reduce((sum, s) => sum + s.qualityScore, 0) / scoreboard.length
    );
    
    return {
      applications: totalApps,
      onboarded: totalOnboarded,
      avgQuality,
    };
  };

  const totals = calculateTotals(scoreboardData?.scoreboard || []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Source Quality Analytics</h1>
              <p className="text-sm text-gray-500 mt-1">
                Track and optimize your recruitment sources based on post-hire performance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              {isManager && (
                <button
                  onClick={() => setActiveTab('sync')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <TrendingUp className="w-4 h-4" />
                  Sync Status
                </button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Applications</p>
                  <p className="text-2xl font-bold text-blue-900">{totals.applications.toLocaleString()}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-xs text-blue-600 mt-2">
                {scoreboardData?.period?.label || '90d'} period
              </p>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Successfully Onboarded</p>
                  <p className="text-2xl font-bold text-green-900">{totals.onboarded.toLocaleString()}</p>
                </div>
                <Trophy className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-xs text-green-600 mt-2">
                {totals.applications > 0 
                  ? `${Math.round((totals.onboarded / totals.applications) * 100)}% conversion rate`
                  : 'No data'}
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Average Quality Score</p>
                  <p className="text-2xl font-bold text-purple-900">{totals.avgQuality}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-xs text-purple-600 mt-2">
                Composite score (0-100)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
            <FilterBar filters={filters} onChange={setFilters} />
          </div>

          <div className="flex bg-white border rounded-lg p-1">
            <button
              onClick={() => setActiveTab('scoreboard')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'scoreboard'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Scoreboard
            </button>
            {isManager && (
              <button
                onClick={() => setActiveTab('recruiters')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'recruiters'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Recruiter Performance
              </button>
            )}
            {isManager && (
              <button
                onClick={() => setActiveTab('sync')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'sync'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Sync Status
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'scoreboard' && (
            <>
              {/* Trend Chart */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Quality Score Trends
                </h2>
                <TrendChart 
                  scoreboard={scoreboardData?.scoreboard || []}
                  isLoading={isLoading}
                />
              </div>

              {/* Source Quality Scoreboard */}
              <SourceQualityScoreboard 
                scoreboard={scoreboardData?.scoreboard || []}
                isLoading={isLoading}
                onViewDetail={(source) => console.log('View detail:', source)}
              />
            </>
          )}

          {activeTab === 'recruiters' && isManager && (
            <RecruiterPerformanceTable period={filters.period} />
          )}

          {activeTab === 'sync' && isManager && (
            <SyncStatusPanel />
          )}
        </div>

        {/* Legend */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Quality Score Calculation</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 mt-1" />
              <div>
                <p className="font-medium text-gray-700">90-Day Retention (40%)</p>
                <p className="text-gray-500">Drivers still active 90 days post-onboarding</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 mt-1" />
              <div>
                <p className="font-medium text-gray-700">Completion Rate (30%)</p>
                <p className="text-gray-500">Average task completion at 30 days</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500 mt-1" />
              <div>
                <p className="font-medium text-gray-700">Tier Distribution (30%)</p>
                <p className="text-gray-500">% at BRONZE+ tier at 90 days</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
