import { useEffect, useState } from 'react'
import LegalPageShell from '../../components/legal/LegalPageShell'
import Button from '../../components/common/Button'
import { clearCookieConsent, getCookieConsent, setCookieConsent } from '../../lib/cookieConsent'
import { useAuthStore } from '../../stores/authStore'

export default function CookiesPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [current, setCurrent] = useState(getCookieConsent())

  useEffect(() => {
    const handler = () => setCurrent(getCookieConsent())
    window.addEventListener('cookie-consent-changed', handler)
    return () => window.removeEventListener('cookie-consent-changed', handler)
  }, [])

  return (
    <LegalPageShell
      title="Cookie Policy"
      updated="April 25, 2026"
      backTo={isAuthenticated ? { label: 'Back to dashboard', to: '/' } : { label: 'Back to sign in', to: '/login' }}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">1. What we use</h2>
        <p>
          We use cookies and similar technologies where needed to operate the service. This includes
          local storage for authentication state in the browser.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">2. Categories</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Strictly necessary:</strong> session/security and core app functionality.
          </li>
          <li>
            <strong>Optional:</strong> analytics or product improvement cookies (only if you enable
            them in your deployment and the user accepts).
          </li>
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">3. Your choice</h2>
        <p>
          You can accept all cookies or limit to essential-only. You can change your choice at any
          time on this page.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => setCookieConsent('essential')}>
            Essential only
          </Button>
          <Button type="button" variant="primary" onClick={() => setCookieConsent('all')}>
            Accept all
          </Button>
          <Button type="button" variant="ghost" onClick={() => clearCookieConsent()}>
            Reset choice
          </Button>
        </div>
        {current && (
          <p className="text-xs text-slate-500">
            Current preference: <strong>{current.choice}</strong> (saved {current.decidedAt})
          </p>
        )}
      </section>
    </LegalPageShell>
  )
}
