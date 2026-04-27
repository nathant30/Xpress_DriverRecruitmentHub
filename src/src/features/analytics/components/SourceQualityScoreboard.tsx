import { useState } from 'react';
import { Medal, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { formatSourceChannel } from '../utils/formatters';

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

interface Props {
  scoreboard: SourceQualityItem[];
  isLoading: boolean;
  onViewDetail: (sourceChannel: string) => void;
}

type SortField = 'qualityScore' | 'conversionRate' | 'retention90Day' | 'totalApplications' | 'tier';
type SortDirection = 'asc' | 'desc';

export function SourceQualityScoreboard({ scoreboard, isLoading, onViewDetail }: Props) {
  const [sortField, setSortField] = useState<SortField>('qualityScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedScoreboard = [...scoreboard].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'qualityScore':
        comparison = a.qualityScore - b.qualityScore;
        break;
      case 'conversionRate':
        comparison = a.conversionRate - b.conversionRate;
        break;
      case 'retention90Day':
        comparison = a.retention90Day - b.retention90Day;
        break;
      case 'totalApplications':
        comparison = a.totalApplications - b.totalApplications;
        break;
      case 'tier':
        const tierOrder = { GOLD: 0, SILVER: 1, BRONZE: 2, UNRANKED: 3 };
        comparison = tierOrder[a.tier] - tierOrder[b.tier];
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'GOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
            <Medal className="w-3 h-3" />
            GOLD
          </span>
        );
      case 'SILVER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
            <Medal className="w-3 h-3" />
            SILVER
          </span>
        );
      case 'BRONZE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            <Medal className="w-3 h-3" />
            BRONZE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
            —
          </span>
        );
    }
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          sortDirection === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
        )}
      </div>
    </th>
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4" />
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Source Quality Scoreboard</h2>
        <span className="text-sm text-gray-500">
          {scoreboard.length} source{scoreboard.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader field="tier" label="Tier" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source Channel
              </th>
              <SortHeader field="qualityScore" label="Quality Score" />
              <SortHeader field="totalApplications" label="Applications" />
              <SortHeader field="conversionRate" label="Conversion" />
              <SortHeader field="retention90Day" label="90-Day Retention" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Completion Rate
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedScoreboard.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  <p className="text-sm">No data available for this period</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Try adjusting your filters or waiting for more data
                  </p>
                </td>
              </tr>
            ) : (
              sortedScoreboard.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getTierBadge(item.tier)}
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatSourceChannel(item.sourceChannel)}
                      </p>
                      <p className="text-xs text-gray-500">{item.sourceChannel}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold ${getQualityScoreColor(item.qualityScore)}`}>
                      {item.qualityScore}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {item.totalApplications.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.onboardedCount} onboarded
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, item.conversionRate)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-700">
                        {item.conversionRate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, item.retention90Day)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-700">
                        {item.retention90Day.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">
                      {item.avgCompletionRate30Day.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => onViewDetail(item.sourceChannel)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      {sortedScoreboard.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-t text-sm text-gray-600">
          <div className="flex items-center gap-6">
            <span>
              <strong className="text-gray-900">{sortedScoreboard.filter(s => s.tier === 'GOLD').length}</strong> Gold sources
            </span>
            <span>
              <strong className="text-gray-900">{sortedScoreboard.filter(s => s.tier === 'SILVER').length}</strong> Silver sources
            </span>
            <span>
              <strong className="text-gray-900">{sortedScoreboard.filter(s => s.tier === 'BRONZE').length}</strong> Bronze sources
            </span>
            <span className="ml-auto text-xs text-gray-500">
              Quality scores updated daily from OpsTower performance data
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
