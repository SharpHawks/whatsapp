# WhatsApp API Platform - Frontend

Modern web dashboard for managing WhatsApp bots and monitoring platform usage.

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **React Router** for navigation
- **TanStack Query** for server state management
- **Zustand** for client state management
- **Axios** for HTTP requests
- **Socket.io** for real-time updates
- **Recharts** for data visualization
- **React Hook Form + Zod** for form validation

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your configuration
```

### Development

```bash
# Start development server
npm run dev

# The app will be available at http://localhost:3001
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Linting

```bash
# Run ESLint
npm run lint
```

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── common/      # Generic components (Button, Input, etc.)
│   ├── layout/      # Layout components (Sidebar, Header)
│   ├── bots/        # Bot-specific components
│   ├── messages/    # Message-related components
│   ├── billing/     # Billing components
│   └── admin/       # Admin-specific components
├── pages/           # Page components
│   ├── auth/        # Login, Register
│   ├── user/        # User dashboard pages
│   └── admin/       # Admin dashboard pages
├── hooks/           # Custom React hooks
├── lib/             # Utilities and helpers
│   ├── api.ts       # API client configuration
│   ├── socket.ts    # WebSocket client
│   └── utils.ts     # Helper functions
├── stores/          # Zustand stores
├── types/           # TypeScript type definitions
└── main.tsx         # Application entry point
```

## Features

### User Dashboard
- Bot management (create, configure, monitor)
- Real-time statistics and analytics
- Message history viewer
- Billing and payment management
- Auto-response configuration
- Webhook settings

### Admin Dashboard
- User management
- Platform-wide statistics
- System health monitoring
- Pricing configuration
- Rate limit management

## Environment Variables

- `VITE_API_URL` - Backend API URL (default: http://localhost:3000)
- `VITE_WS_URL` - WebSocket URL (default: ws://localhost:3000)
- `VITE_STRIPE_PUBLIC_KEY` - Stripe publishable key for payments

## License

Private - All rights reserved
