const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

export type LoginResponse = {
  accessToken: string;
  authType?: "staff" | "platform_admin";
  userId: string | null;
  accountId?: string | null;
  staffMemberId?: string | null;
  organizationId?: string | null;
  organizationSlug?: string | null;
  email: string | null;
  loginIdentifier?: string | null;
  isPlatformAdmin: boolean;
  sessionVersion?: number;
  mustChangePassword?: boolean;
  organizationIds: string[];
  permissionCodes: string[];
};

export type MeResponse = {
  authType?: "staff" | "platform_admin";
  id?: string;
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
  isActive?: boolean;
  isPlatformAdmin?: boolean;
  account?: {
    id: string;
    loginIdentifier: string | null;
    telegramUserId: string | null;
    authMode: string;
    isActive: boolean;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
    verifiedAt: string | null;
    sessionVersion: number;
  } | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currencyCode: string;
  } | null;
  branchAccess?: {
    mode: "all" | "platform";
    branches: Branch[];
  } | null;
  staffMember?: {
    id: string;
    fullName: string;
    primaryRole: string;
    isActive: boolean;
    organizationId: string;
    assignedRoles: Array<{
      id: string;
      roleId: string;
      roleCode: string;
      roleName: string;
      expiresAt: string | null;
    }>;
  } | null;
  platformAdminProfile: {
    roleCode: string;
    isActive: boolean;
  } | null;
  platformAdmin?: {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
    platformAdminProfile: {
      roleCode: string;
      isActive: boolean;
      canManageOrganizations: boolean;
      canManageAuth: boolean;
      canImpersonateUsers: boolean;
    };
  } | null;
  staffMembers: Array<{
    id: string;
    fullName: string;
    primaryRole: string;
    organizationId: string;
  }>;
  organizationIds?: string[];
  permissionCodes?: string[];
};

export type Branch = {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  phone: string | null;
  addressLine: string | null;
  isActive: boolean;
  createdAt: string;
};

export type Organization = {
  id: string;
  name: string;
  businessTypeCode: string;
  timezone: string;
  currencyCode: string;
  isActive: boolean;
  createdAt: string;
  branches: Branch[];
};

export type Permission = {
  id: string;
  code: string;
  name: string;
  category: string | null;
};

export type Role = {
  id: string;
  organizationId: string | null;
  code: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  rolePermissions?: Array<{
    permissionId: string;
    permission: Permission;
  }>;
};

export type StaffMember = {
  id: string;
  organizationId: string;
  userId: string;
  fullName: string;
  primaryRole: string;
  isActive: boolean;
  hiredAt: string | null;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    isActive: boolean;
  };
  organization: {
    id: string;
    name: string;
  };
  assignedRoles: Array<{
    id: string;
    role: Role;
  }>;
};

export type StaffProfile = {
  staffMember: StaffMember;
  summary: {
    totalTaskCount: number;
    activeTaskCount: number;
    completedTaskCount: number;
    pausedTaskCount: number;
    completionRate: number;
    assignedOrderCount: number;
    activeAssignmentCount: number;
    completedAssignmentCount: number;
    requestedApprovalCount: number;
    approvedDecisionCount: number;
    rejectedDecisionCount: number;
    pendingDecisionCount: number;
    paymentCount: number;
    collectedAmount: number;
  };
  activeTasks: Array<{
    id: string;
    title: string;
    status: string;
    estimatedLaborAmount: string | number;
    startedAt: string | null;
    updatedAt: string;
    order: {
      id: string;
      orderNumber: string;
      status: string;
      openedAt: string;
      client: {
        fullName: string;
      };
      asset: {
        displayName: string;
      };
    };
  }>;
  recentCompletedTasks: Array<{
    id: string;
    title: string;
    status: string;
    actualLaborAmount: string | number;
    completedAt: string | null;
    order: {
      id: string;
      orderNumber: string;
      status: string;
      closedAt: string | null;
      deliveredAt: string | null;
      client: {
        fullName: string;
      };
      asset: {
        displayName: string;
      };
    };
  }>;
  recentAssignments: Array<{
    id: string;
    status: string;
    note: string | null;
    assignedAt: string;
    assignmentTypeCode: string;
    order: {
      id: string;
      orderNumber: string;
      status: string;
    };
    orderTask: {
      id: string;
      title: string;
    } | null;
    fromStaff: {
      id: string;
      fullName: string;
    } | null;
    toStaff: {
      id: string;
      fullName: string;
    };
    assignedByStaff: {
      id: string;
      fullName: string;
    };
    acceptedByStaff: {
      id: string;
      fullName: string;
    } | null;
  }>;
  recentApprovals: Array<{
    id: string;
    status: string;
    approvalTypeCode: string;
    requestNote: string | null;
    decisionNote: string | null;
    requestedAt: string;
    decidedAt: string | null;
    perspective: "requested" | "decided";
    order: {
      id: string;
      orderNumber: string;
      status: string;
    };
    requestedByStaff?: {
      id: string;
      fullName: string;
    } | null;
    approvedByStaff?: {
      id: string;
      fullName: string;
    } | null;
  }>;
  recentPayments: Array<{
    id: string;
    paymentMethodCode: string;
    amount: string | number;
    paidAt: string;
    note: string | null;
    order: {
      id: string;
      orderNumber: string;
      status: string;
      client: {
        fullName: string;
      };
      asset: {
        displayName: string;
      };
    };
  }>;
};

