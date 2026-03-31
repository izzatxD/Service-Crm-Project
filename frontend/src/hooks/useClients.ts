import { useQuery } from '@tanstack/react-query'

import { getClientsRequest } from '../lib/api'

export const clientKeys = {
  all: ['clients'] as const,
  list: (organizationId: string) => ['clients', 'list', organizationId] as const,
}

export function useClients(
  accessToken: string,
  organizationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: clientKeys.list(organizationId),
    queryFn: () => getClientsRequest(accessToken, organizationId),
    enabled: enabled && !!accessToken && !!organizationId,
  })
}
