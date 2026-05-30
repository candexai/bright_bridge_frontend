import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ProtectedRoute } from './ProtectedRoute';
import { Login } from '../pages/Login';
import { SchoolLogin } from '../pages/SchoolLogin';
import { SchoolRegister } from '../pages/SchoolRegister';
// import { MasterLogin } from '../pages/MasterLogin';
import { SchoolLayout } from '../layouts/SchoolLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { SchoolDashboard } from '../pages/school/Dashboard';
import { SchoolIntegrations } from '../pages/school/Integrations';
import { SchoolSettings } from '../pages/school/Settings';
import { SchoolFollowups } from '../pages/school/Followups';
import { SchoolCallLogs } from '../pages/school/CallLogs';
import { SchoolForms } from '../pages/school/Forms';
import { SchoolReferrals } from '../pages/school/Referrals';
import { SchoolTestIntegration } from '../pages/school/TestIntegration';
import { AdminDashboard } from '../pages/admin/Dashboard';
import { AdminSchools } from '../pages/admin/Schools';
import { AdminIntegrations } from '../pages/admin/Integrations';
import { AdminReferrals } from '../pages/admin/Referrals';
import { AdminPhoneNumbers } from '../pages/admin/AdminPhoneNumbers';
import AiNumberRequests from '../pages/admin/AiNumberRequests';
import { Landing } from '../pages/Landing';
import { InquiryForm } from '../pages/InquiryForm';
import { ReferralSignup } from '../pages/ReferralSignup';
import { BookTour } from '../pages/BookTour';
import { GoogleAuthCallback } from '../pages/GoogleAuthCallback';
import { MasterLogin } from '../pages/MasterLogin';
import { DailyInsights } from '../pages/school/DailyInsights';
import Pricing from '../pages/Pricing';
import { PrivacyPolicy } from '../pages/PrivacyPolicy';
import { TermsOfService } from '../pages/TermsOfService';
import { SchoolBilling } from '../pages/school/Billing';
import { AdminFinancials } from '../pages/admin/Financials';
import { AdminNotifications } from '../pages/admin/Notifications';

const RootRedirect = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  const redirectPath = user.role === 'admin' ? '/admin/dashboard' : '/school/dashboard';
  return <Navigate to={redirectPath} replace />;
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/login/school',
    element: <SchoolLogin />,
  },
  {
    path: '/register/school',
    element: <SchoolRegister />,
  },
  {
    path: '/auth/google/callback',
    element: <GoogleAuthCallback />,
  },
  // {
  //   path: '/login/master',
  //   element: <MasterLogin />,
  // },
  {
    path: '/inquiry/:schoolId',
    element: <InquiryForm />,
  },
  {
    path: '/refer/:code',
    element: <ReferralSignup />,
  },
  {
    path: '/book-tour/:schoolId',
    element: <BookTour />,
  },
  {
    path: '/pricing',
    element: <Pricing />,
  },
  {
    path: '/privacy',
    element: <PrivacyPolicy />,
  },
  {
    path: '/terms',
    element: <TermsOfService />,
  },
  {
    path: '/dashboard',
    element: <RootRedirect />,
  },
  {
    path: '/school',
    element: (
      <ProtectedRoute requiredRole="school">
        <SchoolLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: <SchoolDashboard />,
      },
      {
        path: 'daily-insights',
        element: <DailyInsights />,
      },
      {
        path: 'integrations',
        element: <SchoolIntegrations />,
      },
      {
        path: 'settings',
        element: <SchoolSettings />,
      },
      {
        path: 'followups',
        element: <SchoolFollowups />,
      },
      {
        path: 'call-logs',
        element: <SchoolCallLogs />,
      },
      {
        path: 'forms',
        element: <SchoolForms />,
      },
      {
        path: 'referrals',
        element: <SchoolReferrals />,
      },
      {
        path: 'billing',
        element: <SchoolBilling />,
      },
      {
        path: 'test-integration',
        element: <SchoolTestIntegration />,
      },
    ],
  },
  {
    path: '/admin',
    children: [
      {
        index: true,
        element: <MasterLogin />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <AdminDashboard /> }],
      },
      {
        path: 'schools',
        element: (
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <AdminSchools /> }],
      },
            {
        path: 'integrations',
        element: (
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <AdminIntegrations /> }],
      },
      {
        path: 'phone-numbers',
        element: (
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <AdminPhoneNumbers /> }],
      },
      {
        path: 'ai-number-requests',
        element: (
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <AiNumberRequests /> }],
      },
      {
        path: 'referrals',
        element: (
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <AdminReferrals /> }],
      },
      {
        path: 'financials',
        element: (
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <AdminFinancials /> }],
      },
      {
        path: 'notifications',
        element: (
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <AdminNotifications /> }],
      },
    ],
  },
]);