export type ClientItem = {
  id: string;
  organizationId: string;
  fullName: string;
  phone: string | null;
  note: string | null;
  createdAt: string;
  assets: Array<{
    id: string;
    displayName: string;
    assetTypeCode: string;
    vehicleProfile?: {
      plateNumber?: string | null;
    } | null;
  }>;
};

export type OrderItem = {
  id: string;
  organizationId: string;
  orderNumber: string;
  status: string;
  priority: string;
  openedAt: string;
  client: {
    fullName: string;
    phone: string | null;
  };
  asset: {
    displayName: string;
  };
  branch: {
    id: string;
    name: string;
  };
  tasks: Array<{
    id: string;
    lineNo?: number;
    title: string;
    status: string;
    estimatedLaborAmount?: string | number;
    assignedStaff?: {
      id: string;
      fullName: string;
    } | null;
  }>;
  financial: {
    id: string;
    subtotalLaborAmount: string | number;
    subtotalPartsAmount: string | number;
    discountAmount: string | number;
    taxAmount: string | number;
    grandTotalAmount: string | number;
    paidTotalAmount: string | number;
    balanceDueAmount: string | number;
  } | null;
};

export type OrderTaskPart = {
  id: string;
  organizationId: string;
  orderTaskId: string;
  inventoryItemId: string;
  quantity: string | number;
  unitCostAmount: string | number;
  unitPriceAmount: string | number;
  orderTask: {
    id: string;
    title: string;
    orderId: string;
  };
  inventoryItem: {
    id: string;
    name: string;
    sku: string | null;
    unitName: string;
  };
};

export type OrderAssignment = {
  id: string;
  status: string;
  note?: string | null;
  assignmentTypeCode?: string | null;
  orderTask?: {
    id: string;
    title: string;
  } | null;
  fromStaff?: {
    fullName: string;
  } | null;
  toStaff?: {
    fullName: string;
  } | null;
  assignedByStaff?: {
    fullName: string;
  } | null;
  acceptedByStaff?: {
    fullName: string;
  } | null;
};

export type OrderApproval = {
  id: string;
  organizationId?: string;
  status: string;
  approvalTypeCode: string;
  requestedAt?: string;
  decidedAt?: string | null;
  requestNote?: string | null;
  decisionNote?: string | null;
  order?: {
    id: string;
    orderNumber: string;
    status?: string;
  } | null;
  requestedByStaff?: {
    id?: string;
    fullName: string;
  } | null;
  approvedByStaff?: {
    id?: string;
    fullName: string;
  } | null;
};

export type OrderDetail = OrderItem & {
  customerRequestText?: string | null;
  intakeNotes?: string | null;
  internalDiagnosisText?: string | null;
  createdByStaff?: {
    id: string;
    fullName: string;
  } | null;
  assignedManager?: {
    id: string;
    fullName: string;
  } | null;
  assignments?: OrderAssignment[];
  approvals?: OrderApproval[];
  statusHistory?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    createdAt: string;
    note: string | null;
  }>;
};

