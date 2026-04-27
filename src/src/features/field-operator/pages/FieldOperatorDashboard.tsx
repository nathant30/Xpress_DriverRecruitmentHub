import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fieldOperatorApi } from '@/shared/lib/api';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
  Users,
  Target,
  QrCode,
  Camera,
  AlertTriangle,
  CheckCircle,
  Navigation,
  Calendar,
  Award,
} from 'lucide-react';

interface DailyTarget {
  targetRegistrations: number;
  targetQualified: number;
  targetOnboarded: number;
  progress: {
    registrations: number;
    qualified: number;
    onboarded: number;
  };
}

interface NearbyZone {
  id: string;
  name: string;
  distance: number;
  recruitmentUrgency: 'HIGH' | 'MEDIUM' | 'LOW';
  headcountTarget: number;
  currentHeadcount: number;
  recentApplications: number;
}

export function FieldOperatorDashboard() {
  const { user } = useAuthStore();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error('Location error:', err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Fetch daily target
  const { data: dailyTarget } = useQuery<DailyTarget>({
    queryKey: ['field-operator', 'daily-target'],
    queryFn: async () => {
      const response = await fieldOperatorApi.getDailyTarget();
      return response.data;
    },
  });

  // Fetch nearby zones
  const { data: nearbyZones } = useQuery<NearbyZone[]>({
    queryKey: ['field-operator', 'nearby-zones', location],
    queryFn: async () => {
      if (!location) return [];
      // nearby zones not yet in r8; fallback to empty until endpoint is added
      return [];
    },
    enabled: !!location,
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (data: { lat?: number; lng?: number; zone_id?: string }) => {
      const response = await fieldOperatorApi.checkIn(data);
      return response.data;
    },
    onSuccess: () => setIsCheckedIn(true),
  });

  const handleCheckIn = () => {
    if (!location) return;
    checkInMutation.mutate({
      lat: location.lat,
      lng: location.lng,
    });
  };

  const handleSOS = () => {
    if (!location) return;
    fieldOperatorApi.sos({
      lat: location.lat,
      lng: location.lng,
      message: 'SAFETY',
    });
    setShowSOSModal(false);
    alert('Emergency alert sent! Help is on the way.');
  };

  const progressPercent = dailyTarget 
    ? Math.round((dailyTarget.progress.registrations / dailyTarget.targetRegistrations) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Mobile Header */}
      <header className="bg-blue-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Field Operator</h1>
            <p className="text-xs text-blue-100">Welcome, {user?.fullName}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isCheckedIn ? (
              <button
                onClick={handleCheckIn}
                className="bg-white text-blue-600 px-3 py-1.5 rounded-lg text-sm font-medium"
              >
                Check In
              </button>
            ) : (
              <span className="flex items-center gap-1 text-sm bg-green-500 px-2 py-1 rounded">
                <CheckCircle className="w-4 h-4" />
                Active
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Daily Target Card */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Today's Target
            </h2>
            <span className="text-sm font-bold text-blue-600">{progressPercent}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {dailyTarget?.progress.registrations || 0}
              </p>
              <p className="text-xs text-gray-500">/ {dailyTarget?.targetRegistrations || 10}</p>
              <p className="text-xs text-gray-600 mt-1">Registrations</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {dailyTarget?.progress.qualified || 0}
              </p>
              <p className="text-xs text-gray-500">/ {dailyTarget?.targetQualified || 5}</p>
              <p className="text-xs text-gray-600 mt-1">Qualified</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {dailyTarget?.progress.onboarded || 0}
              </p>
              <p className="text-xs text-gray-500">/ {dailyTarget?.targetOnboarded || 2}</p>
              <p className="text-xs text-gray-600 mt-1">Onboarded</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => window.location.href = '/field-operator/register'}
            className="bg-white p-4 rounded-xl shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">Quick Register</span>
          </button>

          <button 
            onClick={() => window.location.href = '/field-operator/qr-code'}
            className="bg-white p-4 rounded-xl shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <QrCode className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">QR Code</span>
          </button>

          <button 
            onClick={() => window.location.href = '/field-operator/camera'}
            className="bg-white p-4 rounded-xl shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Camera className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">Take Photo</span>
          </button>

          <button 
            onClick={() => window.location.href = '/field-operator/my-candidates'}
            className="bg-white p-4 rounded-xl shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">My Drivers</span>
          </button>
        </div>
      </div>

      {/* Nearby Zones */}
      <div className="px-4 mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Navigation className="w-4 h-4" />
          Nearby Zones ({nearbyZones?.length || 0})
        </h3>
        <div className="space-y-2">
          {nearbyZones?.slice(0, 3).map((zone) => (
            <div key={zone.id} className="bg-white p-3 rounded-xl shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{zone.name}</h4>
                  <p className="text-xs text-gray-500">
                    {zone.distance}m away • {zone.recentApplications} recent apps
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  zone.recruitmentUrgency === 'HIGH' 
                    ? 'bg-red-100 text-red-700'
                    : zone.recruitmentUrgency === 'MEDIUM'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {zone.recruitmentUrgency}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                {zone.currentHeadcount} / {zone.headcountTarget} drivers
              </div>
            </div>
          ))}
          {!nearbyZones?.length && (
            <p className="text-sm text-gray-500 text-center py-4">
              Enable location to see nearby zones
            </p>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="px-4 mb-20">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Award className="w-4 h-4" />
          My Performance
        </h3>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">12</p>
              <p className="text-xs text-gray-600">This Week</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">48</p>
              <p className="text-xs text-gray-600">This Month</p>
            </div>
          </div>
          <button className="w-full mt-3 text-sm text-blue-600 font-medium">
            View Full Stats →
          </button>
        </div>
      </div>

      {/* SOS Button */}
      <button
        onClick={() => setShowSOSModal(true)}
        className="fixed bottom-4 right-4 w-14 h-14 bg-red-600 rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition-transform"
      >
        <AlertTriangle className="w-6 h-6" />
      </button>

      {/* SOS Modal */}
      {showSOSModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Emergency Alert</h3>
              <p className="text-sm text-gray-600 mb-4">
                This will send your location to the emergency response team.
                Only use in genuine emergencies.
              </p>
              <div className="space-y-2">
                <button
                  onClick={handleSOS}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-medium"
                >
                  Send Emergency Alert
                </button>
                <button
                  onClick={() => setShowSOSModal(false)}
                  className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-2">
        <div className="flex justify-around">
          <a href="/field-operator" className="flex flex-col items-center gap-1 text-blue-600">
            <Navigation className="w-5 h-5" />
            <span className="text-xs">Home</span>
          </a>
          <a href="/field-operator/my-candidates" className="flex flex-col items-center gap-1 text-gray-500">
            <Users className="w-5 h-5" />
            <span className="text-xs">My Drivers</span>
          </a>
          <a href="/field-operator/events" className="flex flex-col items-center gap-1 text-gray-500">
            <Calendar className="w-5 h-5" />
            <span className="text-xs">Events</span>
          </a>
          <a href="/field-operator/profile" className="flex flex-col items-center gap-1 text-gray-500">
            <Award className="w-5 h-5" />
            <span className="text-xs">Profile</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
