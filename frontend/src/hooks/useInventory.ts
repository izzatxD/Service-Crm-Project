import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createInventoryItemRequest,
  createStockMovementRequest,
  getInventoryItemsRequest,
  getInventoryStocksRequest,
  getStockMovementsRequest,
  type CreateInventoryItemPayload,
  type CreateStockMovementPayload,
} from '../lib/api'

export const inventoryKeys = {
  items: (organizationId: string) => ['inventory', 'items', organizationId] as const,
  stocks: (branchId: string) => ['inventory', 'stocks', branchId] as const,
  movements: (branchId: string) => ['inventory', 'movements', branchId] as const,
}

export function useInventoryItems(accessToken: string, organizationId: string) {
  return useQuery({
    queryKey: inventoryKeys.items(organizationId),
    queryFn: () => getInventoryItemsRequest(accessToken, organizationId),
    enabled: !!accessToken && !!organizationId,
  })
}

export function useInventoryStocks(accessToken: string, branchId: string) {
  return useQuery({
    queryKey: inventoryKeys.stocks(branchId),
    queryFn: () => getInventoryStocksRequest(accessToken, branchId),
    enabled: !!accessToken && !!branchId,
  })
}

export function useStockMovements(accessToken: string, branchId: string) {
  return useQuery({
    queryKey: inventoryKeys.movements(branchId),
    queryFn: () => getStockMovementsRequest(accessToken, branchId),
    enabled: !!accessToken && !!branchId,
  })
}

export function useCreateInventoryItem(accessToken: string, organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateInventoryItemPayload) =>
      createInventoryItemRequest(accessToken, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.items(organizationId) })
    },
  })
}

export function useCreateStockMovement(accessToken: string, branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateStockMovementPayload) =>
      createStockMovementRequest(accessToken, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.stocks(branchId) })
      qc.invalidateQueries({ queryKey: inventoryKeys.movements(branchId) })
    },
  })
}
