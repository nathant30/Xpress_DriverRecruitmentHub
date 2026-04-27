import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { candidatesApi, settingsApi } from '@/shared/lib/api';

const SOURCE_CHANNELS = [
  { value: 'WEBSITE_ORGANIC', label: 'Website (Organic)' },
  { value: 'JOBBoard', label: 'Job Board' },
  { value: 'SOCIAL_AD', label: 'Social Media Ad' },
  { value: 'DRIVER_APP', label: 'Driver App' },
  { value: 'FO_REFERRAL', label: 'Field Operator Referral' },
  { value: 'DRIVER_REFERRAL', label: 'Driver Referral' },
  { value: 'WALK_IN', label: 'Walk-in' },
  { value: 'LGU_PARTNER', label: 'LGU Partner' },
  { value: 'AGENCY', label: 'Recruitment Agency' },
];

const SERVICE_TYPES = [
  { value: 'MOTO', label: 'Motorcycle (Moto)' },
  { value: 'SEDAN_SUV', label: 'Sedan/SUV (TNVS)' },
  { value: 'TAXI', label: 'Taxi' },
  { value: 'ETRIKE', label: 'E-Trike' },
  { value: 'DELIVERY', label: 'Delivery' },
];

export function NewCandidatePage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    phonePrimary: '',
    phoneSecondary: '',
    email: '',
    address: '',
    zoneId: '',
    serviceType: 'MOTO',
    sourceChannel: 'WEBSITE_ORGANIC',
    notes: '',
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => settingsApi.getZones().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: candidatesApi.create,
    onSuccess: (response) => {
      navigate(`/candidates/${response.data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <button 
        onClick={() => navigate('/candidates')}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to candidates
      </button>

      <div className="card">
        <div className="card-header">
          <h1 className="text-xl font-semibold text-gray-900">Add New Candidate</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter the candidate's information to create their profile
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-body space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider">
              Personal Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Juan Dela Cruz"
                />
              </div>

              <div>
                <label className="label">Primary Phone *</label>
                <input
                  type="tel"
                  required
                  className="input"
                  value={formData.phonePrimary}
                  onChange={(e) => setFormData({ ...formData, phonePrimary: e.target.value })}
                  placeholder="0917XXXXXXX"
                />
              </div>

              <div>
                <label className="label">Secondary Phone</label>
                <input
                  type="tel"
                  className="input"
                  value={formData.phoneSecondary}
                  onChange={(e) => setFormData({ ...formData, phoneSecondary: e.target.value })}
                  placeholder="Optional"
                />
              </div>

              <div className="col-span-2">
                <label className="label">Email Address</label>
                <input
                  type="email"
                  className="input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Optional"
                />
              </div>

              <div className="col-span-2">
                <label className="label">Current Address *</label>
                <textarea
                  required
                  rows={2}
                  className="input"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full address including barangay"
                />
              </div>
            </div>
          </div>

          {/* Application Details */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider">
              Application Details
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Zone *</label>
                <select
                  required
                  className="input"
                  value={formData.zoneId}
                  onChange={(e) => setFormData({ ...formData, zoneId: e.target.value })}
                >
                  <option value="">Select zone</option>
                  {zones?.map((zone: any) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Service Type *</label>
                <select
                  required
                  className="input"
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                >
                  {SERVICE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="label">Source Channel *</label>
                <select
                  required
                  className="input"
                  value={formData.sourceChannel}
                  onChange={(e) => setFormData({ ...formData, sourceChannel: e.target.value })}
                >
                  {SOURCE_CHANNELS.map((channel) => (
                    <option key={channel.value} value={channel.value}>
                      {channel.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="pt-4 border-t border-gray-200">
            <label className="label">Notes</label>
            <textarea
              rows={3}
              className="input"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional information about the candidate..."
            />
          </div>

          {/* Error message */}
          {createMutation.isError && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
              {(createMutation.error as any)?.response?.data?.error || 'Failed to create candidate'}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/candidates')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Candidate'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
