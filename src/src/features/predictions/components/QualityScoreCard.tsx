import { Star, HelpCircle } from 'lucide-react';

interface Prediction {
  type: string;
  value: string | number;
  confidence: number;
  explanation: string;
  factors: Array<{
    factor: string;
    contribution: string;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
  recommendation: string;
}

interface Props {
  prediction?: Prediction;
  onExplain: () => void;
}

export function QualityScoreCard({ prediction, onExplain }: Props) {
  if (!prediction) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 opacity-60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-500">Pre-Hire Quality</span>
          </div>
          <span className="text-xs text-gray-400">ML-01</span>
        </div>
        <p className="text-sm text-gray-400">Prediction not available</p>
      </div>
    );
  }

  const score = typeof prediction.value === 'number' ? prediction.value : parseInt(prediction.value as string) || 0;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Average';
    return 'Needs Review';
  };

  return (
    <div
      onClick={onExplain}
      className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium text-gray-700">Pre-Hire Quality</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">ML-01</span>
          <button className="text-gray-400 hover:text-gray-600">
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${getScoreColor(score)}`}>
          <span className="text-xl font-bold">{score}</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{getScoreLabel(score)}</p>
          <p className="text-sm text-gray-500">
            Confidence: {Math.round(prediction.confidence * 100)}%
          </p>
          <div className="mt-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              prediction.recommendation === 'PRIORITY_REVIEW' 
                ? 'bg-purple-100 text-purple-800'
                : prediction.recommendation === 'FAST_TRACK'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {prediction.recommendation.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
