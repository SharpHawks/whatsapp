import LegalPageShell from '../../components/legal/LegalPageShell'
import { useAuthStore } from '../../stores/authStore'

export default function TermsPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return (
    <LegalPageShell
      title="Terms of Service"
      updated="April 25, 2026"
      backTo={isAuthenticated ? { label: 'Back to dashboard', to: '/' } : { label: 'Back to sign in', to: '/login' }}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">1. Agreement</h2>
        <p>
          By accessing or using this platform, you agree to these Terms. If you do not agree, do not
          use the service.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">2. Service description</h2>
        <p>
          The platform provides tools to connect messaging automation workflows, manage API access,
          and related account features. Features may change over time.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">3. Acceptable use</h2>
        <p>You agree not to misuse the service, including:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Violating applicable laws or third-party terms (including messaging provider policies)</li>
          <li>Sending spam, phishing, or unlawful content</li>
          <li>Attempting unauthorized access, scraping, or disrupting the service</li>
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">4. Accounts and security</h2>
        <p>
          You are responsible for safeguarding your credentials and for activity under your account.
          Notify us promptly of suspected unauthorized use.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">5. Disclaimer and limitation of liability</h2>
        <p>
          The service is provided &quot;as is&quot; to the maximum extent permitted by law. We are not
          liable for indirect or consequential damages.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">6. Contact</h2>
        <p>
          Insert your legal entity name, address, and contact email for notices. Replace this
          placeholder before going live.
        </p>
      </section>
    </LegalPageShell>
  )
}
