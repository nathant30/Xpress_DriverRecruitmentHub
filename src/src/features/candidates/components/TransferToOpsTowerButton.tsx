import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ExternalLink
} from 'lucide-react';
import { candidatesApi } from '@/shared/lib/api';

interface TransferToOpsTowerButtonProps {
  candidateId: string;
  currentStage: string;
  opstowerDriverId?: string | null;
  documents: Array<{
    id: string;
    documentType: string;
    status: string;
  }>;
}

export function TransferToOpsTowerButton({
  candidateId,
  currentStage,
  opstowerDriverId,
  documents,
}: TransferToOpsTowerButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const queryClient = useQueryClient();

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status', candidateId],
    queryFn: () => candidatesApi.getSyncStatus(candidateId).then((res) => res.data),
    enabled: !!opstowerDriverId,
  });

  const transferMutation = useMutation({
    mutationFn: () => candidatesApi.transferToOpsTower(candidateId).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
      queryClient.invalidateQueries({ queryKey: ['sync-status', candidateId] });
      setShowConfirm(false);
    },
  });

  // Check if all documents are approved
  const unapprovedDocs = documents.filter(
    (d) => d.status !== 'APPROVED' && d.status !== 'SKIPPED_EXISTING_DRIVER'
  );
  const allDocsApproved = unapprovedDocs.length === 0;

  // Can only transfer from CONTRACT_SIGNING stage
  const canTransfer = currentStage === 'CONTRACT_SIGNING' && allDocsApproved;

  // Already transferred
  if (opstowerDriverId || syncStatus?.isSynced) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-success-50 text-success-700 rounded-lg">
        <CheckCircle2 className="w-5 h-5" />
        <div>
          <p className="text-sm font-medium">Transferred to OpsTower</p>
          <p className="text-xs">
            Driver ID: {opstowerDriverId || syncStatus?.driverId}
          </p>
        </div>
        <a
          href={`https://opstower.xpress.ph/drivers/${opstowerDriverId || syncStatus?.driverId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto p-1 hover:bg-success-100 rounded"
          title="View in OpsTower"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    );
  }

  // Show confirmation modal
  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <ArrowRight className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Transfer to OpsTower
                </h3>
                <p className="text-sm text-gray-500">
                  This will create the driver record in OpsTower
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-success-500" />
                <span className="text-gray-700">All documents approved</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-success-500" />
                <span className="text-gray-700">Personal information verified</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-success-500" />
                <span className="text-gray-700">Contract signed</span>
              </div>
            </div>

            {transferMutation.isError && (
              <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
                {(transferMutation.error as any)?.response?.data?.message || 'Transfer failed. Please try again.'}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-secondary flex-1"
                disabled={transferMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => transferMutation.mutate()}
                disabled={transferMutation.isPending}
                className="btn-primary flex-1"
              >
                {transferMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  <>
                    Confirm Transfer
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Button state
  if (!canTransfer) {
    return (
      <button
        disabled
        className="btn-secondary opacity-50 cursor-not-allowed"
        title={
          currentStage !== 'CONTRACT_SIGNING'
            ? 'Candidate must be in Contract Signing stage'
            : `${unapprovedDocs.length} documents not yet approved`
        }
      >
        <AlertCircle className="w-4 h-4 mr-2" />
        {currentStage !== 'CONTRACT_SIGNING'
          ? 'Not Ready for Transfer'
          : `${unapprovedDocs.length} Docs Pending`}
      </button>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="btn-primary"
    >
      <ArrowRight className="w-4 h-4 mr-2" />
      Transfer to OpsTower
    </button>
  );
}
