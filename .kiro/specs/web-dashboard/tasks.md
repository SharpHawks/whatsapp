# Implementation Plan - Web Dashboard

- [x] 1. Project setup and configuration








  - Initialize Vite + React + TypeScript project
  - Configure TailwindCSS with custom theme
  - Set up ESLint and TypeScript strict mode
  - Configure path aliases and build settings
  - _Requirements: 11.1, 11.2_


- [x] 2. Core infrastructure and utilities


  - [x] 2.1 Create API client with Axios interceptors

    - Configure base URL and timeout
    - Implement request interceptor for JWT tokens
    - Implement response interceptor for error handling and token refresh
    - _Requirements: 1.3, 1.4_
  
  - [x] 2.2 Create authentication store with Zustand


    - Implement login, register, logout actions
    - Add token persistence to localStorage
    - Add automatic token refresh logic
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 2.3 Create WebSocket client for real-time updates


    - Initialize Socket.io client with authentication
    - Implement event handlers for bot status, messages, balance
    - Add reconnection logic
    - _Requirements: 12.1, 12.2, 12.4_
  
  - [x] 2.4 Create utility functions and helpers


    - Date formatting functions
    - Currency formatting functions
    - Class name merging utility (cn)
    - _Requirements: 3.1, 5.1_

- [ ] 3. Common UI components
  - [x] 3.1 Create base components



    - Button component with variants (primary, secondary, danger)
    - Input component with validation states
    - Card component for content containers
    - Badge component for status indicators
    - _Requirements: 2.3, 2.4, 4.4_
  
  - [ ] 3.2 Create form components
    - Form wrapper with React Hook Form integration
    - Select dropdown component
    - Date picker component
    - Checkbox and radio components


    - _Requirements: 6.2, 6.4_
  
  - [ ] 3.3 Create feedback components
    - Toast notification setup with React Hot Toast
    - Loading spinner component
    - Empty state component
    - Error message component
    - _Requirements: 1.4, 4.4_
  
  - [ ] 3.4 Create data display components
    - Data table component with sorting and pagination
    - Stat card component for dashboard metrics
    - Chart wrapper components using Recharts
    - Modal/Dialog component using Headless UI
    - _Requirements: 3.1, 3.2, 4.1, 9.2_

- [ ] 4. Authentication pages
  - [x] 4.1 Create login page


    - Build login form with email and password fields
    - Add form validation with Zod schema
    - Implement login submission with error handling
    - Add link to registration page
    - _Requirements: 1.2, 1.4_
  
  - [x] 4.2 Create registration page


    - Build registration form with email and password
    - Add password strength indicator
    - Implement registration submission
    - Add link to login page
    - _Requirements: 1.1_
  
  - [x] 4.3 Create protected route wrapper


    - Check authentication status
    - Redirect to login if not authenticated
    - Handle loading states during auth check
    - _Requirements: 1.2, 1.3_

- [ ] 5. Layout components
  - [x] 5.1 Create sidebar navigation


    - Build desktop fixed sidebar with navigation items
    - Add mobile collapsible drawer
    - Implement active route highlighting
    - Add user profile section with logout button
    - _Requirements: 2.1, 11.2_
  
  - [x] 5.2 Create main layout wrapper


    - Implement responsive container
    - Add proper spacing and padding
    - Integrate sidebar navigation
    - Handle mobile/desktop layout switching
    - _Requirements: 11.1, 11.3_
  
  - [x] 5.3 Create header component


    - Add mobile menu toggle button
    - Add breadcrumb navigation
    - Add notification bell icon
    - _Requirements: 11.2, 12.2_

- [ ] 6. User dashboard page
  - [x] 6.1 Create dashboard statistics cards

    - Fetch dashboard stats from API
    - Display total messages, balance, active bots, messages today
    - Add color-coded status indicators for balance
    - Implement auto-refresh every 30 seconds
    - _Requirements: 3.1, 3.2, 3.4_
  

  - [ ] 6.2 Create message volume chart
    - Fetch message history data
    - Render line chart with Recharts
    - Add date range labels
    - Make chart responsive
    - _Requirements: 3.3_
  
  - [ ] 6.3 Create recent activity feed
    - Fetch last 10 messages
    - Display in compact list format
    - Add click to view full message
    - _Requirements: 3.5_

  
  - [ ] 6.4 Add quick action buttons
    - "Create Bot" button opening modal
    - "Add Funds" button navigating to billing
    - _Requirements: 2.2, 5.2_