export type CreateOrderWorkflowPayload = {
  organizationId: string;
  branchId: string;
  orderNumber?: string;
  createdByStaffId: string;
  assignedManagerId?: string;
  customerRequestText?: string;
  intakeNotes?: string;
  internalDiagnosisText?: string;
  status?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  client: {
    fullName: string;
    phone?: string;
    note?: string;
  };
  asset: {
    assetTypeCode: "vehicle";
    displayName: string;
    note?: string;
  };
  vehicleProfile?: {
    make?: string;
    model?: string;
    year?: number;
    plateNumber?: string;
  };
  tasks?: Array<{
    lineNo: number;
    title: string;
    assignedStaffId?: string;
    status?: string;
    estimatedLaborAmount?: number;
    actualLaborAmount?: number;
    note?: string;
  }>;
};

export type DashboardSummary = {
  scope: {
    organizationId: string;
    branchId: string | null;
  };
  orders: {
    total: number;
    today: number;
    active: number;
    completed: number;
    cancelled: number;
    byStatus: Array<{
      status: string;
      count: number;
    }>;
  };
  finance: {
    grandTotal: number;
    paidTotal: number;
    balanceDue: number;
    laborTotal: number;
    partsTotal: number;
    todayPayments: number;
    expensesTotal: number;
    overdueBalanceOrders: number;
    topDebtors: Array<{
      id: string;
      orderNumber: string;
      status: string;
      clientName: string;
      assetName: string;
      paidTotalAmount: number;
      balanceDueAmount: number;
    }>;
  };
  inventory: {
    outOfStockItems: number;
  };
  generatedAt: string;
};

export type InventoryItem = {
  id: string;
  organizationId: string;
  itemTypeCode: string;
  sku: string | null;
  name: string;
  unitName: string;
  costPrice: string | number;
  salePrice: string | number;
  isActive: boolean;
  note: string | null;
};

export type InventoryStock = {
  id: string;
  branchId: string;
  quantityOnHand: string | number;
  reorderLevel: string | number;
  inventoryItem: InventoryItem;
  branch: {
    id: string;
    name: string;
  };
};

export type StockMovement = {
  id: string;
  movementType: string;
  quantity: string | number;
  unitCostAmount: string | number;
  note: string | null;
  createdAt: string;
  inventoryItem: InventoryItem;
  branch: {
    id: string;
    name: string;
  };
};

export type PaymentMethod = {
  id: string;
  organizationId: string;
  paymentMethodCode: string;
  isActive: boolean;
};

export type Payment = {
  id: string;
  organizationId: string;
  orderId: string;
  paymentMethodCode: string;
  amount: string | number;
  paidAt: string;
  note: string | null;
  order: {
    id: string;
    orderNumber: string;
  };
  receivedByStaff: {
    id: string;
    fullName: string;
  } | null;
};

export type RoleAssignment = {
  id: string;
  organizationId: string;
  staffMemberId: string;
  roleId: string;
  assignedByStaffId?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  role: Role;
};

export type ExpenseCategory = {
  id: string;
  organizationId: string;
  code: string | null;
  name: string;
  isActive: boolean;
};

export type Expense = {
  id: string;
  organizationId: string;
  title: string;
  amount: string | number;
  expenseDate: string;
  note: string | null;
  branch: {
    id: string;
    name: string;
  } | null;
  expenseCategory: {
    id: string;
    name: string;
  };
  relatedOrder: {
    id: string;
    orderNumber: string;
  } | null;
  createdByStaff: {
    id: string;
    fullName: string;
  } | null;
};

export type CreateOrganizationPayload = {
  name: string;
  businessTypeCode?: string;
  timezone?: string;
  currencyCode?: string;
};

export type CreateBranchPayload = {
  organizationId: string;
  name: string;
  code?: string;
  phone?: string;
  addressLine?: string;
};

export type CreateStaffPayload = {
  organizationId: string;
  fullName: string;
  primaryRole: "admin" | "manager" | "worker" | "cashier" | "viewer";
  email: string;
  phone?: string;
  password: string;
};

