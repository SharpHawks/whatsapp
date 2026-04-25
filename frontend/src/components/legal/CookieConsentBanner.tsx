import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../common/Button'
import { getCookieConsent, setCookieConsent } from '../../lib/cookieConsent'

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const sync = () => {
      setVisible(!getCookieConsent())
    }
    sync()
    const handler = () => sync()
    window.addEventListener('cookie-consent-changed', handler)
    return () => window.removeEventListener('cookie-consent-changed', handler)
  }, [])

  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center p-4 sm:p-6"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-2xl shadow-slate-900/20 backdrop-blur">
        <p className="text-sm font-semibold text-slate-950">Cookies and similar technologies</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          We use essential storage to keep you signed in and secure. Optional cookies help us improve
          the product. Read the{' '}
          <Link to="/cookies" className="font-semibold text-primary-600 hover:text-primary-700">
            Cookie Policy
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="font-semibold text-primary-600 hover:text-primary-700">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            className="sm:flex-1"
            onClick={() => {
              setCookieConsent('essential')
              setVisible(false)
            }}
          >
            Essential only
          </Button>
          <Button
            type="button"
            variant="primary"
            className="sm:flex-1"
            onClick={() => {
              setCookieConsent('all')
              setVisible(false)
            }}
          >
            Accept all
          </Button>
        </div>
      </div>
    </div>
  )
}
