import axios from 'axios';
import { useAuthStore } from '@/features/auth/store/authStore';

export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/recruitment/auth/login', { email, password }),
  getMe: () =>
    api.get('/recruitment/auth/me'),
};

// Candidates API
export const candidatesApi = {
  getAll: (params?: Record<string, any>) =>
    api.get('/recruitment/r1/candidates', { params }),
  getById: (id: string) =>
    api.get(`/recruitment/r1/candidates/${id}`),
  create: (data: any) =>
    api.post('/recruitment/r1/candidates', data),
  updateStage: (id: string, data: any) =>
    api.patch(`/recruitment/r1/candidates/${id}/stage`, data),
  logInteraction: (id: string, data: any) =>
    api.post(`/recruitment/r1/candidates/${id}/interactions`, data),
  updateDocument: (_candidateId: string, docId: string, data: any) =>
    api.patch(`/recruitment/r3/documents/${docId}`, data),
  assignRecruiter: (id: string, recruiterId: string) =>
    api.patch(`/recruitment/r1/candidates/${id}/assign`, { recruiter_id: recruiterId }),
  transferToOpsTower: (id: string) =>
    api.post(`/recruitment/r1/candidates/${id}/transfer`),
  getSyncStatus: (id: string) =>
    api.get(`/recruitment/r1/candidates/${id}/sync-status`),
  validateOpsTowerId: (id: string, driverId: string) =>
    api.post(`/recruitment/r1/candidates/${id}/validate-opstower`, { driver_id: driverId }),
};

// Dashboard API
export const dashboardApi = {
  getDashboard: () =>
    api.get('/recruitment/r_dashboard/summary'),
  getFunnel: () =>
    api.get('/recruitment/r_dashboard/funnel'),
  getRecruiterPerformance: () =>
    api.get('/recruitment/r5/recruiter-performance'),
  getTimeToOnboard: () =>
    api.get('/recruitment/r_dashboard/time-to-onboard'),
};

// Settings API
export const settingsApi = {
  getZones: () =>
    api.get('/recruitment/r_settings/zones'),
  getHeadcountTargets: (params?: any) =>
    api.get('/recruitment/r_settings/headcount-targets', { params }),
  createHeadcountTarget: (data: any) =>
    api.post('/recruitment/r_settings/headcount-targets', data),
  getDriverAppCampaigns: (params?: any) =>
    api.get('/recruitment/r_settings/campaigns', { params }),
  createDriverAppCampaign: (data: any) =>
    api.post('/recruitment/r_settings/campaigns', data),
  getKioskDevices: () =>
    api.get('/recruitment/r_settings/kiosk-devices'),
  createKioskDevice: (data: any) =>
    api.post('/recruitment/r_settings/kiosk-devices', data),
  getRecruiters: () =>
    api.get('/recruitment/r_settings/recruiters'),
};

// Flow Builder API
export const flowBuilderApi = {
  getFlows: () =>
    api.get('/recruitment/r6/flows'),
  getFlow: (id: string, version?: number) =>
    api.get(`/recruitment/r6/flows/${id}`, { params: version ? { version } : undefined }),
  createFlow: (data: any) =>
    api.post('/recruitment/r6/flows', data),
  addStep: (flowId: string, data: any) =>
    api.post(`/recruitment/r6/flows/${flowId}/steps`, data),
  publishFlow: (flowId: string, changeSummary: string) =>
    api.post(`/recruitment/r6/flows/${flowId}/publish`, { change_summary: changeSummary }),
  getActiveFlow: () =>
    api.get('/recruitment/r6/active-flow'),
};

// Analytics API
export const analyticsApi = {
  getSyncStatus: () =>
    api.get('/recruitment/r5/sync-status'),
  getRecruiterPerformance: (period?: string) =>
    api.get('/recruitment/r5/recruiter-performance', { params: period ? { period } : undefined }),
  getSourceQualityScoreboard: (params?: Record<string, any>) =>
    api.get('/recruitment/r5/source-quality/scoreboard', { params }),
};

// Predictions API
export const predictionsApi = {
  getCandidatePredictions: (candidateId: string) =>
    api.get(`/recruitment/r7/predictions/${candidateId}`),
};

// Field Operator API
export const fieldOperatorApi = {
  getDailyTarget: (zoneId?: string) =>
    api.get('/recruitment/r8/daily-target', { params: zoneId ? { zone_id: zoneId } : undefined }),
  checkIn: (data?: { lat?: number; lng?: number; zone_id?: string }) =>
    api.post('/recruitment/r8/check-in', data || {}),
  quickRegister: (data: any) =>
    api.post('/recruitment/r8/leads', data),
  sos: (data?: { lat?: number; lng?: number; message?: string }) =>
    api.post('/recruitment/r8/sos', data || {}),
};
