import axios from 'axios';
import { useAuthStore } from '@/features/auth/store/authStore';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
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
    api.post('/auth/login', { email, password }),
  
  getMe: () =>
    api.get('/auth/me'),
};

// Candidates API
export const candidatesApi = {
  getAll: (params?: Record<string, any>) =>
    api.get('/candidates', { params }),
  
  getById: (id: string) =>
    api.get(`/candidates/${id}`),
  
  create: (data: any) =>
    api.post('/candidates', data),
  
  updateStage: (id: string, data: any) =>
    api.patch(`/candidates/${id}/stage`, data),
  
  logInteraction: (id: string, data: any) =>
    api.post(`/candidates/${id}/interactions`, data),
  
  updateDocument: (candidateId: string, docId: string, data: any) =>
    api.patch(`/candidates/${candidateId}/documents/${docId}`, data),
  
  assignRecruiter: (id: string, recruiterId: string) =>
    api.patch(`/candidates/${id}/assign`, { recruiterId }),

  transferToOpsTower: (id: string) =>
    api.post(`/candidates/${id}/transfer-to-opstower`),

  getSyncStatus: (id: string) =>
    api.get(`/candidates/${id}/sync-status`),

  validateOpsTowerId: (id: string, driverId: string) =>
    api.post(`/candidates/${id}/validate-opstower-id`, { driverId }),
};

// Dashboard API
export const dashboardApi = {
  getDashboard: () =>
    api.get('/dashboard'),
  
  getFunnel: () =>
    api.get('/dashboard/funnel'),
  
  getRecruiterPerformance: () =>
    api.get('/dashboard/recruiter-performance'),
  
  getTimeToOnboard: () =>
    api.get('/dashboard/time-to-onboard'),
};

// Settings API
export const settingsApi = {
  getZones: () =>
    api.get('/settings/zones'),
  
  getHeadcountTargets: (params?: any) =>
    api.get('/settings/headcount-targets', { params }),
  
  createHeadcountTarget: (data: any) =>
    api.post('/settings/headcount-targets', data),
  
  getDriverAppCampaigns: (params?: any) =>
    api.get('/settings/driver-app-campaigns', { params }),
  
  createDriverAppCampaign: (data: any) =>
    api.post('/settings/driver-app-campaigns', data),
  
  getKioskDevices: () =>
    api.get('/settings/kiosk-devices'),
  
  createKioskDevice: (data: any) =>
    api.post('/settings/kiosk-devices', data),
  
  getRecruiters: () =>
    api.get('/settings/recruiters'),
};

// Flow Builder API
export const flowBuilderApi = {
  getFlows: () =>
    api.get('/flow-builder/flows'),
  
  getFlow: (id: string, version?: number) =>
    api.get(`/flow-builder/flows/${id}`, { params: { version } }),
  
  createFlow: (data: any) =>
    api.post('/flow-builder/flows', data),
  
  addStep: (flowId: string, data: any) =>
    api.post(`/flow-builder/flows/${flowId}/steps`, data),
  
  publishFlow: (flowId: string, changeSummary: string) =>
    api.post(`/flow-builder/flows/${flowId}/publish`, { changeSummary }),
  
  getActiveFlow: () =>
    api.get('/flow-builder/active-flow'),
};
