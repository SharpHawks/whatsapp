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
import { normalizeEmail } from '../../lib/authValidation'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setServerError(null)
    try {
      await login(normalizeEmail(data.email), data.password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Invalid email or password'
      setServerError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage bots, messages, billing, and API keys from your dashboard."
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

          <Input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            label="Password"
            placeholder="Enter your password"
            error={errors.password?.message}
            autoComplete="current-password"
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
        </div>

        {serverError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          className="h-12 w-full text-base"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Sign in
        </Button>

        <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-semibold text-primary-600 hover:text-primary-700"
          >
            Create one
          </Link>
        </div>

        <p className="text-center text-xs text-slate-500">
          Secure authentication for your WhatsApp API workspace.
        </p>
      </form>
    </AuthLayout>
  )
}
