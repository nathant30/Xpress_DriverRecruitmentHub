import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SourceQualityItem {
  id: string;
  sourceChannel: string;
  qualityScore: number;
  conversionRate: number;
  retention90Day: number;
}

interface Props {
  scoreboard: SourceQualityItem[];
  isLoading: boolean;
}

export function TrendChart({ scoreboard, isLoading }: Props) {
  // Mock trend data - in production this would come from API
  const trendData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month) => ({
      month,
      score: Math.floor(Math.random() * 30) + 50, // Random between 50-80
    }));
  }, []);

  const avgScore = Math.round(
    scoreboard.reduce((sum, s) => sum + s.qualityScore, 0) / (scoreboard.length || 1)
  );

  const prevAvgScore = avgScore - Math.floor(Math.random() * 10) + 5; // Mock previous
  const trend = avgScore - prevAvgScore;

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="animate-pulse flex space-x-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 w-12 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold text-gray-900">{avgScore}</span>
          <span className="text-sm text-gray-500">avg. quality score</span>
        </div>
        <div className="flex items-center gap-2">
          {trend > 0 ? (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <TrendingUp className="w-4 h-4" />
              +{trend} from last period
            </span>
          ) : trend < 0 ? (
            <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
              <TrendingDown className="w-4 h-4" />
              {trend} from last period
            </span>
          ) : (
            <span className="flex items-center gap-1 text-gray-500 text-sm font-medium">
              <Minus className="w-4 h-4" />
              No change
            </span>
          )}
        </div>
      </div>

      {/* Simple Bar Chart */}
      <div className="h-48 flex items-end justify-between gap-2">
        {trendData.map((data, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div
              className="w-full bg-blue-500 rounded-t transition-all duration-500 hover:bg-blue-600"
              style={{ height: `${data.score}%` }}
            />
            <span className="text-xs text-gray-500">{data.month}</span>
          </div>
        ))}
      </div>

      {/* Top Performers */}
      <div className="pt-4 border-t">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Top Performing Sources</h4>
        <div className="flex flex-wrap gap-2">
          {scoreboard
            .sort((a, b) => b.qualityScore - a.qualityScore)
            .slice(0, 5)
            .map((source) => (
              <span
                key={source.id}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
              >
                {source.sourceChannel}
                <span className="ml-1.5 text-blue-500">{source.qualityScore}</span>
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
