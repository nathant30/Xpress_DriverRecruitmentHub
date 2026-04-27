import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { candidatesApi } from '@/shared/lib/api';

const PIPELINE_STAGES = [
  { id: 'APPLICATION', label: 'Application', color: 'bg-gray-100' },
  { id: 'SCREENING', label: 'Screening', color: 'bg-blue-50' },
  { id: 'DOCS_SUBMITTED', label: 'Docs Submitted', color: 'bg-yellow-50' },
  { id: 'DOCS_VERIFIED', label: 'Docs Verified', color: 'bg-blue-50' },
  { id: 'BACKGROUND_CHECK', label: 'Background Check', color: 'bg-purple-50' },
  { id: 'TRAINING', label: 'Training', color: 'bg-indigo-50' },
  { id: 'VEHICLE_INSPECTION', label: 'Vehicle Inspection', color: 'bg-orange-50' },
  { id: 'CONTRACT_SIGNING', label: 'Contract Signing', color: 'bg-green-50' },
];

const SERVICE_TYPE_BADGES: Record<string, { label: string; color: string }> = {
  MOTO: { label: 'Moto', color: 'badge-blue' },
  SEDAN_SUV: { label: 'TNVS', color: 'badge-purple' },
  TAXI: { label: 'Taxi', color: 'badge-green' },
  ETRIKE: { label: 'e-Trike', color: 'badge-yellow' },
  DELIVERY: { label: 'Delivery', color: 'badge-gray' },
};

const SOURCE_ICONS: Record<string, string> = {
  WEBSITE_ORGANIC: '🌐',
  JOBBoard: '💼',
  SOCIAL_AD: '📱',
  DRIVER_APP: '🚗',
  FO_REFERRAL: '👤',
  DRIVER_REFERRAL: '🎁',
  WALK_IN: '🚶',
};

interface CandidateCardProps {
  candidate: any;
}

function CandidateCard({ candidate }: CandidateCardProps) {
  const slaStatus = candidate.daysInStage > 5 ? 'red' : candidate.daysInStage > 3 ? 'amber' : 'green';
  
  const docProgress = candidate.documentProgress || { total: 0, approved: 0 };
  const docPercent = docProgress.total > 0 
    ? Math.round((docProgress.approved / docProgress.total) * 100) 
    : 0;

  return (
    <Link 
      to={`/candidates/${candidate.id}`}
      className="block bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 line-clamp-1">{candidate.fullName}</h4>
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="text-gray-400 hover:text-gray-600"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`badge ${SERVICE_TYPE_BADGES[candidate.serviceType]?.color || 'badge-gray'}`}>
          {SERVICE_TYPE_BADGES[candidate.serviceType]?.label || candidate.serviceType}
        </span>
        <span className="text-xs text-gray-500">{candidate.zone.name}</span>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1" title="Source">
          {SOURCE_ICONS[candidate.sourceChannel] || '📋'}
        </span>
        {candidate.isExistingDriver && (
          <span className="badge-blue text-xs px-1.5 py-0.5 rounded">
            Existing Driver
          </span>
        )}
      </div>

      {/* Document progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Documents</span>
          <span className={docPercent < 50 ? 'text-danger-600' : docPercent < 100 ? 'text-warning-600' : 'text-success-600'}>
            {docProgress.approved}/{docProgress.total}
          </span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${docPercent === 100 ? 'bg-success-500' : docPercent > 50 ? 'bg-warning-500' : 'bg-danger-500'}`}
            style={{ width: `${docPercent}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          {slaStatus === 'green' ? (
            <Clock className="w-3.5 h-3.5 text-success-500" />
          ) : slaStatus === 'amber' ? (
            <AlertCircle className="w-3.5 h-3.5 text-warning-500" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-danger-500" />
          )}
          <span className={`text-xs ${slaStatus === 'red' ? 'text-danger-600' : 'text-gray-500'}`}>
            Day {candidate.daysInStage || 1}
          </span>
        </div>
        
        {candidate.assignedRecruiter && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-xs font-medium text-primary-700">
                {candidate.assignedRecruiter.fullName.charAt(0)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

export function PipelinePage() {
  const [selectedStage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: candidatesData, isLoading } = useQuery({
    queryKey: ['candidates', { stage: selectedStage }],
    queryFn: () => candidatesApi.getAll({ 
      limit: 100,
      ...(selectedStage && { stage: selectedStage }),
    }).then((res) => res.data),
  });

  const candidates = candidatesData?.data || [];

  // Group candidates by stage
  const candidatesByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.id] = candidates.filter((c: any) => c.currentStage === stage.id);
    return acc;
  }, {} as Record<string, any[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Pipeline</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search candidates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 w-64"
            />
          </div>
          <button className="btn-secondary">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </button>
          <Link to="/candidates/new" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Candidate
          </Link>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {PIPELINE_STAGES.map((stage) => {
            const stageCandidates = candidatesByStage[stage.id] || [];
            const filteredCandidates = searchQuery
              ? stageCandidates.filter((c: any) => 
                  c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  c.phonePrimary.includes(searchQuery)
                )
              : stageCandidates;

            return (
              <div 
                key={stage.id} 
                className="w-80 flex-shrink-0"
              >
                {/* Column Header */}
                <div className={`${stage.color} rounded-t-lg px-4 py-3 border-b-2 border-gray-200`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{stage.label}</h3>
                    <span className="badge-gray">
                      {filteredCandidates.length}
                    </span>
                  </div>
                </div>

                {/* Column Content */}
                <div className="bg-gray-50 rounded-b-lg p-3 min-h-[400px] space-y-3">
                  {filteredCandidates.map((candidate: any) => (
                    <CandidateCard key={candidate.id} candidate={candidate} />
                  ))}
                  
                  {filteredCandidates.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">No candidates</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
