import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignRoleRequest,
  createRoleRequest,
  deleteRoleRequest,
  getPermissionsRequest,
  getRolesRequest,
  removeRoleAssignmentRequest,
  updateRoleRequest,
} from '../lib/api'
import { organizationKeys } from './useOrganizations'

// --- Query Keys ---
export const roleKeys = {
  all: ['roles'] as const,
  list: (organizationId?: string) => ['roles', 'list', organizationId] as const,
  permissions: ['permissions'] as const,
}

// --- Hooks ---

export function useRoles(accessToken: string, organizationId?: string) {
  return useQuery({
    queryKey: roleKeys.list(organizationId),
    queryFn: () => getRolesRequest(accessToken, organizationId),
    enabled: !!accessToken,
  })
}

export function usePermissions(accessToken: string) {
  return useQuery({
    queryKey: roleKeys.permissions,
    queryFn: () => getPermissionsRequest(accessToken),
    enabled: !!accessToken,
  })
}

export function useCreateRole(accessToken: string, organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Parameters<typeof createRoleRequest>[1]) =>
      createRoleRequest(accessToken, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roleKeys.list(organizationId) })
      qc.invalidateQueries({ queryKey: roleKeys.list(undefined) })
    },
  })
}

export function useUpdateRole(accessToken: string, organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateRoleRequest>[2] }) =>
      updateRoleRequest(accessToken, id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roleKeys.list(organizationId) })
      qc.invalidateQueries({ queryKey: roleKeys.list(undefined) })
      qc.invalidateQueries({ queryKey: organizationKeys.staff(organizationId) })
      qc.invalidateQueries({ queryKey: ['organizations', 'staff-profile'] })
    },
  })
}

export function useDeleteRole(accessToken: string, organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRoleRequest(accessToken, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roleKeys.list(organizationId) })
      qc.invalidateQueries({ queryKey: roleKeys.list(undefined) })
    },
  })
}

export function useAssignRole(accessToken: string, organizationId: string, staffMemberId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Parameters<typeof assignRoleRequest>[1]) =>
      assignRoleRequest(accessToken, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: organizationKeys.staff(organizationId) })
      if (staffMemberId) {
        qc.invalidateQueries({
          queryKey: organizationKeys.staffProfile(staffMemberId),
        })
      }
    },
  })
}

export function useRemoveRoleAssignment(
  accessToken: string,
  organizationId: string,
  staffMemberId?: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assignmentId: string) =>
      removeRoleAssignmentRequest(accessToken, assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: organizationKeys.staff(organizationId) })
      if (staffMemberId) {
        qc.invalidateQueries({
          queryKey: organizationKeys.staffProfile(staffMemberId),
        })
      }
    },
  })
}
