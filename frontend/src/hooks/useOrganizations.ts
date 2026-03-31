import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createBranchRequest,
  createOrganizationRequest,
  createStaffRequest,
  getOrganizationsRequest,
  getStaffProfileRequest,
  getStaffRequest,
  type CreateBranchPayload,
  type CreateOrganizationPayload,
  type CreateStaffPayload,
} from '../lib/api'

export const organizationKeys = {
  all: ['organizations'] as const,
  list: () => ['organizations', 'list'] as const,
  staff: (organizationId: string) => ['organizations', 'staff', organizationId] as const,
  staffProfile: (staffId: string) => ['organizations', 'staff-profile', staffId] as const,
}

export function useOrganizations(accessToken: string) {
  return useQuery({
    queryKey: organizationKeys.list(),
    queryFn: () => getOrganizationsRequest(accessToken),
    enabled: !!accessToken,
    staleTime: 1000 * 60 * 5, // 5 daqiqa - firmalar kamdan-kam o'zgaradi
  })
}

export function useStaff(
  accessToken: string,
  organizationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: organizationKeys.staff(organizationId),
    queryFn: () => getStaffRequest(accessToken, organizationId),
    enabled: enabled && !!accessToken && !!organizationId,
  })
}

export function useCreateOrganization(accessToken: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOrganizationPayload) =>
      createOrganizationRequest(accessToken, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: organizationKeys.all })
    },
  })
}

export function useStaffProfile(
  accessToken: string,
  staffId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: organizationKeys.staffProfile(staffId),
    queryFn: () => getStaffProfileRequest(accessToken, staffId),
    enabled: enabled && !!accessToken && !!staffId,
  })
}

export function useCreateBranch(accessToken: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateBranchPayload) =>
      createBranchRequest(accessToken, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: organizationKeys.all })
    },
  })
}

export function useCreateStaff(accessToken: string, organizationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateStaffPayload) =>
      createStaffRequest(accessToken, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: organizationKeys.staff(organizationId) })
    },
  })
}
