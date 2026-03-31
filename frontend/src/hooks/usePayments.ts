import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPaymentRequest,
  getPaymentMethodsRequest,
  getPaymentsRequest,
  type CreatePaymentPayload,
} from '../lib/api'
import { dashboardKeys } from './useDashboard'
import { orderKeys } from './useOrders'

export const paymentKeys = {
  list: (orderId: string) => ['payments', 'list', orderId] as const,
  methods: (organizationId: string) => ['payments', 'methods', organizationId] as const,
}

export function usePayments(accessToken: string, orderId: string) {
  return useQuery({
    queryKey: paymentKeys.list(orderId),
    queryFn: () => getPaymentsRequest(accessToken, orderId),
    enabled: !!accessToken && !!orderId,
  })
}

export function usePaymentMethods(
  accessToken: string,
  organizationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: paymentKeys.methods(organizationId),
    queryFn: () => getPaymentMethodsRequest(accessToken, organizationId),
    enabled: enabled && !!accessToken && !!organizationId,
    staleTime: 1000 * 60 * 10, // 10 daqiqa - payment methods kamdan-kam o'zgaradi
  })
}

export function useCreatePayment(accessToken: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePaymentPayload) =>
      createPaymentRequest(accessToken, payload),
    onSuccess: (_, payload) => {
      qc.invalidateQueries({ queryKey: paymentKeys.list(payload.orderId) })
      qc.invalidateQueries({ queryKey: orderKeys.detail(payload.orderId) })
      qc.invalidateQueries({ queryKey: orderKeys.all })
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}
