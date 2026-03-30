import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Star, Target, Clock, Users } from 'lucide-react';

interface Props {
  period: string;
}

interface RecruiterPerformance {
  recruiterId: string;
  recruiterName: string;
  totalAssignments: number;
  onboarded: number;
  conversionRate: number;
  avgTimeToOnboard: number;
  avgQualityScore: number;
  candidateSatisfaction: number;
}

export function RecruiterPerformanceTable({ period }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'recruiter-performance', period],
    queryFn: async () => {
      const response = await api.get(`/analytics/recruiter-performance?period=${period}`);
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const recruiters: RecruiterPerformance[] = data?.recruiters || [];

  const getStars = (rating: number) => {
    const fullStars = Math.floor(rating / 20);
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${i < fullStars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Recruiter Performance</h2>
        <p className="text-sm text-gray-500 mt-1">
          Individual recruiter metrics for the selected period
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Recruiter
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Assignments
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  Conversion
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Avg. Time to Onboard
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quality Score
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Satisfaction
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {recruiters.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <p className="text-sm">No recruiter data available</p>
                </td>
              </tr>
            ) : (
              recruiters.map((recruiter) => (
                <tr key={recruiter.recruiterId} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {recruiter.recruiterName.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {recruiter.recruiterName}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <p className="text-sm text-gray-900">{recruiter.totalAssignments}</p>
                    <p className="text-xs text-gray-500">{recruiter.onboarded} onboarded</p>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full"
                          style={{ width: `${recruiter.conversionRate}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-700">
                        {recruiter.conversionRate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {Math.round(recruiter.avgTimeToOnboard)} days
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold ${
                        recruiter.avgQualityScore >= 70
                          ? 'text-green-600 bg-green-50'
                          : recruiter.avgQualityScore >= 50
                          ? 'text-amber-600 bg-amber-50'
                          : 'text-red-600 bg-red-50'
                      }`}
                    >
                      {recruiter.avgQualityScore}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getStars(recruiter.candidateSatisfaction)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
