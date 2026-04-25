export const passwordRequirements = [
  {
    label: 'At least 8 characters',
    test: (password: string) => password.length >= 8,
  },
  {
    label: 'Uppercase and lowercase letters',
    test: (password: string) => /[A-Z]/.test(password) && /[a-z]/.test(password),
  },
  {
    label: 'At least one number',
    test: (password: string) => /\d/.test(password),
  },
  {
    label: 'At least one special character',
    test: (password: string) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
  },
]

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isStrongPassword(password: string): boolean {
  return passwordRequirements.every((requirement) => requirement.test(password))
}
