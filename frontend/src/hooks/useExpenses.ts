import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createExpenseCategoryRequest,
  createExpenseRequest,
  getExpenseCategoriesRequest,
  getExpensesRequest,
  type CreateExpenseCategoryPayload,
  type CreateExpensePayload,
} from '../lib/api'
import { dashboardKeys } from './useDashboard'
import { orderKeys } from './useOrders'

export const expenseKeys = {
  list: (organizationId: string) => ['expenses', 'list', organizationId] as const,
  categories: (organizationId: string) => ['expenses', 'categories', organizationId] as const,
}

export function useExpenses(
  accessToken: string,
  organizationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: expenseKeys.list(organizationId),
    queryFn: () => getExpensesRequest(accessToken, organizationId),
    enabled: enabled && !!accessToken && !!organizationId,
  })
}

export function useExpenseCategories(
  accessToken: string,
  organizationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: expenseKeys.categories(organizationId),
    queryFn: () => getExpenseCategoriesRequest(accessToken, organizationId),
    enabled: enabled && !!accessToken && !!organizationId,
    staleTime: 1000 * 60 * 10, // kategoriyalar kamdan-kam o'zgaradi
  })
}

export function useCreateExpense(accessToken: string, organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateExpensePayload) =>
      createExpenseRequest(accessToken, payload),
    onSuccess: (_, payload) => {
      qc.invalidateQueries({ queryKey: expenseKeys.list(organizationId) })
      if (payload.relatedOrderId) {
        qc.invalidateQueries({ queryKey: orderKeys.detail(payload.relatedOrderId) })
        qc.invalidateQueries({ queryKey: orderKeys.all })
      }
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useCreateExpenseCategory(accessToken: string, organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateExpenseCategoryPayload) =>
      createExpenseCategoryRequest(accessToken, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.categories(organizationId) })
    },
  })
}
