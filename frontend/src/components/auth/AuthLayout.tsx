import type { ReactNode } from 'react'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

const heroImageUrl =
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1600&q=80'

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-slate-950 lg:grid lg:grid-cols-2">
      <section
        className="relative hidden overflow-hidden lg:flex"
        style={{ backgroundImage: `url(${heroImageUrl})` }}
      >
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/35 via-slate-950/20 to-slate-950/95" />
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-primary-400/30 blur-3xl" />
        <div className="absolute bottom-16 right-10 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />

        <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 xl:p-16">
          <div className="inline-flex w-fit items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
            <span className="h-2.5 w-2.5 rounded-full bg-primary-300 shadow-[0_0_20px_rgba(110,231,183,0.9)]" />
            WhatsApp API Platform
          </div>

          <div className="max-w-xl">
            <p className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary-100 backdrop-blur">
              Messaging infrastructure
            </p>
            <h1 className="text-5xl font-bold tracking-tight text-white xl:text-6xl">
              Launch WhatsApp automations from one clean dashboard.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-200">
              Connect bots, send messages, monitor usage, manage billing, and keep every API key under control.
            </p>
          </div>

          <div className="grid max-w-xl grid-cols-3 gap-3">
            {[
              ['Real-time', 'Bot status'],
              ['Secure', 'API keys'],
              ['Billing', 'Usage control'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white shadow-2xl shadow-slate-950/20 backdrop-blur"
              >
                <p className="text-xs font-medium text-slate-300">{label}</p>
                <p className="mt-1 text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-2xl font-black text-white shadow-xl shadow-primary-600/25 lg:mx-0">
              W
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white lg:text-slate-950">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300 lg:text-slate-500">{subtitle}</p>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-950/20 backdrop-blur sm:p-8">
            {children}
          </div>
        </div>
      </section>
    </main>
  )
}