- [ ] 7. Bots management page
  - [x] 7.1 Create bots list view

    - Fetch user's bots from API
    - Display bots in grid layout



    - Show bot name, phone, status, last activity
    - Add quick action buttons (view, restart, delete)
    - _Requirements: 2.1, 2.3, 2.4, 2.5_
  

  - [ ] 7.2 Create bot creation modal
    - Build form with bot name input
    - Submit bot creation request
    - Display QR code after creation
    - Implement QR code auto-refresh every 60 seconds
    - Poll for connection status
    - _Requirements: 2.2_
  
  - [ ] 7.3 Create bot details modal
    - Display full bot information
    - Show detailed statistics
    - Add configuration options
    - Include webhook and auto-response settings
    - _Requirements: 2.5_
  



  - [ ] 7.4 Implement bot actions
    - Restart bot functionality
    - Delete bot with confirmation
    - Handle real-time status updates via WebSocket
    - _Requirements: 2.4, 12.1_


- [ ] 8. Messages page
  - [ ] 8.1 Create messages data table
    - Fetch messages with pagination
    - Display columns: timestamp, bot, from/to, preview, type, status
    - Implement row click to view details
    - Add status badges with colors
    - _Requirements: 4.1, 4.4_

  
  - [ ] 8.2 Create message filters
    - Bot selection dropdown
    - Date range picker
    - Message type filter


    - Status filter


    - Apply filters to API query
    - _Requirements: 4.2_
  
  - [ ] 8.3 Create message search
    - Search input for phone number or content
    - Debounce search input
    - Update table results
    - _Requirements: 4.3_
  
  - [x] 8.4 Create message details modal


    - Display full message content
    - Show media attachments if present
    - Display delivery status timeline
    - _Requirements: 4.4_
  
  - [ ] 8.5 Implement real-time message updates
    - Listen for new message events via WebSocket
    - Update table when new messages arrive
    - Show toast notification for new messages
    - _Requirements: 12.2_

- [ ] 9. Billing page
  - [x] 9.1 Create balance display card

    - Fetch current balance
    - Display prominently with large text
    - Show low balance warning if below threshold
    - Add "Add Funds" button
    - _Requirements: 5.1, 5.4_
  


  - [ ] 9.2 Create payment form with Stripe
    - Integrate Stripe Elements
    - Add amount input with preset options
    - Build credit card form
    - Handle payment submission

    - Show success/error feedback
    - _Requirements: 5.2_
  
  - [ ] 9.3 Create transaction history table
    - Fetch transaction history
    - Display date, description, amount, status
    - Add download invoice button
    - Implement pagination
    - _Requirements: 5.3, 5.5_
  
  - [ ] 9.4 Create usage statistics section
    - Display messages sent this period
    - Show cost breakdown
    - Calculate projected monthly cost
    - _Requirements: 5.3_

- [ ] 10. Settings page
  - [ ] 10.1 Create profile settings tab
    - Display current email
    - Add password change form
    - Implement update submission
    - _Requirements: 1.1_
  
  - [ ] 10.2 Create API keys section
    - Display user's API key (masked)
    - Add copy to clipboard button
    - Add regenerate key button with confirmation
    - _Requirements: 2.5_
  
  - [ ] 10.3 Create webhooks configuration
    - Fetch webhook config
    - Build webhook URL input
    - Add event type checkboxes
    - Implement test webhook button
    - Display delivery statistics
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ] 10.4 Create auto-responses management
    - Fetch auto-response rules
    - Display rules in list/table
    - Add create rule form (trigger, response, match type)
    - Implement enable/disable toggle
    - Add edit and delete actions
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 11. Admin dashboard page
  - [ ] 11.1 Create admin overview cards
    - Fetch admin statistics
    - Display total users, bots, messages, revenue
    - Show growth percentages
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ] 11.2 Create admin charts
    - User growth line chart
    - Message volume bar chart
    - Revenue area chart
    - _Requirements: 9.4_
  
  - [ ] 11.3 Create recent users table
    - Display last 10 registrations
    - Show email, date, verification status
    - Add click to view user details
    - _Requirements: 8.1_
  
  - [ ] 11.4 Create system health indicators
    - Display API response time
    - Show database status
    - Display queue status
    - Show error rate
    - _Requirements: 9.5_

- [ ] 12. Admin users management page
  - [ ] 12.1 Create users data table
    - Fetch all users with pagination
    - Display email, registration date, balance, bots, status
    - Add search functionality
    - Implement sorting
    - _Requirements: 8.1, 8.2_
  
  - [ ] 12.2 Create user details modal
    - Display full user information
    - Show list of user's bots
    - Display transaction history
    - Add action buttons (suspend, adjust balance)
    - _Requirements: 8.2, 8.4_
  
  - [ ] 12.3 Implement user actions
    - Suspend/activate user account
    - Adjust user balance with reason
    - Show confirmation dialogs
    - _Requirements: 8.3, 8.4_
  
  - [ ] 12.4 Add bulk actions
    - Export users to CSV
    - Bulk status updates (if needed)
    - _Requirements: 8.1_

