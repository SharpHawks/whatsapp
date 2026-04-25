export type CookieConsentChoice = 'essential' | 'all'

export interface CookieConsentState {
  choice: CookieConsentChoice
  decidedAt: string
}

const STORAGE_KEY = 'whatsapp_cookie_consent_v1'

export function getCookieConsent(): CookieConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CookieConsentState
    if (parsed.choice !== 'essential' && parsed.choice !== 'all') return null
    if (!parsed.decidedAt) return null
    return parsed
  } catch {
    return null
  }
}

export function setCookieConsent(choice: CookieConsentChoice): void {
  const state: CookieConsentState = {
    choice,
    decidedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: state }))
}

export function clearCookieConsent(): void {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: null }))
}
