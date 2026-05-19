import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export const createStudioQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 30_000,
      },
    },
  });

type StudioProvidersProps = {
  readonly children: ReactNode;
  readonly queryClient?: QueryClient;
};

export function StudioProviders({ children, queryClient }: StudioProvidersProps): React.JSX.Element {
  const [defaultQueryClient] = useState(() => createStudioQueryClient());
  const client = queryClient ?? defaultQueryClient;

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
