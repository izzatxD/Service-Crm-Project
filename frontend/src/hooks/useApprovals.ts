import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getOrderApprovalsRequest, updateOrderApprovalRequest } from '../lib/api'
import { dashboardKeys } from './useDashboard'
import { orderKeys } from './useOrders'

export const approvalKeys = {
  all: ['approvals'] as const,
  list: () => ['approvals', 'list'] as const,
}

export function useApprovals(accessToken: string, enabled = true) {
  return useQuery({
    queryKey: approvalKeys.list(),
    queryFn: () => getOrderApprovalsRequest(accessToken),
    enabled: enabled && !!accessToken,
  })
}

export function useUpdateApproval(accessToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      approvalId,
      payload,
    }: {
      approvalId: string
      payload: Parameters<typeof updateOrderApprovalRequest>[2]
    }) => updateOrderApprovalRequest(accessToken, approvalId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.all })
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
      if (variables.payload.orderId) {
        queryClient.invalidateQueries({
          queryKey: orderKeys.detail(variables.payload.orderId),
        })
      }
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}
