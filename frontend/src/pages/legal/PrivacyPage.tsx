import LegalPageShell from '../../components/legal/LegalPageShell'
import { useAuthStore } from '../../stores/authStore'

export default function PrivacyPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return (
    <LegalPageShell
      title="Privacy Policy"
      updated="April 25, 2026"
      backTo={isAuthenticated ? { label: 'Back to dashboard', to: '/' } : { label: 'Back to sign in', to: '/login' }}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">1. Who we are</h2>
        <p>
          Describe the data controller (legal name, registration details, contact). This template is
          a starting point only.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">2. Data we process</h2>
        <p>Depending on how you use the platform, we may process:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account data (email, authentication events)</li>
          <li>Service usage and technical logs (IP, device/browser metadata)</li>
          <li>Content you submit through the product workflows</li>
          <li>Billing-related data if you enable payments</li>
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">3. Purposes and legal bases (GDPR)</h2>
        <p>Examples of purposes:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Contract: provide the service you signed up for</li>
          <li>Legitimate interests: security, abuse prevention, product improvement (where allowed)</li>
          <li>Legal obligation: comply with applicable law</li>
          <li>Consent: where required (e.g., certain non-essential cookies or marketing)</li>
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">4. Retention</h2>
        <p>
          Define retention periods per data category. Keep data no longer than necessary for the
          stated purposes.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">5. Processors and transfers</h2>
        <p>
          List subprocessors (hosting, email, analytics, payment). If data is transferred outside the
          EEA, describe safeguards (SCCs, adequacy, etc.).
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">6. Your rights</h2>
        <p>
          Under GDPR, individuals may have rights to access, rectification, erasure, restriction,
          portability, and objection. Provide a contact channel and response timelines.
        </p>
      </section>
    </LegalPageShell>
  )
}
