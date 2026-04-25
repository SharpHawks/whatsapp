import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../../stores/authStore'
import toast from 'react-hot-toast'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import AuthLayout from '../../components/auth/AuthLayout'
import { isStrongPassword, normalizeEmail, passwordRequirements } from '../../lib/authValidation'

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').refine(isStrongPassword, {
    message: 'Password must include uppercase, lowercase, number, and special character',
  }),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const { register: registerUser } = useAuthStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const password = watch('password', '')

  const getPasswordStrength = (pwd: string): { strength: number; label: string; color: string } => {
    if (!pwd) return { strength: 0, label: '', color: '' }
    
    let strength = 0
    if (pwd.length >= 8) strength++
    if (pwd.length >= 12) strength++
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++
    if (/\d/.test(pwd)) strength++
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++

    if (strength <= 2) return { strength, label: 'Weak', color: 'bg-red-500' }
    if (strength <= 3) return { strength, label: 'Medium', color: 'bg-amber-500' }
    return { strength, label: 'Strong', color: 'bg-emerald-500' }
  }

  const passwordStrength = getPasswordStrength(password)

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    setServerError(null)
    try {
      await registerUser(normalizeEmail(data.email), data.password)
      toast.success('Account created successfully!')
      navigate('/')
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Registration failed. Please try again.'
      setServerError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start your WhatsApp API workspace and connect your first bot in minutes."
    >
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <Input
            {...register('email')}
            type="email"
            label="Email address"
            placeholder="you@example.com"
            error={errors.email?.message}
            autoComplete="email"
          />

          <div>
            <Input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              label="Password"
              placeholder="Create a password"
              error={errors.password?.message}
              autoComplete="new-password"
              rightElement={
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-500 hover:text-primary-700"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              }
            />
            {password && (
              <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                  <span>Password strength</span>
                  <span className="font-semibold">{passwordStrength.label}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                  />
                </div>
                <div className="mt-3 grid gap-1.5 text-xs">
                  {passwordRequirements.map((requirement) => {
                    const isMet = requirement.test(password)
                    return (
                      <div
                        key={requirement.label}
                        className={isMet ? 'text-emerald-700' : 'text-slate-500'}
                      >
                        {isMet ? '✓' : '•'} {requirement.label}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <Input
            {...register('confirmPassword')}
            type={showConfirmPassword ? 'text' : 'password'}
            label="Confirm password"
            placeholder="Confirm your password"
            error={errors.confirmPassword?.message}
            autoComplete="new-password"
            rightElement={
              <button
                type="button"
                className="text-xs font-semibold text-slate-500 hover:text-primary-700"
                onClick={() => setShowConfirmPassword((value) => !value)}
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            }
          />
        </div>

        {serverError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          By creating an account, you agree to the platform Terms of Service and Privacy Policy.
        </p>

        <Button
          type="submit"
          variant="primary"
          className="h-12 w-full text-base"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Create account
        </Button>

        <div className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-primary-600 hover:text-primary-700"
          >
            Sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
