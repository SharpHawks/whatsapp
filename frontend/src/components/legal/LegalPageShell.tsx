import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface LegalPageShellProps {
  title: string
  updated: string
  children: ReactNode
  backTo?: { label: string; to: string }
}

export default function LegalPageShell({ title, updated, children, backTo }: LegalPageShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {backTo && (
          <Link
            to={backTo.to}
            className="text-sm font-semibold text-primary-400 hover:text-primary-300"
          >
            ← {backTo.label}
          </Link>
        )}
        <header className={backTo ? 'mt-6' : ''}>
          <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-2 text-sm text-slate-400">Last updated: {updated}</p>
        </header>
        <article className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-white/95 p-6 text-sm leading-7 text-slate-700 shadow-2xl sm:p-8">
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            This is a template for product teams. It is not legal advice. Have it reviewed by
            qualified counsel before production use.
          </p>
          {children}
        </article>
        <footer className="mt-8 flex flex-wrap gap-4 text-sm font-semibold text-slate-400">
          <Link to="/terms" className="hover:text-white">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link to="/cookies" className="hover:text-white">
            Cookies
          </Link>
        </footer>
      </div>
    </div>
  )
}
