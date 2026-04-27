import { useQuery } from '@tanstack/react-query';
import { predictionsApi } from '@/shared/lib/api';
import { Brain, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { QualityScoreCard } from './QualityScoreCard';
import { DropOffRiskCard } from './DropOffRiskCard';
import { ChurnRiskCard } from './ChurnRiskCard';
import { OptimalContactCard } from './OptimalContactCard';
import { PredictionExplanationModal } from './PredictionExplanationModal';

interface Props {
  candidateId: string;
}

interface MLPrediction {
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

export function PredictionsPanel({ candidateId }: Props) {
  const [selectedPrediction, setSelectedPrediction] = useState<MLPrediction | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['predictions', candidateId],
    queryFn: async () => {
      const response = await predictionsApi.getCandidatePredictions(candidateId);
      return response.data;
    },
    enabled: !!candidateId,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const predictions: MLPrediction[] = data?.predictions || [];

  const findPrediction = (type: string): MLPrediction | undefined => {
    return predictions.find((p) => p.type === type);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI Predictions</h2>
        </div>
        <span className="text-xs text-gray-500">
          Generated: {new Date(data?.generatedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Prediction Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pre-Hire Quality */}
        <QualityScoreCard
          prediction={findPrediction('PRE_HIRE_QUALITY')}
          onExplain={() => setSelectedPrediction(findPrediction('PRE_HIRE_QUALITY') || null)}
        />

        {/* Drop-Off Risk */}
        <DropOffRiskCard
          prediction={findPrediction('DROP_OFF_RISK')}
          onExplain={() => setSelectedPrediction(findPrediction('DROP_OFF_RISK') || null)}
        />

        {/* Time to Onboard */}
        <div
          onClick={() => setSelectedPrediction(findPrediction('TIME_TO_ONBOARD') || null)}
          className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">Time to Onboard</span>
            </div>
            <span className="text-xs text-gray-400">ML-03</span>
          </div>
          {findPrediction('TIME_TO_ONBOARD') ? (
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {findPrediction('TIME_TO_ONBOARD')?.value} days
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Estimated completion time
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Not available</p>
          )}
        </div>

        {/* Zone-Role Fit */}
        <div
          onClick={() => setSelectedPrediction(findPrediction('ZONE_ROLE_FIT') || null)}
          className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">Zone-Role Fit</span>
            </div>
            <span className="text-xs text-gray-400">ML-04</span>
          </div>
          {findPrediction('ZONE_ROLE_FIT') ? (
            <div>
              <p className="text-lg font-bold text-gray-900">
                {findPrediction('ZONE_ROLE_FIT')?.value}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Recommended assignment
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Not available</p>
          )}
        </div>

        {/* Optimal Contact Time */}
        <OptimalContactCard
          prediction={findPrediction('OPTIMAL_CONTACT_TIME')}
          onExplain={() => setSelectedPrediction(findPrediction('OPTIMAL_CONTACT_TIME') || null)}
        />

        {/* Churn Risk - Only for onboarded drivers */}
        <ChurnRiskCard
          prediction={findPrediction('CHURN_RISK')}
          onExplain={() => setSelectedPrediction(findPrediction('CHURN_RISK') || null)}
        />
      </div>

      {/* ML Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">AI-Powered Insights</p>
            <p className="text-amber-700 mt-1">
              These predictions are generated by machine learning models and require human review.
              All recommendations must be confirmed by a recruiter before taking action.
              Models require 90-180 days of data for optimal accuracy.
            </p>
          </div>
        </div>
      </div>

      {/* Explanation Modal */}
      {selectedPrediction && (
        <PredictionExplanationModal
          prediction={selectedPrediction}
          onClose={() => setSelectedPrediction(null)}
        />
      )}
    </div>
  );
}
