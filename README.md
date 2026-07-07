# Childcare Enrollment AI Frontend 


   A production-ready SaaS dashboard application for childcare school enrollment management with separate portals for schools and administrators.
   

## Tech Stack

- **Vite** - Build tool and dev server
- **React 19** - UI library
- **TypeScript** - Type safety 
- **React Router** - Client-side routing
- **TailwindCSS** - Utility-first CSS framework
- **Zustand** - Lightweight state management
- **Axios** - HTTP client
- **Lucide React** - Icon library
- **Headless UI** - Accessible UI components

## Project Structure

```
src/
  api/           # API configuration and mock data
  components/    # Reusable UI components
  layouts/       # Layout components (SchoolLayout, AdminLayout)
  pages/         # Page components
    school/      # School portal pages
    admin/       # Admin portal pages
  routes/        # Routing configuration and guards
  store/         # Zustand stores
  types/         # TypeScript type definitions
  utils/         # Utility functions
```

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Authentication

The application uses a mock authentication system for development:

- **Admin Access**: Use an email containing "admin" (e.g., `admin@example.com`)
- **School Access**: Use any other email (e.g., `school@example.com`)
- **Password**: Any password works in demo mode

## Routes

### Public Routes
- `/login` - Login page

### School Portal Routes
- `/school/dashboard` - Dashboard with metrics
- `/school/integrations` - Integration management
- `/school/settings` - School settings
- `/school/followups` - Followup tracking
- `/school/forms` - Form builder
- `/school/referrals` - Referral management

### Admin Portal Routes
- `/admin/dashboard` - Platform-wide dashboard
- `/admin/schools` - School management
- `/admin/analytics` - Analytics dashboard
- `/admin/integrations` - Integration overview
- `/admin/referrals` - Referral tracking

## Features

### School Portal
- **Dashboard**: View key metrics (calls, inquiries, tours, forms)
- **Integrations**: Connect Microsoft Outlook and Google Workspace
- **Settings**: Configure AI phone number, routing, business hours, language, and scripts
- **Followups**: Track SMS and email followups
- **Forms**: Build dynamic forms with questions
- **Referrals**: Generate referral links and track referred schools

### Admin Portal
- **Dashboard**: Platform-wide metrics overview
- **Schools**: Manage all schools in the platform
- **Analytics**: View platform analytics (placeholder for charts)
- **Integrations**: See which schools have connected integrations
- **Referrals**: Track referral relationships

## State Management

Authentication state is managed using Zustand with persistence:

```typescript
import { useAuthStore } from './store/authStore';

const { user, isAuthenticated, login, logout } = useAuthStore();
```

## API Layer

The API layer is currently mocked. To connect to a real backend:

1. Update `src/api/axios.ts` with your API base URL
2. Replace mock data in `src/api/mockData.ts` with real API calls
3. Add authentication token handling in axios interceptors

## Multi-Tenant Ready

The application is structured to support multi-tenancy:

- User roles are clearly separated (admin vs school)
- Routes are protected based on user role
- Each school has a unique `schoolId` in the user object
- Settings and data are scoped to the current school

## Future Enhancements

- Connect to real backend API
- Add charting library for analytics
- Implement real authentication with JWT tokens
- Add form submission handling
- Implement real-time updates
- Add notification system
- Enhance responsive design for mobile

## License

Private - All rights reserved

