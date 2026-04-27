import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  FileText,
  CheckCircle2,
  XCircle,
  MoreHorizontal
} from 'lucide-react';
import { candidatesApi } from '@/shared/lib/api';
import { TransferToOpsTowerButton } from '../components/TransferToOpsTowerButton';
import { PredictionsPanel } from '@/features/predictions/components/PredictionsPanel';
import { format } from 'date-fns';

const STAGE_OPTIONS = [
  { value: 'APPLICATION', label: 'Application' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'DOCS_SUBMITTED', label: 'Docs Submitted' },
  { value: 'DOCS_VERIFIED', label: 'Docs Verified' },
  { value: 'BACKGROUND_CHECK', label: 'Background Check' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'VEHICLE_INSPECTION', label: 'Vehicle Inspection' },
  { value: 'CONTRACT_SIGNING', label: 'Contract Signing' },
  { value: 'ONBOARDED', label: 'Onboarded' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

const DOCUMENT_TYPES: Record<string, string> = {
  GOVERNMENT_ID: 'Government ID',
  DRIVERS_LICENSE: "Driver's License",
  NBI_CLEARANCE: 'NBI Clearance',
  PROOF_OF_ADDRESS: 'Proof of Address',
  VEHICLE_OR_CR: 'Vehicle OR/CR',
  VEHICLE_PHOTO_FRONT: 'Vehicle Photo (Front)',
  VEHICLE_PHOTO_REAR: 'Vehicle Photo (Rear)',
  INSURANCE_CERTIFICATE: 'Insurance Certificate',
  LTFRB_FRANCHISE: 'LTFRB Franchise',
  MEDICAL_CERTIFICATE: 'Medical Certificate',
  DRUG_TEST_RESULT: 'Drug Test Result',
  SELFIE_PHOTO: 'Selfie Photo',
  FOOD_HANDLING_CERTIFICATE: 'Food Handling Certificate',
};

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => candidatesApi.getById(id!).then((res) => res.data),
    enabled: !!id,
  });

  const updateStageMutation = useMutation({
    mutationFn: (data: any) => candidatesApi.updateStage(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate', id] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Candidate not found</p>
        <button onClick={() => navigate('/candidates')} className="btn-primary mt-4">
          Back to Candidates
        </button>
      </div>
    );
  }

  const handleStageChange = (newStage: string) => {
    updateStageMutation.mutate({ stage: newStage });
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button 
        onClick={() => navigate('/candidates')}
        className="flex items-center text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to candidates
      </button>

      {/* Header */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-700">
                  {candidate.fullName.charAt(0)}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{candidate.fullName}</h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {candidate.phonePrimary}
                  </span>
                  {candidate.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {candidate.email}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {candidate.zone?.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={candidate.currentStage}
                onChange={(e) => handleStageChange(e.target.value)}
                className="input"
                disabled={updateStageMutation.isPending}
              >
                {STAGE_OPTIONS.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
              
              {/* Transfer to OpsTower Button */}
              <TransferToOpsTowerButton
                candidateId={candidate.id}
                currentStage={candidate.currentStage}
                opstowerDriverId={candidate.opstowerDriverId}
                documents={candidate.documents || []}
              />
              
              <button className="btn-secondary p-2">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-4 gap-6 mt-6 pt-6 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-500">Service Type</p>
              <p className="font-medium text-gray-900">{candidate.serviceType}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Source</p>
              <p className="font-medium text-gray-900">{candidate.sourceChannel.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Applied</p>
              <p className="font-medium text-gray-900">
                {format(new Date(candidate.createdAt), 'MMM d, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Assigned To</p>
              <p className="font-medium text-gray-900">
                {candidate.assignedRecruiter?.fullName || 'Unassigned'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ML Predictions Panel */}
      <div className="card">
        <div className="card-body">
          <PredictionsPanel candidateId={candidate.id} />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Documents */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documents
            </h3>
          </div>
          <div className="card-body p-0">
            <div className="divide-y divide-gray-100">
              {candidate.documents?.map((doc: any) => (
                <div key={doc.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {DOCUMENT_TYPES[doc.documentType] || doc.documentType}
                    </p>
                    <p className="text-xs text-gray-500">
                      {doc.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.status === 'APPROVED' && (
                      <CheckCircle2 className="w-5 h-5 text-success-500" />
                    )}
                    {doc.status === 'REJECTED' && (
                      <XCircle className="w-5 h-5 text-danger-500" />
                    )}
                    {doc.fileUrl && (
                      <a 
                        href={doc.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 text-sm"
                      >
                        View
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Interaction Log */}
        <div className="card col-span-2">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Activity Log
            </h3>
          </div>
          <div className="card-body">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {candidate.interactionLogs?.map((log: any) => (
                <div key={log.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-gray-600">
                      {log.recruiter.fullName.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {log.recruiter.fullName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(log.loggedAt), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{log.summary}</p>
                    {log.stageBefore !== log.stageAfter && (
                      <p className="text-xs text-primary-600 mt-1">
                        {log.stageBefore} → {log.stageAfter}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
