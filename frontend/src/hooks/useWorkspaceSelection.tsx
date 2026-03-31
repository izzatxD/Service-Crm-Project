import { createContext, useContext } from "react";

import type { Branch, Organization } from "../lib/api";

export type WorkspaceSelectionContextValue = {
  organizationId: string;
  branchId: string;
  organizations: Organization[];
  selectedOrganization: Organization | null;
  availableBranches: Branch[];
  isOrganizationLocked: boolean;
  isOrganizationsLoading: boolean;
  setOrganizationId: (value: string) => void;
  setBranchId: (value: string) => void;
};

export const WorkspaceSelectionContext = createContext<
  WorkspaceSelectionContextValue | undefined
>(undefined);

export function useWorkspaceSelection() {
  const context = useContext(WorkspaceSelectionContext);

  if (!context) {
    throw new Error(
      "useWorkspaceSelection must be used within WorkspaceSelectionProvider.",
    );
  }

  return context;
}
