# Design Document - Web Dashboard

## Overview

The Web Dashboard is a modern, responsive single-page application (SPA) built with React and TypeScript. It provides two distinct interfaces: a user dashboard for bot management and monitoring, and an admin dashboard for platform oversight. The design emphasizes real-time updates, intuitive navigation, and a clean, professional aesthetic.

## Architecture

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling and development server
- TailwindCSS for styling
- React Router for navigation
- TanStack Query (React Query) for server state management
- Zustand for client state management
- Axios for HTTP requests
- Socket.io-client for WebSocket connections
- Recharts for data visualization
- React Hook Form + Zod for form validation
- React Hot Toast for notifications

**Backend Integration:**
- RESTful API communication with existing Express backend
- WebSocket connection for real-time updates
- JWT-based authentication with automatic token refresh

### Application Structure

```
frontend/
├── public/
│   └── assets/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── common/         # Generic components (Button, Input, Card, etc.)
│   │   ├── layout/         # Layout components (Sidebar, Header, etc.)
│   │   ├── bots/           # Bot-specific components
│   │   ├── messages/       # Message-related components
│   │   ├── billing/        # Billing components
│   │   └── admin/          # Admin-specific components
│   ├── pages/              # Page components
│   │   ├── auth/           # Login, Register
│   │   ├── user/           # User dashboard pages
│   │   └── admin/          # Admin dashboard pages
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities and helpers
│   │   ├── api.ts          # API client configuration
│   │   ├── socket.ts       # WebSocket client
│   │   └── utils.ts        # Helper functions
│   ├── stores/             # Zustand stores
│   ├── types/              # TypeScript type definitions
│   └── main.tsx            # Application entry point
```

## Components and Interfaces

### Authentication Flow

**Login/Register Pages:**
- Standalone pages with centered form layout
- Email and password validation using Zod schemas
- Error handling with toast notifications
- Automatic redirect to dashboard on success

**Authentication Store (Zustand):**
```typescript
interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshAccessToken: () => Promise<void>
}
```

**API Interceptors:**
- Request interceptor: Attach JWT token to all requests
- Response interceptor: Handle 401 errors with automatic token refresh
- Fallback to logout if refresh fails

### Layout Components

**Sidebar Navigation:**
- Fixed left sidebar (desktop) with collapsible mobile drawer
- Logo and branding at top
- Navigation items with icons and active state highlighting
- User profile section at bottom with logout button
- Conditional rendering of admin menu items based on user role

**Main Layout:**
- Responsive container with proper spacing
- Breadcrumb navigation (optional)
- Page title and action buttons area
- Content area with proper padding

### User Dashboard Pages

**Dashboard (Home):**
- Grid layout with stat cards showing:
  - Total messages sent (current period)
  - Current balance with color-coded status
  - Active bots count
  - Messages today
- Line chart showing message volume over last 30 days
- Recent activity feed (last 10 messages)
- Quick action buttons (Create Bot, Add Funds)

**Bots Page:**
- List/Grid view toggle for bot instances
- Each bot card displays:
  - Bot name and phone number
  - Connection status badge (Connected/Disconnected/Connecting)
  - Last activity timestamp
  - Quick actions (View, Restart, Delete)
- "Create New Bot" button opens modal with:
  - Bot name input
  - QR code display after creation
  - Auto-refresh QR code every 60 seconds
  - Connection status polling
- Bot details modal:
  - Full statistics
  - Configuration options
  - Webhook settings
  - Auto-response rules

**Messages Page:**
- Data table with columns:
  - Timestamp
  - Bot name
  - From/To phone numbers
  - Message preview (truncated)
  - Type (text/image/video/document)
  - Status (sent/delivered/read/failed)
- Filters:
  - Bot selection dropdown
  - Date range picker
  - Message type filter
  - Status filter
- Search bar for phone number or content
- Pagination controls
- Click row to view full message details in modal

**Billing Page:**
- Balance card with:
  - Current balance (large, prominent)
  - Low balance warning if < threshold
  - "Add Funds" button
- Payment form (Stripe integration):
  - Amount input with preset options
  - Credit card form (Stripe Elements)
  - Submit button
- Transaction history table:
  - Date, description, amount, status
  - Download invoice button for completed transactions
- Usage statistics:
  - Messages sent this period
  - Cost breakdown
  - Projected monthly cost

**Settings Page:**
- Tabs for different settings sections:
  - Profile: Email, password change
  - API Keys: Display and regenerate API keys
  - Webhooks: Configure webhook URLs and events
  - Auto-Responses: Manage auto-response rules
  - Notifications: Email notification preferences

