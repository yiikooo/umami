import type { ReactQueryOptions } from '@/lib/types';
import { useApi } from '../useApi';
import { useModified } from '../useModified';
import { usePagedQuery } from '../usePagedQuery';

export function usePixelsQuery(options?: ReactQueryOptions) {
  const { modified } = useModified('pixels');
  const { get } = useApi();

  return usePagedQuery({
    queryKey: ['pixels', { modified }],
    queryFn: pageParams => {
      return get('/pixels', pageParams);
    },
    ...options,
  });
}