export type CreateInventoryItemPayload = {
  organizationId: string;
  itemTypeCode: "part" | "consumable" | "other";
  name: string;
  sku?: string;
  unitName?: string;
  costPrice?: number;
  salePrice?: number;
  note?: string;
};

export type CreateStockMovementPayload = {
  organizationId: string;
  inventoryItemId: string;
  branchId: string;
  movementType:
    | "purchase"
    | "usage"
    | "adjustment"
    | "transfer_in"
    | "transfer_out"
    | "return_in"
    | "return_out"
    | "opening_balance"
    | "correction";
  quantity: number;
  unitCostAmount?: number;
  createdByStaffId: string;
  note?: string;
};

export type CreatePaymentPayload = {
  organizationId: string;
  orderId: string;
  paymentMethodCode: "cash" | "card" | "bank_transfer" | "online" | "other";
  amount: number;
  paidAt: string;
  receivedByStaffId?: string;
  note?: string;
};

export type CreateExpenseCategoryPayload = {
  organizationId: string;
  name: string;
  code?: string;
};

export type CreateExpensePayload = {
  organizationId: string;
  branchId?: string;
  expenseCategoryId: string;
  title: string;
  amount: number;
  relatedOrderId?: string;
  createdByStaffId?: string;
  expenseDate: string;
  note?: string;
};

type ApiErrorPayload = {
  message?: string | string[];
  error?: string;
};

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return typeof value === "object" && value !== null;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T | ApiErrorPayload) : null;

  if (!response.ok) {
    let message = "Request failed.";

    if (isApiErrorPayload(data)) {
      if (Array.isArray(data.message)) {
        message = data.message.join(", ");
      } else if (typeof data.message === "string") {
        message = data.message;
      } else if (typeof data.error === "string") {
        message = data.error;
      }
    }

    throw new Error(message);
  }

  return data as T;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  accessToken?: string,
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : {}),
        ...(init?.headers ?? {}),
      },
    });

    return parseJson<T>(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Server bilan bog'lanib bo'lmadi. Backend ishlayotganini tekshirib ko'ring.",
      );
    }

    throw error;
  }
}

export async function loginRequest(loginIdentifier: string, password: string) {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      loginIdentifier,
      password,
    }),
  });
}

export async function getMeRequest(accessToken: string) {
  return request<MeResponse>("/auth/me", undefined, accessToken);
}

export async function getOrganizationsRequest(accessToken: string) {
  return request<Organization[]>("/organizations", undefined, accessToken);
}