- [ ] 13. Admin settings page
  - [ ] 13.1 Create pricing configuration
    - Fetch current pricing settings
    - Add price per message input
    - Add minimum balance input
    - Add low balance threshold input
    - Implement save with confirmation
    - _Requirements: 10.1, 10.2, 10.4, 10.5_
  
  - [ ] 13.2 Create rate limits configuration
    - Add messages per minute input
    - Add API requests per minute input


    - Implement save functionality

    - _Requirements: 10.3_
  
  - [ ] 13.3 Create system settings
    - Add maintenance mode toggle
    - Add registration enabled toggle

    - Add email verification required toggle
    - _Requirements: 10.4_

- [ ] 14. Real-time features integration
  - [x] 14.1 Connect WebSocket on authentication

    - Initialize socket connection after login
    - Disconnect on logout
    - Handle reconnection on connection loss
    - _Requirements: 12.4_
  
  - [x] 14.2 Implement bot status updates

    - Listen for bot:status events
    - Update bot list in real-time
    - Update bot details if modal is open
    - _Requirements: 12.1_
  
  - [ ] 14.3 Implement message notifications
    - Listen for message:new events
    - Show toast notification
    - Update message list if on messages page
    - Play notification sound (optional)
    - _Requirements: 12.2_
  
  - [ ] 14.4 Implement balance updates
    - Listen for balance:updated events
    - Update balance display across all pages
    - Show notification for low balance
    - _Requirements: 12.1_

- [ ] 15. Error handling and loading states
  - [ ] 15.1 Create error boundary component
    - Catch React errors
    - Display error page with reload option
    - Log errors to console
    - _Requirements: 1.4_
  
  - [ ] 15.2 Add loading states to all data fetching
    - Show skeleton loaders for cards and tables
    - Add spinner for button actions
    - Handle empty states
    - _Requirements: 3.4_
  
  - [ ] 15.3 Implement toast notifications for errors
    - API error toasts
    - Network error toasts with retry
    - Success toasts for actions
    - _Requirements: 1.4_

- [ ] 16. Responsive design implementation
  - [ ] 16.1 Test and fix mobile layout
    - Verify sidebar collapses on mobile
    - Check card stacking on small screens
    - Test table responsiveness (switch to card view if needed)
    - _Requirements: 11.1, 11.2_
  
  - [ ] 16.2 Test and fix tablet layout
    - Verify proper spacing and sizing
    - Check navigation usability
    - Test touch interactions
    - _Requirements: 11.3_
  
  - [ ] 16.3 Optimize for touch devices
    - Ensure buttons are at least 44x44px
    - Add proper touch feedback
    - Test gesture interactions
    - _Requirements: 11.3, 11.4_

- [ ] 17. Performance optimization
  - [ ] 17.1 Implement code splitting
    - Lazy load page components
    - Lazy load heavy components (charts, modals)
    - Add loading fallbacks
    - _Requirements: 11.5_
  
  - [ ] 17.2 Optimize React Query caching
    - Configure appropriate stale times
    - Implement optimistic updates
    - Add query prefetching for common routes
    - _Requirements: 3.4_
  
  - [ ] 17.3 Add debouncing and throttling
    - Debounce search inputs
    - Throttle scroll events
    - Debounce filter changes
    - _Requirements: 4.3_

- [ ]* 18. Testing
  - [ ]* 18.1 Write component unit tests
    - Test common components (Button, Input, Card)
    - Test form validation
    - Test utility functions
    - _Requirements: All_
  
  - [ ]* 18.2 Write integration tests
    - Test authentication flow
    - Test bot creation flow
    - Test message filtering
    - _Requirements: 1.1, 1.2, 2.2, 4.2_

- [ ] 19. Build and deployment setup
  - [ ] 19.1 Configure environment variables
    - Set up .env files for development and production
    - Add API URL, WebSocket URL, Stripe key
    - _Requirements: All_
  
  - [ ] 19.2 Optimize production build
    - Configure Vite build settings
    - Enable minification and tree shaking
    - Generate source maps
    - _Requirements: 11.5_
  
  - [ ] 19.3 Set up deployment
    - Choose hosting platform (Vercel/Netlify/serve from backend)
    - Configure build command


    - Set up environment variables in hosting platform
    - _Requirements: All_

- [ ] 20. Final integration and polish
  - [ ] 20.1 Connect all API endpoints
    - Verify all API calls are working
    - Test error handling for all endpoints
    - Verify authentication flow end-to-end
    - _Requirements: All_
  
  - [ ] 20.2 Add accessibility improvements
    - Add ARIA labels
    - Test keyboard navigation
    - Verify color contrast
    - Add alt text to images
    - _Requirements: 11.1, 11.2_
  
  - [ ] 20.3 Final UI polish
    - Review and fix spacing inconsistencies
    - Add loading animations
    - Add micro-interactions
    - Test across different browsers
    - _Requirements: All_
