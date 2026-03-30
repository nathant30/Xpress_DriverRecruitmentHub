import { X, Lightbulb, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from 'lucide-react';

interface Factor {
  factor: string;
  contribution: string;
  impact: 'positive' | 'negative' | 'neutral';
}

interface Prediction {
  type: string;
  value: string | number;
  confidence: number;
  explanation: string;
  factors: Factor[];
  recommendation: string;
}

interface Props {
  prediction: Prediction;
  onClose: () => void;
}

export function PredictionExplanationModal({ prediction, onClose }: Props) {
  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'negative':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive':
        return 'text-green-600 bg-green-50';
      case 'negative':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatPredictionType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {formatPredictionType(prediction.type)}
            </h3>
            <p className="text-sm text-gray-500">
              Confidence: {Math.round(prediction.confidence * 100)}%
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Prediction Value */}
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-1">Prediction Result</p>
            <p className="text-2xl font-bold text-gray-900">
              {typeof prediction.value === 'number' ? prediction.value : prediction.value}
            </p>
          </div>

          {/* Explanation */}
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-2">Explanation</p>
            <p className="text-gray-700">{prediction.explanation}</p>
          </div>

          {/* Contributing Factors */}
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-3">Contributing Factors</p>
            <div className="space-y-2">
              {prediction.factors.map((factor, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg ${getImpactColor(factor.impact)}`}
                >
                  <div className="flex items-center gap-3">
                    {getImpactIcon(factor.impact)}
                    <span className="font-medium">{factor.factor}</span>
                  </div>
                  <span className="font-bold">{factor.contribution}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Recommended Action</p>
                <p className="text-sm text-blue-700 mt-1">
                  {prediction.recommendation.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-gray-500">
              This prediction is AI-generated and requires human confirmation. 
              Review the factors before making any decisions.
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
