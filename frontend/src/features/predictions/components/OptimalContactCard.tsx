import { Clock, Phone, HelpCircle } from 'lucide-react';

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

export function OptimalContactCard({ prediction, onExplain }: Props) {
  if (!prediction) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 opacity-60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-medium text-gray-500">Optimal Contact Time</span>
          </div>
          <span className="text-xs text-gray-400">ML-05</span>
        </div>
        <p className="text-sm text-gray-400">Prediction not available</p>
      </div>
    );
  }

  const timeSlot = prediction.value as string;
  
  // Parse time slot (e.g., "Morning (6AM-10AM)")
  const timeMatch = timeSlot.match(/(\w+)\s*\(([^)]+)\)/);
  const period = timeMatch?.[1] || timeSlot;
  const hours = timeMatch?.[2] || '';

  const getTimeIcon = (period: string) => {
    const p = period.toLowerCase();
    if (p.includes('morning')) return '🌅';
    if (p.includes('afternoon')) return '☀️';
    if (p.includes('evening')) return '🌆';
    if (p.includes('night')) return '🌙';
    return '🕐';
  };

  return (
    <div
      onClick={onExplain}
      className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-gray-700">Optimal Contact Time</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">ML-05</span>
          <button className="text-gray-400 hover:text-gray-600">
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center text-2xl">
          {getTimeIcon(period)}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{period}</p>
          {hours && (
            <p className="text-sm text-indigo-600 font-medium">{hours}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Confidence: {Math.round(prediction.confidence * 100)}%
          </p>
        </div>
        <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100">
          <Phone className="w-4 h-4" />
          Call Now
        </button>
      </div>
    </div>
  );
}
