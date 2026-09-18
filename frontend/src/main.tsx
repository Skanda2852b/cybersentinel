import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/Toaster';

import App from './App';
import './index.css';

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Client errors will never succeed on blind retry (the axios interceptor
  // already handles the one legitimate retry: token refresh on 401).
  // Retrying them only multiplies 401/403/429 noise in the console.
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
        <Toaster />
        <ReactQueryDevtools initialIsOpen={false} />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);