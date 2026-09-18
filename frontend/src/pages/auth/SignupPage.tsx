import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button, Input, useToast } from '@/components/ui';
import { useRegister, useMe } from '@/api/hooks';

const signupSchema = z.object({
  firstName: z.string().trim().max(100, 'First name is too long').optional(),
  lastName: z.string().trim().max(100, 'Last name is too long').optional(),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type SignupForm = z.infer<typeof signupSchema>;

export function SignupPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { mutate: register, isPending: isLoading } = useRegister();
  const { refetch: refetchUser } = useMe();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    register(
      {
        email: data.email,
        password: data.password,
        firstName: data.firstName?.trim() || undefined,
        lastName: data.lastName?.trim() || undefined,
      },
      {
        onSuccess: async () => {
          addToast({ type: 'success', title: 'Account created!', message: 'You have been signed in.' });
          await refetchUser();
          navigate('/dashboard');
        },
        onError: (error: any) => {
          const status = error.response?.status;
          addToast({
            type: 'error',
            title: 'Sign up failed',
            message:
              status === 409
                ? 'An account with this email already exists. Try signing in instead.'
                : error.response?.data?.message || 'Could not create your account',
          });
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <p className="section-label">New operator</p>
        <h2 className="font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Create account</h2>
        <p className="text-gray-500 dark:text-gray-400">
          New accounts start with view-only access. An admin can grant more permissions later.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            {...registerField('firstName')}
            label="First name"
            placeholder="Ada"
            error={errors.firstName?.message}
            autoComplete="given-name"
            disabled={isLoading}
          />
          <Input
            {...registerField('lastName')}
            label="Last name"
            placeholder="Lovelace"
            error={errors.lastName?.message}
            autoComplete="family-name"
            disabled={isLoading}
          />
        </div>

        <Input
          {...registerField('email')}
          type="email"
          label="Email"
          placeholder="you@company.com"
          error={errors.email?.message}
          autoComplete="email"
          disabled={isLoading}
        />

        <div className="relative">
          <Input
            {...registerField('password')}
            type={showPassword ? 'text' : 'password'}
            label="Password"
            placeholder="••••••••"
            error={errors.password?.message}
            autoComplete="new-password"
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

        <Input
          {...registerField('confirmPassword')}
          type={showPassword ? 'text' : 'password'}
          label="Confirm password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          autoComplete="new-password"
          disabled={isLoading}
        />

        <Button type="submit" className="w-full" loading={isLoading}>
          {isLoading && <Loader2 className="w-5 h-5 mr-2" />}
          Create account
        </Button>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}
