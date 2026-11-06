import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { ErroApi } from '@/api/client';
import { ProvedorAuth } from '@/auth/AuthProvider';
import { roteador } from './router';

const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Não insiste em erros de cliente (4xx) nem em 429; tenta 1x em rede/5xx.
      retry: (count, error) => {
        if (error instanceof ErroApi && error.status >= 400 && error.status < 500) return false;
        return count < 1;
      },
    },
    mutations: { retry: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={clienteConsultas}>
      <ProvedorAuth>
        {/* reducedMotion="user": motion respeita prefers-reduced-motion automaticamente */}
        <MotionConfig reducedMotion="user">
          <RouterProvider router={roteador} />
        </MotionConfig>
        <Toaster
          theme="dark"
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: '#161c18',
              border: '1px solid rgb(236 239 234 / 0.14)',
              color: '#ecefea',
              fontFamily: 'var(--font-sans)',
            },
          }}
        />
      </ProvedorAuth>
    </QueryClientProvider>
  );
}
