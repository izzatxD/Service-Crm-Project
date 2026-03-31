import { useQuery } from '@tanstack/react-query'
import { getDashboardSummaryRequest } from '../lib/api'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (organizationId: string, branchId?: string) =>
    ['dashboard', 'summary', organizationId, branchId ?? 'all'] as const,
}

export function useDashboardSummary(
  accessToken: string,
  organizationId: string,
  branchId?: string,
) {
  return useQuery({
    queryKey: dashboardKeys.summary(organizationId, branchId),
    queryFn: () => getDashboardSummaryRequest(accessToken, organizationId, branchId),
    enabled: !!accessToken && !!organizationId,
    refetchInterval: 1000 * 60 * 3, // har 3 daqiqada avtomatik yangilash
  })
}