### Admin Dashboard Pages

**Admin Dashboard:**
- Overview cards:
  - Total users (with growth percentage)
  - Total active bots
  - Messages today/this month
  - Total revenue (current month)
- Charts:
  - User growth over time (line chart)
  - Message volume by day (bar chart)
  - Revenue by month (area chart)
- Recent users table (last 10 registrations)
- System health indicators:
  - API response time
  - Database connection status
  - Queue status
  - Error rate

**Admin Users Page:**
- Searchable data table with columns:
  - Email
  - Registration date
  - Email verified status
  - Account balance
  - Total bots
  - Status (active/suspended)
  - Actions
- Search and filter controls
- User details modal:
  - Full user information
  - Bot list
  - Transaction history
  - Actions: Suspend/Activate, Adjust Balance, Send Email
- Bulk actions: Export to CSV

**Admin Settings Page:**
- Pricing configuration:
  - Price per message input
  - Minimum balance requirement
  - Low balance threshold
- Rate limits:
  - Messages per minute per user
  - API requests per minute
- System settings:
  - Maintenance mode toggle
  - Registration enabled toggle
  - Email verification required toggle

## Data Models

### Frontend Types

```typescript
interface User {
  id: string
  email: string
  role: 'user' | 'admin'
  emailVerified: boolean
  balance: number
  createdAt: string
}

interface Bot {
  id: string
  userId: string
  name: string
  phoneNumber: string | null
  status: 'disconnected' | 'connecting' | 'connected'
  qrCode: string | null
  lastActivity: string | null
  messageCount: number
  createdAt: string
}

interface Message {
  id: string
  botId: string
  from: string
  to: string
  content: string
  type: 'text' | 'image' | 'video' | 'audio' | 'document'
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  mediaUrl: string | null
  timestamp: string
}

interface Transaction {
  id: string
  userId: string
  type: 'credit' | 'debit'
  amount: number
  description: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
}

interface AutoResponse {
  id: string
  botId: string
  trigger: string
  response: string
  enabled: boolean
  matchType: 'exact' | 'contains' | 'regex'
  createdAt: string
}

interface WebhookConfig {
  id: string
  botId: string
  url: string
  events: string[]
  enabled: boolean
  secret: string
}

interface DashboardStats {
  totalMessages: number
  messagesThisPeriod: number
  currentBalance: number
  activeBots: number
  messagesToday: number
  messagesByDay: Array<{ date: string; count: number }>
}

interface AdminStats {
  totalUsers: number
  userGrowth: number
  totalBots: number
  messagesToday: number
  messagesThisMonth: number
  revenue: number
  revenueGrowth: number
  avgResponseTime: number
  errorRate: number
}
```

## API Integration

### API Client Configuration

```typescript
// lib/api.ts
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
})

// Request interceptor
api.interceptors.request.use((config) => {
  const token = authStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Attempt token refresh
      await authStore.getState().refreshAccessToken()
      // Retry original request
      return api.request(error.config)
    }
    return Promise.reject(error)
  }
)
```

### API Endpoints Used

**Authentication:**
- POST `/auth/register` - User registration
- POST `/auth/login` - User login
- POST `/auth/refresh` - Refresh access token
- POST `/auth/logout` - Logout

**Bots:**
- GET `/bots` - List user's bots
- POST `/bots` - Create new bot
- GET `/bots/:id` - Get bot details
- GET `/bots/:id/qr` - Get QR code
- DELETE `/bots/:id` - Delete bot
- POST `/bots/:id/restart` - Restart bot

**Messages:**
- GET `/messages` - List messages (with filters)
- GET `/messages/:id` - Get message details
- POST `/messages/send` - Send message

**Billing:**
- GET `/billing/balance` - Get current balance
- GET `/billing/transactions` - List transactions
- POST `/billing/charge` - Add funds
- GET `/billing/invoices/:id` - Download invoice

**Auto-Responses:**
- GET `/bots/:botId/auto-responses` - List rules
- POST `/bots/:botId/auto-responses` - Create rule
- PUT `/auto-responses/:id` - Update rule
- DELETE `/auto-responses/:id` - Delete rule

**Webhooks:**
- GET `/bots/:botId/webhooks` - Get webhook config
- PUT `/bots/:botId/webhooks` - Update webhook config
- POST `/bots/:botId/webhooks/test` - Test webhook

**Admin:**
- GET `/admin/users` - List all users
- GET `/admin/users/:id` - Get user details
- PUT `/admin/users/:id/status` - Update user status
- PUT `/admin/users/:id/balance` - Adjust balance
- GET `/admin/stats` - Get platform statistics
- GET `/admin/settings` - Get platform settings
- PUT `/admin/settings` - Update platform settings

