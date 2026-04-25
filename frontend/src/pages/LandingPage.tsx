import { Link } from 'react-router-dom'
import {
  ChatBubbleLeftRightIcon,
  BoltIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  CodeBracketIcon,
  ArrowRightIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '../stores/authStore'

const features = [
  {
    name: 'WhatsApp API Integration',
    description: 'Connect multiple WhatsApp numbers and manage them from a single dashboard. Powered by Baileys for reliable Web API access.',
    icon: ChatBubbleLeftRightIcon,
  },
  {
    name: 'Real-time Messaging',
    description: 'Send and receive messages instantly with WebSocket support. Track delivery status in real-time.',
    icon: BoltIcon,
  },
  {
    name: 'Advanced Analytics',
    description: 'Monitor message volume, bot activity, and usage patterns with detailed charts and reports.',
    icon: ChartBarIcon,
  },
  {
    name: 'Secure & Encrypted',
    description: 'End-to-end encryption for API keys, JWT authentication, and secure session management.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Global Reach',
    description: 'Send messages to any WhatsApp number worldwide. Support for text, images, video, documents, and interactive messages.',
    icon: GlobeAltIcon,
  },
  {
    name: 'Developer API',
    description: 'RESTful API with comprehensive documentation. Webhook support for real-time event notifications.',
    icon: CodeBracketIcon,
  },
]

const stats = [
  { label: 'Messages Delivered', value: '10M+' },
  { label: 'Active Bots', value: '5,000+' },
  { label: 'Uptime', value: '99.9%' },
  { label: 'Happy Customers', value: '2,000+' },
]

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore()

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">WhatsApp API</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/plans" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Pricing
              </Link>
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 to-white pb-16 pt-20 sm:pb-24 sm:pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              WhatsApp API Platform
              <br />
              <span className="text-primary-600">for Modern Businesses</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              Connect, manage, and scale your WhatsApp messaging operations with our powerful API platform.
              Built for developers, designed for growth.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="rounded-xl bg-primary-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="rounded-xl bg-primary-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700"
                  >
                    Start Free Trial
                  </Link>
                  <Link to="/plans" className="flex items-center gap-1 text-base font-semibold text-primary-600 hover:text-primary-700">
                    View Pricing <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-gray-100 bg-gray-50/50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary-600 sm:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-primary-600">Features</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to scale
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Our platform provides all the tools you need to manage WhatsApp messaging at scale,
              from bot management to real-time analytics.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-7xl sm:mt-20 lg:mt-24">
            <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.name} className="relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
                    <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="mt-6 text-lg font-semibold leading-8 text-gray-900">{feature.name}</h3>
                  <p className="mt-2 text-base leading-7 text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Get started in minutes with our simple three-step process.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {[
                {
                  step: '01',
                  title: 'Create Account',
                  description: 'Sign up for free and get instant access to the dashboard. No credit card required.',
                },
                {
                  step: '02',
                  title: 'Connect Bot',
                  description: 'Scan a QR code to connect your WhatsApp number. Multiple bots supported on higher plans.',
                },
                {
                  step: '03',
                  title: 'Start Messaging',
                  description: 'Send messages via API or dashboard. Track delivery and manage conversations in real-time.',
                },
              ].map((item) => (
                <div key={item.step} className="relative text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-600 text-xl font-bold text-white">
                    {item.step}
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-base text-gray-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative isolate overflow-hidden rounded-3xl bg-primary-900 px-6 py-24 text-center shadow-2xl sm:px-16">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-primary-100">
              Choose a plan that fits your needs. Start with our Free plan and upgrade as you grow.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to="/plans"
                className="rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-primary-900 shadow-sm hover:bg-gray-100"
              >
                View Plans
              </Link>
              {!isAuthenticated && (
                <Link to="/register" className="text-base font-semibold text-white hover:text-primary-100">
                  Sign up free <span aria-hidden="true">&rarr;</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">WhatsApp API</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link to="/terms" className="hover:text-gray-900">Terms</Link>
              <Link to="/privacy" className="hover:text-gray-900">Privacy</Link>
              <Link to="/cookies" className="hover:text-gray-900">Cookies</Link>
            </div>
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} WhatsApp API Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