export async function createOrganizationRequest(
  accessToken: string,
  payload: CreateOrganizationPayload,
) {
  return request<Organization>(
    "/organizations",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function createBranchRequest(
  accessToken: string,
  payload: CreateBranchPayload,
) {
  return request<Branch>(
    "/branches",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function getDashboardSummaryRequest(
  accessToken: string,
  organizationId: string,
  branchId?: string,
) {
  const params = new URLSearchParams({ organizationId });
  if (branchId) {
    params.set("branchId", branchId);
  }

  return request<DashboardSummary>(
    `/dashboard/summary?${params.toString()}`,
    undefined,
    accessToken,
  );
}

export async function getStaffRequest(
  accessToken: string,
  organizationId: string,
) {
  return request<StaffMember[]>(
    `/staff?organizationId=${organizationId}`,
    undefined,
    accessToken,
  );
}

export async function getStaffProfileRequest(
  accessToken: string,
  staffId: string,
) {
  return request<StaffProfile>(
    `/staff/${staffId}/profile`,
    undefined,
    accessToken,
  );
}

export async function getClientsRequest(
  accessToken: string,
  organizationId: string,
) {
  return request<ClientItem[]>(
    `/clients?organizationId=${organizationId}`,
    undefined,
    accessToken,
  );
}

export async function createStaffRequest(
  accessToken: string,
  payload: CreateStaffPayload,
) {
  return request<StaffMember>(
    "/staff",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function getRolesRequest(
  accessToken: string,
  organizationId?: string,
) {
  const search = organizationId ? `?organizationId=${organizationId}` : "";
  return request<Role[]>(`/rbac/roles${search}`, undefined, accessToken);
}

export async function createRoleRequest(
  accessToken: string,
  payload: {
    organizationId: string;
    code: string;
    name: string;
    description?: string;
    isSystemRole?: boolean;
    permissionIds?: string[];
  },
) {
  return request<Role>(
    "/rbac/roles",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function updateRoleRequest(
  accessToken: string,
  roleId: string,
  payload: {
    organizationId?: string;
    code?: string;
    name?: string;
    description?: string;
    isSystemRole?: boolean;
    isActive?: boolean;
    permissionIds?: string[];
  },
) {
  return request<Role>(
    `/rbac/roles/${roleId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function deleteRoleRequest(accessToken: string, roleId: string) {
  return request<Role>(
    `/rbac/roles/${roleId}`,
    { method: "DELETE" },
    accessToken,
  );
}

export async function getPermissionsRequest(accessToken: string) {
  return request<Permission[]>("/rbac/permissions", undefined, accessToken);
}

export async function assignRoleRequest(
  accessToken: string,
  payload: {
    organizationId: string;
    staffMemberId: string;
    roleId: string;
    assignedByStaffId?: string;
    expiresAt?: string;
  },
) {
  return request<RoleAssignment>(
    "/rbac/assignments",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function removeRoleAssignmentRequest(
  accessToken: string,
  assignmentId: string,
) {
  return request<RoleAssignment>(
    `/rbac/assignments/${assignmentId}`,
    {
      method: "DELETE",
    },
    accessToken,
  );
}

export async function getOrdersRequest(
  accessToken: string,
  organizationId: string,
) {
  return request<OrderItem[]>(
    `/orders?organizationId=${organizationId}`,
    undefined,
    accessToken,
  );
}

export async function createOrderWorkflowRequest(
  accessToken: string,
  payload: CreateOrderWorkflowPayload,
) {
  return request<OrderItem>(
    "/orders/workflow",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function getInventoryItemsRequest(
  accessToken: string,
  organizationId: string,
) {
  return request<InventoryItem[]>(
    `/inventory-items?organizationId=${organizationId}`,
    undefined,
    accessToken,
  );
}

export async function getInventoryStocksRequest(
  accessToken: string,
  branchId: string,
) {
  return request<InventoryStock[]>(
    `/inventory-stocks?branchId=${branchId}`,
    undefined,
    accessToken,
  );
}

export async function getStockMovementsRequest(
  accessToken: string,
  branchId: string,
) {
  return request<StockMovement[]>(
    `/stock-movements?branchId=${branchId}`,
    undefined,
    accessToken,
  );
}

export async function createInventoryItemRequest(
  accessToken: string,
  payload: CreateInventoryItemPayload,
) {
  return request<InventoryItem>(
    "/inventory-items",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function createStockMovementRequest(
  accessToken: string,
  payload: CreateStockMovementPayload,
) {
  return request<StockMovement>(
    "/stock-movements",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function getPaymentMethodsRequest(
  accessToken: string,
  organizationId: string,
) {
  return request<PaymentMethod[]>(
    `/payment-methods?organizationId=${organizationId}`,
    undefined,
    accessToken,
  );
}

export async function getPaymentsRequest(accessToken: string, orderId: string) {
  return request<Payment[]>(
    `/payments?orderId=${orderId}`,
    undefined,
    accessToken,
  );
}

export async function createPaymentRequest(
  accessToken: string,
  payload: CreatePaymentPayload,
) {
  return request<Payment>(
    "/payments",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function getExpenseCategoriesRequest(
  accessToken: string,
  organizationId: string,
) {
  return request<ExpenseCategory[]>(
    `/expense-categories?organizationId=${organizationId}`,
    undefined,
    accessToken,
  );
}

export async function createExpenseCategoryRequest(
  accessToken: string,
  payload: CreateExpenseCategoryPayload,
) {
  return request<ExpenseCategory>(
    "/expense-categories",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function getExpensesRequest(
  accessToken: string,
  organizationId: string,
) {
  return request<Expense[]>(
    `/expenses?organizationId=${organizationId}`,
    undefined,
    accessToken,
  );
}

export async function createExpenseRequest(
  accessToken: string,
  payload: CreateExpensePayload,
) {
  return request<Expense>(
    "/expenses",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function getOrderByIdRequest(
  accessToken: string,
  orderId: string,
) {
  return request<OrderDetail>(`/orders/${orderId}`, undefined, accessToken);
}

export async function updateOrderRequest(
  accessToken: string,
  orderId: string,
  payload: Partial<{
    status: string;
    customerRequestText: string;
    intakeNotes: string;
    internalDiagnosisText: string;
    assignedManagerId: string | null;
    payment: {
      cash?: number;
      card?: number;
    };
  }>,
) {
  return request<OrderDetail>(
    `/orders/${orderId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function deleteOrderRequest(accessToken: string, orderId: string) {
  return request<{ id: string }>(
    `/orders/${orderId}`,
    {
      method: "DELETE",
    },
    accessToken,
  );
}

export async function updateOrderFinancialRequest(
  accessToken: string,
  financialId: string,
  payload: Partial<{
    orderId: string;
    organizationId: string;
    subtotalLaborAmount: number;
    subtotalPartsAmount: number;
    discountAmount: number;
    taxAmount: number;
    grandTotalAmount: number;
    paidTotalAmount: number;
    balanceDueAmount: number;
  }>,
) {
  return request<OrderDetail["financial"]>(
    `/order-financials/${financialId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function createOrderTaskRequest(
  accessToken: string,
  payload: {
    organizationId: string;
    orderId: string;
    lineNo: number;
    title: string;
    assignedStaffId?: string;
    estimatedLaborAmount?: number;
    actualLaborAmount?: number;
    note?: string;
  },
) {
  return request<OrderDetail["tasks"][number]>(
    "/order-tasks",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function updateOrderTaskRequest(
  accessToken: string,
  taskId: string,
  payload: Partial<{
    organizationId: string;
    orderId: string;
    lineNo: number;
    serviceId: string;
    title: string;
    assignedStaffId: string;
    status: string;
    estimatedLaborAmount: number;
    actualLaborAmount: number;
    note: string;
  }>,
) {
  return request<OrderDetail["tasks"][number]>(
    `/order-tasks/${taskId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function createOrderAssignmentRequest(
  accessToken: string,
  payload: {
    organizationId: string;
    orderId: string;
    orderTaskId?: string;
    fromStaffId?: string;
    toStaffId: string;
    assignedByStaffId: string;
    acceptedByStaffId?: string;
    assignmentTypeCode?: string;
    status?:
      | "assigned"
      | "accepted"
      | "in_progress"
      | "completed"
      | "cancelled";
    note?: string;
  },
) {
  return request<OrderAssignment>(
    "/order-assignments",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function createOrderApprovalRequest(
  accessToken: string,
  payload: {
    organizationId: string;
    orderId: string;
    requestedByStaffId: string;
    approvedByStaffId?: string;
    status?: "pending" | "approved" | "rejected" | "cancelled";
    approvalTypeCode?: string;
    requestNote?: string;
    decisionNote?: string;
  },
) {
  return request<OrderApproval>(
    "/order-approvals",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function getOrderApprovalsRequest(
  accessToken: string,
  orderId?: string,
) {
  const search = orderId ? `?orderId=${orderId}` : "";
  return request<OrderApproval[]>(
    `/order-approvals${search}`,
    undefined,
    accessToken,
  );
}

export async function updateOrderApprovalRequest(
  accessToken: string,
  approvalId: string,
  payload: Partial<{
    organizationId: string;
    orderId: string;
    requestedByStaffId: string;
    approvedByStaffId: string;
    status: "pending" | "approved" | "rejected" | "cancelled";
    approvalTypeCode: string;
    requestNote: string;
    decisionNote: string;
  }>,
) {
  return request<OrderApproval>(
    `/order-approvals/${approvalId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export async function getOrderTaskPartsRequest(
  accessToken: string,
  orderTaskId: string,
) {
  return request<OrderTaskPart[]>(
    `/order-task-parts?orderTaskId=${orderTaskId}`,
    undefined,
    accessToken,
  );
}

export async function createOrderTaskPartRequest(
  accessToken: string,
  payload: {
    organizationId: string;
    orderTaskId: string;
    inventoryItemId: string;
    quantity: number;
    unitCostAmount: number;
    unitPriceAmount: number;
  },
) {
  return request<OrderTaskPart>(
    "/order-task-parts",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export { API_BASE_URL };
