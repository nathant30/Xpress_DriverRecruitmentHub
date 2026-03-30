import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Auth pages
import { LoginPage } from '@/features/auth/routes/LoginPage';

// Main pages
import { DashboardPage } from '@/features/dashboard/routes/DashboardPage';
import { PipelinePage } from '@/features/pipeline/routes/PipelinePage';
import { CandidatesPage } from '@/features/candidates/routes/CandidatesPage';
import { CandidateDetailPage } from '@/features/candidates/routes/CandidateDetailPage';
import { NewCandidatePage } from '@/features/candidates/routes/NewCandidatePage';
import { FlowBuilderPage } from '@/features/flow-builder/routes/FlowBuilderPage';
import { SettingsPage } from '@/features/settings/routes/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
    ],
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'pipeline',
        element: <PipelinePage />,
      },
      {
        path: 'candidates',
        children: [
          {
            index: true,
            element: <CandidatesPage />,
          },
          {
            path: 'new',
            element: <NewCandidatePage />,
          },
          {
            path: ':id',
            element: <CandidateDetailPage />,
          },
        ],
      },
      {
        path: 'flow-builder',
        element: <FlowBuilderPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
]);
