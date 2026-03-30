import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  Target, 
  Tablet,
  FileText,
  Bell
} from 'lucide-react';
import { settingsApi } from '@/shared/lib/api';

const SETTINGS_TABS = [
  { id: 'headcount', label: 'Headcount Targets', icon: Target },
  { id: 'campaigns', label: 'Driver App Campaigns', icon: Bell },
  { id: 'kiosks', label: 'Kiosk Devices', icon: Tablet },
  { id: 'documents', label: 'Document Requirements', icon: FileText },
  { id: 'users', label: 'Users & Permissions', icon: Users },
];

function HeadcountTargets() {
  const { data: targets } = useQuery({
    queryKey: ['headcount-targets'],
    queryFn: () => settingsApi.getHeadcountTargets().then((res) => res.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Headcount Targets</h3>
        <button className="btn-primary">Add Target</button>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {targets?.map((target: any) => (
              <tr key={target.id}>
                <td className="px-6 py-4 text-sm text-gray-900">{target.zone?.name}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{target.serviceType}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{target.targetCount}</td>
                <td className="px-6 py-4">
                  <span className={`badge ${target.recruitingStatus === 'ACTIVELY_RECRUITING' ? 'badge-green' : target.recruitingStatus === 'PAUSED' ? 'badge-yellow' : 'badge-red'}`}>
                    {target.recruitingStatus.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="text-primary-600 hover:text-primary-700 text-sm">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DriverAppCampaigns() {
  const { data: campaigns } = useQuery({
    queryKey: ['driver-app-campaigns'],
    queryFn: () => settingsApi.getDriverAppCampaigns().then((res) => res.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Driver App Campaigns</h3>
        <button className="btn-primary">Create Campaign</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns?.map((campaign: any) => (
          <div key={campaign.id} className="card">
            <div className="card-body">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{campaign.headline}</h4>
                  <p className="text-sm text-gray-600 mt-1">{campaign.body}</p>
                </div>
                <span className={`badge ${campaign.isActive ? 'badge-green' : 'badge-gray'}`}>
                  {campaign.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                <p>Zone: {campaign.zone?.name}</p>
                <p>Service: {campaign.serviceType}</p>
                <p>Expires: {new Date(campaign.expiresAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KioskDevices() {
  const { data: devices } = useQuery({
    queryKey: ['kiosk-devices'],
    queryFn: () => settingsApi.getKioskDevices().then((res) => res.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Kiosk Devices</h3>
        <button className="btn-primary">Register Device</button>
      </div>

      <div className="card">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pairing Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {devices?.map((device: any) => (
              <tr key={device.id}>
                <td className="px-6 py-4 text-sm text-gray-900">{device.deviceName}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{device.zone?.name}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{device.mode.replace('_', ' ')}</td>
                <td className="px-6 py-4">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">{device.deviceCode}</code>
                </td>
                <td className="px-6 py-4">
                  <span className={`badge ${device.isActive ? 'badge-green' : 'badge-gray'}`}>
                    {device.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('headcount');

  const renderContent = () => {
    switch (activeTab) {
      case 'headcount':
        return <HeadcountTargets />;
      case 'campaigns':
        return <DriverAppCampaigns />;
      case 'kiosks':
        return <KioskDevices />;
      default:
        return (
          <div className="text-center py-12 text-gray-500">
            <p>This section is under development</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
