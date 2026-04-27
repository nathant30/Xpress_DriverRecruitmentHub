import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Plus,
  Settings,
  Eye,
  Save,
  GripVertical
} from 'lucide-react';
import { flowBuilderApi } from '@/shared/lib/api';

const STEP_TYPES = [
  { id: 'WELCOME', label: 'Welcome / Introduction', icon: '👋' },
  { id: 'SERVICE_TYPE_SELECTION', label: 'Service Type Selection', icon: '🚗' },
  { id: 'ZONE_SELECTION', label: 'Zone Selection', icon: '📍' },
  { id: 'PERSONAL_DETAILS', label: 'Personal Details', icon: '📝' },
  { id: 'DOCUMENT_UPLOAD', label: 'Document Upload', icon: '📄' },
  { id: 'VEHICLE_DETAILS', label: 'Vehicle Details', icon: '🏍️' },
  { id: 'AVAILABILITY_SHIFT', label: 'Availability', icon: '⏰' },
  { id: 'EMERGENCY_CONTACT', label: 'Emergency Contact', icon: '🚨' },
  { id: 'BANK_PAYMENT_DETAILS', label: 'Bank Details', icon: '💳' },
  { id: 'QUIZ_KNOWLEDGE', label: 'Knowledge Check', icon: '❓' },
  { id: 'DECLARATIONS_AGREEMENTS', label: 'Declarations', icon: '✅' },
  { id: 'E_SIGNATURE', label: 'E-Signature', icon: '✍️' },
];

export function FlowBuilderPage() {
  const [selectedStep, setSelectedStep] = useState<any>(null);
  
  const { data: activeFlow, isLoading } = useQuery({
    queryKey: ['active-flow'],
    queryFn: () => flowBuilderApi.getActiveFlow().then((res) => res.data),
  });

  const steps = activeFlow?.versions?.[0]?.steps || [];

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Application Flow Builder</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure the candidate application experience
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary">
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </button>
          <button className="btn-primary">
            <Save className="w-4 h-4 mr-2" />
            Publish Changes
          </button>
        </div>
      </div>

      {/* Builder Layout */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        {/* Step Library */}
        <div className="col-span-3 card overflow-hidden">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Step Library</h3>
          </div>
          <div className="card-body p-0 overflow-y-auto">
            <div className="divide-y divide-gray-100">
              {STEP_TYPES.map((stepType) => (
                <button
                  key={stepType.id}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-xl">{stepType.icon}</span>
                  <span className="text-sm text-gray-700">{stepType.label}</span>
                  <Plus className="w-4 h-4 ml-auto text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Flow Canvas */}
        <div className="col-span-6 card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Flow Steps</h3>
            <span className="text-sm text-gray-500">
              Version {activeFlow?.versions?.[0]?.versionNumber || 1}
            </span>
          </div>
          <div className="card-body overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : steps.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No steps yet. Add steps from the library.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step: any, index: number) => (
                  <button
                    key={step.id}
                    onClick={() => setSelectedStep(step)}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border text-left transition-colors ${
                      selectedStep?.id === step.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{step.title}</p>
                      <p className="text-xs text-gray-500">
                        {STEP_TYPES.find((t) => t.id === step.stepType)?.label || step.stepType}
                      </p>
                    </div>
                    <Settings className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Properties Panel */}
        <div className="col-span-3 card overflow-hidden">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Properties</h3>
          </div>
          <div className="card-body overflow-y-auto">
            {selectedStep ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Step Title</label>
                  <input
                    type="text"
                    className="input"
                    defaultValue={selectedStep.title}
                  />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    className="input"
                    rows={3}
                    defaultValue={selectedStep.description}
                  />
                </div>
                <div>
                  <label className="label">Conditions</label>
                  <p className="text-sm text-gray-500">
                    Configure when this step is shown
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Select a step to edit its properties</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
