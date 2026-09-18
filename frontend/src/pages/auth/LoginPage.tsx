import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button, Input, useToast } from '@/components/ui';
import { useLogin, useMe } from '@/api/hooks';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { mutate: login, isPending: isLoading } = useLogin();
  const { refetch: refetchUser } = useMe();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: false },
  });

  const onSubmit = async (data: LoginForm) => {
    login({ email: data.email, password: data.password }, {
      onSuccess: async () => {
        addToast({ type: 'success', title: 'Welcome back!', message: 'You have been signed in.' });
        await refetchUser();
        navigate('/dashboard');
      },
      onError: (error: any) => {
        addToast({
          type: 'error',
          title: 'Sign in failed',
          message: error.response?.data?.message || 'Invalid credentials',
        });
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <p className="section-label">Operator access</p>
        <h2 className="font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Sign in</h2>
        <p className="text-gray-500 dark:text-gray-400">Enter your credentials to access the console</p>
      </div>

      <div className="space-y-4">
        <Input
          {...register('email')}
          type="email"
          label="Email"
          placeholder="admin@cybersentinel.local"
          error={errors.email?.message}
          autoComplete="email"
          disabled={isLoading}
        />

        <div className="relative">
          <Input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            label="Password"
            placeholder="••••••••"
            error={errors.password?.message}
            autoComplete="current-password"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input {...register('remember')} type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
          </label>
          <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" loading={isLoading}>
          {isLoading && <Loader2 className="w-5 h-5 mr-2" />}
          Sign in
        </Button>
      </div>

      <div className="border-t border-gray-200 dark:border-white/[0.07] pt-4 space-y-3">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
            Sign up
          </Link>
        </p>
        <div className="rounded-xl bg-gray-50 dark:bg-white/[0.04] ring-1 ring-inset ring-gray-200/70 dark:ring-white/[0.07] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 text-center mb-1.5">Demo access</p>
          <p className="text-center text-xs font-mono text-gray-600 dark:text-gray-300">
            admin@cybersentinel.local <span className="text-gray-300 dark:text-gray-600">/</span> admin123
          </p>
        </div>
      </div>
    </form>
  );
}