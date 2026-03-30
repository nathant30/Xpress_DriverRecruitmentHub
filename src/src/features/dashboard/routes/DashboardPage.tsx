import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  UserCheck, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  Filter
} from 'lucide-react';
import { dashboardApi } from '@/shared/lib/api';
import { formatDistanceToNow } from 'date-fns';

// Widget components
function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  color = 'blue' 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: any;
  trend?: { value: number; isPositive: boolean };
  color?: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-primary-50 text-primary-700',
    green: 'bg-success-50 text-success-700',
    yellow: 'bg-warning-50 text-warning-700',
    red: 'bg-danger-50 text-danger-700',
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend.isPositive ? 'text-success-600' : 'text-danger-600'}`}>
              <TrendingUp className={`w-4 h-4 ${!trend.isPositive && 'rotate-180'}`} />
              <span>{trend.value}% {trend.isPositive ? 'increase' : 'decrease'}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function PipelineStageCard({ stage, count, total }: { stage: string; count: number; total: number }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  
  const stageLabels: Record<string, string> = {
    APPLICATION: 'Application',
    SCREENING: 'Screening',
    DOCS_SUBMITTED: 'Docs Submitted',
    DOCS_VERIFIED: 'Docs Verified',
    BACKGROUND_CHECK: 'Background Check',
    TRAINING: 'Training',
    VEHICLE_INSPECTION: 'Vehicle Inspection',
    CONTRACT_SIGNING: 'Contract Signing',
  };

  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{stageLabels[stage] || stage}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{percentage}%</span>
        </div>
      </div>
      <span className="text-lg font-semibold text-gray-900">{count}</span>
    </div>
  );
}

function RecentCandidateCard({ candidate }: { candidate: any }) {
  const sourceLabels: Record<string, string> = {
    WEBSITE_ORGANIC: 'Website',
    JOBBoard: 'Job Board',
    SOCIAL_AD: 'Social Ad',
    DRIVER_APP: 'Driver App',
    FO_REFERRAL: 'FO Referral',
    DRIVER_REFERRAL: 'Driver Referral',
    WALK_IN: 'Walk-in',
  };

  const stageColors: Record<string, string> = {
    APPLICATION: 'badge-gray',
    SCREENING: 'badge-blue',
    DOCS_SUBMITTED: 'badge-yellow',
    DOCS_VERIFIED: 'badge-blue',
    BACKGROUND_CHECK: 'badge-yellow',
    TRAINING: 'badge-blue',
    CONTRACT_SIGNING: 'badge-green',
    ONBOARDED: 'badge-green',
  };

  return (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-sm font-medium text-primary-700">
            {candidate.fullName.charAt(0)}
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{candidate.fullName}</p>
          <p className="text-xs text-gray-500">
            {candidate.zone.name} • {sourceLabels[candidate.sourceChannel] || candidate.sourceChannel}
          </p>
        </div>
      </div>
      <div className="text-right">
        <span className={`badge ${stageColors[candidate.currentStage] || 'badge-gray'}`}>
          {candidate.currentStage.replace('_', ' ')}
        </span>
        <p className="text-xs text-gray-500 mt-1">
          {formatDistanceToNow(new Date(candidate.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getDashboard().then((res) => res.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const { pipeline, recentCandidates, slaBreaches, headcount, channels } = dashboardData || {};
  const totalActive = pipeline?.totalActive || 0;
  const conversionRate = pipeline?.conversionRates?.applicationToOnboarded || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <button className="btn-secondary">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Candidates"
          value={totalActive}
          subtitle="In pipeline"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Conversion Rate"
          value={`${conversionRate}%`}
          subtitle="Application to onboarded"
          icon={TrendingUp}
          color="green"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="SLA Breaches"
          value={slaBreaches?.length || 0}
          subtitle="Needs attention"
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          title="Avg. Time to Onboard"
          value="14 days"
          subtitle="Last 30 days"
          icon={Clock}
          color="yellow"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Funnel */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Pipeline Funnel</h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {pipeline?.stageCounts && Object.entries(pipeline.stageCounts).map(([stage, count]) => (
                <PipelineStageCard 
                  key={stage} 
                  stage={stage} 
                  count={count as number} 
                  total={totalActive} 
                />
              ))}
            </div>
          </div>
        </div>

        {/* Recent Candidates */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Recent Candidates</h3>
          </div>
          <div className="card-body p-0">
            <div className="divide-y divide-gray-100">
              {recentCandidates?.map((candidate: any) => (
                <RecentCandidateCard key={candidate.id} candidate={candidate} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SLA Breaches */}
      {slaBreaches && slaBreaches.length > 0 && (
        <div className="card border-danger-200">
          <div className="card-header bg-danger-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-danger-600" />
              <h3 className="text-lg font-semibold text-danger-900">SLA Breaches</h3>
            </div>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="pb-3">Candidate</th>
                    <th className="pb-3">Stage</th>
                    <th className="pb-3">Days in Stage</th>
                    <th className="pb-3">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {slaBreaches.slice(0, 5).map((breach: any) => (
                    <tr key={breach.id}>
                      <td className="py-3 text-sm font-medium text-gray-900">{breach.fullName}</td>
                      <td className="py-3 text-sm text-gray-600">{breach.currentStage}</td>
                      <td className="py-3 text-sm text-danger-600 font-medium">{breach.daysInStage} days</td>
                      <td className="py-3 text-sm text-gray-500">{breach.slaDays} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Acquisition Channels */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Acquisition Channels (Last 30 days)</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {channels?.map((channel: any) => (
              <div key={channel.channel} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{channel.count}</p>
                <p className="text-sm text-gray-600 mt-1">{channel.channel.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