## Real-Time Updates

### WebSocket Integration

```typescript
// lib/socket.ts
import io from 'socket.io-client'

const socket = io('/', {
  auth: {
    token: authStore.getState().accessToken
  },
  autoConnect: false
})

// Event handlers
socket.on('bot:status', (data) => {
  // Update bot status in cache
  queryClient.setQueryData(['bots', data.botId], (old) => ({
    ...old,
    status: data.status
  }))
})

socket.on('message:new', (data) => {
  // Invalidate messages query to refetch
  queryClient.invalidateQueries(['messages'])
  // Show toast notification
  toast.success('New message received')
})

socket.on('balance:updated', (data) => {
  // Update balance in auth store
  authStore.setState({ user: { ...user, balance: data.balance } })
})
```

### Events Subscribed:
- `bot:status` - Bot connection status changes
- `message:new` - New message received
- `message:status` - Message delivery status update
- `balance:updated` - Account balance changed
- `webhook:delivery` - Webhook delivery status

## Error Handling

### Error Display Strategy

1. **Form Validation Errors:** Display inline below input fields
2. **API Errors:** Show toast notification with error message
3. **Network Errors:** Show toast with retry option
4. **Authentication Errors:** Automatic token refresh, fallback to logout
5. **Critical Errors:** Full-page error boundary with reload option

### Error Boundary Component

```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Log to error tracking service
    console.error('Error:', error, errorInfo)
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorPage />
    }
    return this.props.children
  }
}
```

## Testing Strategy

### Unit Tests
- Component rendering tests
- Hook logic tests
- Utility function tests
- Store action tests

### Integration Tests
- API integration tests
- Form submission flows
- Navigation flows
- Authentication flows

### E2E Tests (Optional)
- Complete user journeys
- Bot creation and management
- Payment processing
- Admin user management

## Performance Optimizations

1. **Code Splitting:** Lazy load pages and heavy components
2. **Query Caching:** Use React Query for intelligent caching
3. **Debouncing:** Debounce search inputs and filters
4. **Virtual Scrolling:** For large message lists
5. **Image Optimization:** Lazy load images, use appropriate formats
6. **Bundle Optimization:** Tree shaking, minification
7. **Memoization:** Use React.memo for expensive components

## Security Considerations

1. **XSS Prevention:** Sanitize user input, use React's built-in escaping
2. **CSRF Protection:** Use SameSite cookies, CSRF tokens
3. **Secure Storage:** Store tokens in httpOnly cookies or secure localStorage
4. **Input Validation:** Client-side validation with Zod schemas
5. **Rate Limiting:** Implement client-side rate limiting for API calls
6. **Content Security Policy:** Configure CSP headers
7. **HTTPS Only:** Enforce HTTPS in production

## Accessibility

1. **Semantic HTML:** Use proper HTML5 elements
2. **ARIA Labels:** Add ARIA labels for screen readers
3. **Keyboard Navigation:** Ensure all interactive elements are keyboard accessible
4. **Focus Management:** Proper focus indicators and management
5. **Color Contrast:** Meet WCAG AA standards
6. **Alt Text:** Provide alt text for all images

## Responsive Design

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Mobile Adaptations
- Collapsible sidebar navigation
- Stacked card layouts
- Touch-friendly button sizes (min 44x44px)
- Simplified tables (card view on mobile)
- Bottom navigation bar (optional)

## Deployment

### Build Process
```bash
npm run build
```
- Outputs to `dist/` directory
- Minified and optimized assets
- Source maps for debugging

### Environment Variables
```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

### Hosting Options
- Static hosting (Vercel, Netlify, Cloudflare Pages)
- Serve from Express backend (serve static files)
- CDN distribution for assets

### CI/CD Pipeline
1. Run linter and type checks
2. Run unit tests
3. Build production bundle
4. Deploy to hosting platform
5. Invalidate CDN cache

## Future Enhancements

1. **Dark Mode:** Theme toggle with system preference detection
2. **Multi-language Support:** i18n integration
3. **Advanced Analytics:** Custom date ranges, export reports
4. **Bulk Operations:** Bulk message sending, bulk bot management
5. **Team Collaboration:** Multi-user accounts, role-based permissions
6. **Mobile App:** React Native version
7. **Desktop App:** Electron wrapper
8. **Advanced Webhooks:** Webhook retry logic, webhook logs
9. **Template Library:** Pre-built message templates
10. **AI Features:** Smart auto-responses, sentiment analysis
