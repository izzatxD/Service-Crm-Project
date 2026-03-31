import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createOrderWorkflowRequest,
  deleteOrderRequest,
  getOrderByIdRequest,
  getOrdersRequest,
  updateOrderRequest,
  type CreateOrderWorkflowPayload,
} from '../lib/api'
import { dashboardKeys } from './useDashboard'

// --- Query Keys ---
export const orderKeys = {
  all: ['orders'] as const,
  list: (organizationId: string) => ['orders', 'list', organizationId] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
}

// --- Hooks ---

export function useOrders(
  accessToken: string,
  organizationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: orderKeys.list(organizationId),
    queryFn: () => getOrdersRequest(accessToken, organizationId),
    enabled: enabled && !!accessToken && !!organizationId,
  })
}

export function useOrderDetail(accessToken: string, orderId: string) {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => getOrderByIdRequest(accessToken, orderId),
    enabled: !!accessToken && !!orderId,
  })
}

export function useCreateOrder(accessToken: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOrderWorkflowPayload) =>
      createOrderWorkflowRequest(accessToken, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all })
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useUpdateOrder(accessToken: string, orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Parameters<typeof updateOrderRequest>[2]) =>
      updateOrderRequest(accessToken, orderId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) })
      qc.invalidateQueries({ queryKey: orderKeys.all })
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useDeleteOrder(accessToken: string, organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => deleteOrderRequest(accessToken, orderId),
    onSuccess: (_, orderId) => {
      qc.invalidateQueries({ queryKey: orderKeys.list(organizationId) })
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) })
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}
