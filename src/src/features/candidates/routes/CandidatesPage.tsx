import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  Filter, 
  Plus,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { candidatesApi } from '@/shared/lib/api';
import { format } from 'date-fns';

const STAGE_BADGES: Record<string, string> = {
  APPLICATION: 'badge-gray',
  SCREENING: 'badge-blue',
  DOCS_SUBMITTED: 'badge-yellow',
  DOCS_VERIFIED: 'badge-blue',
  BACKGROUND_CHECK: 'badge-purple',
  TRAINING: 'badge-indigo',
  VEHICLE_INSPECTION: 'badge-orange',
  CONTRACT_SIGNING: 'badge-green',
  ONBOARDED: 'badge-green',
  REJECTED: 'badge-red',
  WITHDRAWN: 'badge-gray',
};

export function CandidatesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, _setFilters] = useState<Record<string, any>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['candidates', { page, search, ...filters }],
    queryFn: () => candidatesApi.getAll({ 
      page, 
      limit: 20,
      ...(search && { search }),
      ...filters,
    }).then((res) => res.data),
  });

  const candidates = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Candidates</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

      {/* Candidates Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Candidate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zone / Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applied
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No candidates found
                  </td>
                </tr>
              ) : (
                candidates.map((candidate: any) => (
                  <tr 
                    key={candidate.id} 
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/candidates/${candidate.id}`} className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                          <span className="text-sm font-medium text-primary-700">
                            {candidate.fullName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {candidate.fullName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {candidate.sourceChannel.replace('_', ' ')}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {candidate.phonePrimary}
                      </div>
                      {candidate.email && (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <Mail className="w-3 h-3" />
                          {candidate.email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {candidate.zone?.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {candidate.serviceType}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge ${STAGE_BADGES[candidate.currentStage] || 'badge-gray'}`}>
                        {candidate.currentStage.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {candidate.assignedRecruiter?.fullName || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(candidate.createdAt), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} candidates
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary px-3 py-1.5 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="btn-secondary px-3 py-1.5 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
