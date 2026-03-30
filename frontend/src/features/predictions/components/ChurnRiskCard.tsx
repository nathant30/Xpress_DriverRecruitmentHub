import { UserX, AlertOctagon, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

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

export function ChurnRiskCard({ prediction, onExplain }: Props) {
  // If no prediction, show placeholder (only available for onboarded drivers)
  if (!prediction) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 opacity-60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UserX className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">Churn Risk</span>
          </div>
          <span className="text-xs text-gray-400">ML-10</span>
        </div>
        <p className="text-sm text-gray-400">Only available for onboarded drivers</p>
      </div>
    );
  }

  const risk = prediction.value as string;

  const getRiskConfig = (risk: string) => {
    switch (risk) {
      case 'HIGH':
        return {
          icon: AlertOctagon,
          color: 'text-red-600 bg-red-50 border-red-200',
          label: 'High Churn Risk',
          description: 'At-risk driver - retention action needed',
        };
      case 'MEDIUM':
        return {
          icon: AlertTriangle,
          color: 'text-amber-600 bg-amber-50 border-amber-200',
          label: 'Medium Churn Risk',
          description: 'Monitor engagement',
        };
      default:
        return {
          icon: CheckCircle,
          color: 'text-green-600 bg-green-50 border-green-200',
          label: 'Low Churn Risk',
          description: 'Stable driver',
        };
    }
  };

  const config = getRiskConfig(risk);
  const Icon = config.icon;

  return (
    <div
      onClick={onExplain}
      className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <UserX className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium text-gray-700">Churn Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">ML-10</span>
          <button className="text-gray-400 hover:text-gray-600">
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${config.color}`}>
          <Icon className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{config.label}</p>
          <p className="text-sm text-gray-500">
            Confidence: {Math.round(prediction.confidence * 100)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">{config.description}</p>
        </div>
      </div>
    </div>
  );
}
