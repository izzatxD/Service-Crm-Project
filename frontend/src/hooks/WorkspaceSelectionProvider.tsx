import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "../auth/AuthContext";
import { useOrganizations } from "./useOrganizations";
import type { Organization } from "../lib/api";
import {
  WorkspaceSelectionContext,
  type WorkspaceSelectionContextValue,
} from "./useWorkspaceSelection";

const ORG_KEY = "cariva_workspace_org";
const BRANCH_KEY = "cariva_workspace_branch";

function readStoredValue(key: string) {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function resolveFixedOrganizationId(auth: ReturnType<typeof useAuth>["auth"]) {
  if (!auth || auth.session.isPlatformAdmin) {
    return "";
  }

  return (
    auth.session.organizationId ??
    auth.me?.organization?.id ??
    auth.me?.staffMember?.organizationId ??
    auth.me?.staffMembers[0]?.organizationId ??
    auth.session.organizationIds[0] ??
    ""
  );
}

function resolveOrganizationId(params: {
  currentOrganizationId: string;
  organizations: Organization[];
  fixedOrganizationId: string;
  isOrganizationLocked: boolean;
}) {
  const {
    currentOrganizationId,
    organizations,
    fixedOrganizationId,
    isOrganizationLocked,
  } = params;

  if (isOrganizationLocked && fixedOrganizationId) {
    return fixedOrganizationId;
  }

  if (organizations.length === 0) {
    return fixedOrganizationId || currentOrganizationId;
  }

  if (
    currentOrganizationId &&
    organizations.some(
      (organization) => organization.id === currentOrganizationId,
    )
  ) {
    return currentOrganizationId;
  }

  if (
    fixedOrganizationId &&
    organizations.some(
      (organization) => organization.id === fixedOrganizationId,
    )
  ) {
    return fixedOrganizationId;
  }

  return organizations[0]?.id ?? "";
}

function resolveBranchId(params: {
  currentBranchId: string;
  organizationId: string;
  selectedOrganization: Organization | null;
  isOrganizationsLoading: boolean;
}) {
  const {
    currentBranchId,
    organizationId,
    selectedOrganization,
    isOrganizationsLoading,
  } = params;

  if (!organizationId) {
    return "";
  }

  if (!selectedOrganization) {
    return isOrganizationsLoading ? currentBranchId : "";
  }

  const isCurrentBranchValid = selectedOrganization.branches.some(
    (branch) => branch.id === currentBranchId,
  );

  if (isCurrentBranchValid) {
    return currentBranchId;
  }

  return selectedOrganization.branches.length === 1
    ? (selectedOrganization.branches[0]?.id ?? "")
    : "";
}

export function WorkspaceSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { auth } = useAuth();
  const token = auth?.accessToken ?? "";
  const { data: organizations = [], isLoading: isOrganizationsLoading } =
    useOrganizations(token);

  const [organizationIdState, setOrganizationIdState] = useState(() =>
    readStoredValue(ORG_KEY),
  );
  const [branchIdState, setBranchIdState] = useState(() =>
    readStoredValue(BRANCH_KEY),
  );

  const fixedOrganizationId = useMemo(
    () => resolveFixedOrganizationId(auth),
    [auth],
  );
  const isOrganizationLocked = Boolean(
    auth && !auth.session.isPlatformAdmin && fixedOrganizationId,
  );

  const organizationId = useMemo(
    () =>
      resolveOrganizationId({
        currentOrganizationId: organizationIdState,
        organizations,
        fixedOrganizationId,
        isOrganizationLocked,
      }),
    [
      fixedOrganizationId,
      isOrganizationLocked,
      organizationIdState,
      organizations,
    ],
  );

  const selectedOrganization = useMemo(
    () =>
      organizations.find(
        (organization) => organization.id === organizationId,
      ) ?? null,
    [organizationId, organizations],
  );

  const availableBranches = useMemo(
    () => selectedOrganization?.branches ?? [],
    [selectedOrganization],
  );

  const branchId = useMemo(
    () =>
      resolveBranchId({
        currentBranchId: branchIdState,
        organizationId,
        selectedOrganization,
        isOrganizationsLoading,
      }),
    [
      branchIdState,
      isOrganizationsLoading,
      organizationId,
      selectedOrganization,
    ],
  );

  useEffect(() => {
    if (organizationId) {
      window.localStorage.setItem(ORG_KEY, organizationId);
      return;
    }

    window.localStorage.removeItem(ORG_KEY);
  }, [organizationId]);

  useEffect(() => {
    if (branchId) {
      window.localStorage.setItem(BRANCH_KEY, branchId);
      return;
    }

    window.localStorage.removeItem(BRANCH_KEY);
  }, [branchId]);

  const setOrganizationId = useCallback(
    (value: string) => {
      const nextOrganizationId =
        isOrganizationLocked && fixedOrganizationId
          ? fixedOrganizationId
          : value;

      if (nextOrganizationId !== organizationId) {
        setBranchIdState("");
      }

      setOrganizationIdState(nextOrganizationId);
    },
    [fixedOrganizationId, isOrganizationLocked, organizationId],
  );

  const setBranchId = useCallback(
    (value: string) => {
      if (!selectedOrganization || !value) {
        setBranchIdState("");
        return;
      }

      const nextBranchId = selectedOrganization.branches.some(
        (branch) => branch.id === value,
      )
        ? value
        : "";

      setBranchIdState(nextBranchId);
    },
    [selectedOrganization],
  );

  const value = useMemo<WorkspaceSelectionContextValue>(
    () => ({
      organizationId,
      branchId,
      organizations,
      selectedOrganization,
      availableBranches,
      isOrganizationLocked,
      isOrganizationsLoading,
      setOrganizationId,
      setBranchId,
    }),
    [
      availableBranches,
      branchId,
      isOrganizationLocked,
      isOrganizationsLoading,
      organizationId,
      organizations,
      selectedOrganization,
      setBranchId,
      setOrganizationId,
    ],
  );

  return (
    <WorkspaceSelectionContext.Provider value={value}>
      {children}
    </WorkspaceSelectionContext.Provider>
  );
}
