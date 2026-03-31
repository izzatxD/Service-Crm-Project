import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { hasPermission } from "../auth/access";
import WorkspaceLayout from "../components/WorkspaceLayout";
import { OrderCheckoutModal } from "../components/OrderCheckoutModal";
import {
  createPaymentRequest,
  createOrderApprovalRequest,
  createOrderAssignmentRequest,
  createOrderTaskPartRequest,
  createOrderTaskRequest,
  getPaymentMethodsRequest,
  getPaymentsRequest,
  getStaffRequest,
  getInventoryItemsRequest,
  getOrderByIdRequest,
  getOrderTaskPartsRequest,
  updateOrderTaskRequest,
  updateOrderFinancialRequest,
  updateOrderRequest,
  type InventoryItem,
  type OrderDetail,
  type OrderTaskPart,
  type Payment,
  type PaymentMethod,
  type StaffMember,
} from "../lib/api";
import {
  getApprovalStatusLabel,
  getApprovalTypeLabel,
  getAssignmentStatusLabel,
  getOrderNextStepLabel,
  getOrderStageLabel,
  getOrderStatusLabel,
  getPaymentMethodLabel,
} from "../lib/labels";
import { formatMoneyUzs, formatDateTimeUz } from "../lib/format";

const BASE_STATUS_OPTIONS = [
  "new",
  "pending_diagnosis",
  "estimated",
  "approved",
  "in_progress",
  "waiting_parts",
  "completed",
  "delivered",
  "cancelled",
];

const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ["pending_diagnosis", "estimated", "cancelled"],
  pending_diagnosis: ["estimated", "in_progress", "cancelled"],
  estimated: ["approved", "cancelled"],
  approved: ["in_progress", "waiting_parts", "cancelled"],
  in_progress: ["waiting_parts", "completed", "cancelled"],
  waiting_parts: ["in_progress", "completed", "cancelled"],
  completed: ["delivered"],
  delivered: [],
  cancelled: [],
};

const taskStatusOptions = [
  { value: "pending", label: "Kutilmoqda" },
  { value: "in_progress", label: "Jarayonda" },
  { value: "waiting_parts", label: "Detal kutilmoqda" },
  { value: "completed", label: "Tugagan" },
  { value: "cancelled", label: "Bekor qilingan" },
] as const;

const FALLBACK_PAYMENT_METHOD_CODES = [
  "cash",
  "card",
  "bank_transfer",
  "online",
  "other",
] as const;

function readSettledValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  resourceLabel: string,
) {
  if (result.status === "fulfilled") {
    return result.value;
  }

  console.warn(`[OrderDetailPage] ${resourceLabel} yuklanmadi.`, result.reason);
  return fallback;
}

function getTaskStatusLabel(status: string) {
  return (
    taskStatusOptions.find((item) => item.value === status)?.label ?? status
  );
}

function buildStatusOptions(currentStatus: string) {
  const nextOptions = ORDER_STATUS_TRANSITIONS[currentStatus] ?? [];
  const uniqueOptions = Array.from(new Set([currentStatus, ...nextOptions]));

  return uniqueOptions.sort((left, right) => {
    return (
      BASE_STATUS_OPTIONS.indexOf(left) - BASE_STATUS_OPTIONS.indexOf(right)
    );
  });
}

function OrderDetailPage() {
  const { auth } = useAuth();
  const { id = "" } = useParams();
  const token = auth?.accessToken ?? "";
  const canUpdateOrder = hasPermission(auth, "order.update");
  const canUpdateTask = hasPermission(auth, "task.update");
  const canAssignOrder = hasPermission(auth, "order.assign");
  const canApproveOrder = hasPermission(auth, "order.approve");
  const canReadOrder = hasPermission(auth, "order.read");
  const canReadPayments = hasPermission(auth, "payment.read");
  const canCreatePayment = hasPermission(auth, "payment.create");
  const canLoadPaymentMethods = canCreatePayment || canReadPayments;
  const canLoadInventoryItems =
    canUpdateOrder || canAssignOrder || canApproveOrder || canCreatePayment;
  const canLoadStaffMembers =
    canUpdateOrder || canAssignOrder || canApproveOrder;
  const canReadTaskParts =
    hasPermission(auth, "inventory.read") ||
    canReadOrder ||
    canUpdateOrder ||
    canApproveOrder;
  // Sotuv menejeri: order.approve yoki order.update yoki order.create bo'lsa ishlar/detallar boshqarishi mumkin
  const canManageOrderContent = canUpdateOrder || canApproveOrder;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [status, setStatus] = useState("new");
  const [intakeNotes, setIntakeNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskEstimate, setTaskEstimate] = useState("");
  const [partTaskId, setPartTaskId] = useState("");
  const [partItemId, setPartItemId] = useState("");
  const [partQuantity, setPartQuantity] = useState("1");
  const [partUnitPrice, setPartUnitPrice] = useState("");
  const [assignmentTaskId, setAssignmentTaskId] = useState("");
  const [assignmentStaffId, setAssignmentStaffId] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");
  const [approvalTypeCode, setApprovalTypeCode] = useState("estimate");
  const [approvalNote, setApprovalNote] = useState("");
  const [paymentMethodCode, setPaymentMethodCode] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentPaidAt, setPaymentPaidAt] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 16);
  });
  const [paymentNote, setPaymentNote] = useState("");
  const [laborEstimate, setLaborEstimate] = useState("0");
  const [partsEstimate, setPartsEstimate] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [taskParts, setTaskParts] = useState<OrderTaskPart[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [taskStatusUpdatingId, setTaskStatusUpdatingId] = useState("");

  const taskSummary = useMemo(() => {
    if (!order) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        openTasks: 0,
      };
    }

    const totalTasks = order.tasks.length;
    const completedTasks = order.tasks.filter(
      (task) => task.status === "completed",
    ).length;

    return {
      totalTasks,
      completedTasks,
      openTasks: totalTasks - completedTasks,
      isAllCompleted: totalTasks > 0 && totalTasks === completedTasks,
    };
  }, [order]);

  const estimateSummary = useMemo(() => {
    const labor = Number(laborEstimate || 0);
    const parts = Number(partsEstimate || 0);
    const discount = Number(discountAmount || 0);
    const tax = Number(taxAmount || 0);
    const paid = Number(order?.financial?.paidTotalAmount ?? 0);
    const total = labor + parts - discount + tax;
    const balance = total - paid;

    return { labor, parts, discount, tax, paid, total, balance };
  }, [
    discountAmount,
    laborEstimate,
    order?.financial?.paidTotalAmount,
    partsEstimate,
    taxAmount,
  ]);

  const selectedInventoryItem = useMemo(
    () => inventoryItems.find((item) => item.id === partItemId) ?? null,
    [inventoryItems, partItemId],
  );

  const selectedTaskParts = useMemo(() => {
    return taskParts.filter((part) => part.orderTaskId === partTaskId);
  }, [partTaskId, taskParts]);

  const currentStaffMember = useMemo(() => {
    return (
      auth?.me?.staffMembers.find(
        (staff) => staff.organizationId === order?.organizationId,
      ) ?? null
    );
  }, [auth?.me?.staffMembers, order?.organizationId]);

  const statusOptions = useMemo(() => {
    if (!order?.status) {
      return BASE_STATUS_OPTIONS;
    }

    return buildStatusOptions(order.status);
  }, [order?.status]);

  const paymentMethodOptions = useMemo(() => {
    const codes = paymentMethods.length
      ? paymentMethods.map((method) => method.paymentMethodCode)
      : [...FALLBACK_PAYMENT_METHOD_CODES];

    return Array.from(new Set(codes));
  }, [paymentMethods]);

  const recommendedStatusActions = useMemo(() => {
    if (!order) {
      return [];
    }

    const baseActions = (ORDER_STATUS_TRANSITIONS[order.status] ?? []).map(
      (nextStatus) => {
        let disabledReason = "";

        if (nextStatus === "completed") {
          if (!taskSummary.totalTasks) {
            disabledReason = "Avval kamida bitta ish qo'shing.";
          } else if (taskSummary.openTasks > 0) {
            disabledReason = "Barcha ishlar tugamaguncha yakunlab bo'lmaydi.";
          }
        }

        // 'delivered' modal orqali to'lov qabul qilib, so'ng status o'zgatiriladi,
        // shu sababli qarz bo'lsa ham bu tugmani bosishga ruxsat beramiz.

        return {
          value: nextStatus,
          label: getOrderStatusLabel(nextStatus),
          disabled: Boolean(disabledReason),
          disabledReason,
        };
      },
    );

    return baseActions;
  }, [order, taskSummary.openTasks, taskSummary.totalTasks]);

  const nextTaskLineNo = useMemo(() => {
    if (!order?.tasks.length) {
      return 1;
    }

    return (
      order.tasks.reduce((maxLine, task) => {
        return Math.max(maxLine, Number(task.lineNo ?? 0));
      }, 0) + 1
    );
  }, [order?.tasks]);

  function canOperateTask(task: NonNullable<OrderDetail["tasks"]>[number]) {
    if (canUpdateOrder) return true;
    if (!canUpdateTask || !currentStaffMember) return false;
    return task.assignedStaff?.id === currentStaffMember.id;
  }

  const taskPartsByTask = useMemo(() => {
    return (
      order?.tasks.reduce<Record<string, OrderTaskPart[]>>(
        (accumulator, task) => {
          accumulator[task.id] = taskParts.filter(
            (part) => part.orderTaskId === task.id,
          );
          return accumulator;
        },
        {},
      ) ?? {}
    );
  }, [order?.tasks, taskParts]);

  const workflowSteps = useMemo(() => {
    const currentStatus = order?.status ?? "new";
    const hasTasks = (order?.tasks.length ?? 0) > 0;
    const hasAssignments = (order?.assignments?.length ?? 0) > 0;
    const hasApprovals = (order?.approvals?.length ?? 0) > 0;
    const hasPayments = payments.length > 0;

    return [
      {
        title: "Qabul va diagnoz",
        description:
          "Mijoz muammosi, qabul eslatmasi va ichki diagnozni tekshiring.",
        state:
          currentStatus === "new" || currentStatus === "pending_diagnosis"
            ? "Hozir shu bosqichda"
            : "Tayyor",
      },
      {
        title: "Ish va smeta",
        description:
          "Ishlar va detallarni kiriting, taxminiy narxni shakllantiring.",
        state: hasTasks ? "Tayyor" : "Kutilyapti",
      },
      {
        title: "Biriktirish va tasdiq",
        description: "Ustaga bering va kerak bo'lsa tasdiq so'rovini yozing.",
        state: hasAssignments || hasApprovals ? "Jarayonda" : "Kutilyapti",
      },
      {
        title: "To'lov va yakun",
        description: "To'lovni yozing va zakaz holatini tugallang.",
        state: hasPayments ? "Jarayonda" : "Kutilyapti",
      },
    ];
  }, [
    order?.approvals?.length,
    order?.assignments?.length,
    order?.status,
    order?.tasks.length,
    payments.length,
  ]);

  useEffect(() => {
    if (!paymentMethodOptions.length) {
      return;
    }

    if (!paymentMethodOptions.includes(paymentMethodCode)) {
      setPaymentMethodCode(paymentMethodOptions[0] ?? "cash");
    }
  }, [paymentMethodCode, paymentMethodOptions]);

  const loadTaskParts = useCallback(
    async (orderTasks: Array<{ id: string }>) => {
      if (!canReadTaskParts || !orderTasks.length) {
        return [] as OrderTaskPart[];
      }

      const results = await Promise.allSettled(
        orderTasks.map((task) => getOrderTaskPartsRequest(token, task.id)),
      );

      return results.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );
    },
    [canReadTaskParts, token],
  );

  const loadOrderRuntimeData = useCallback(
    async (data: OrderDetail) => {
      const [paymentsResult, taskPartsResult] = await Promise.allSettled([
        canReadPayments
          ? getPaymentsRequest(token, data.id)
          : Promise.resolve([] as Payment[]),
        loadTaskParts(data.tasks),
      ]);

      return {
        payments: readSettledValue(
          paymentsResult,
          [] as Payment[],
          "To'lovlar ro'yxati",
        ),
        taskParts: readSettledValue(
          taskPartsResult,
          [] as OrderTaskPart[],
          "Ish detallar ro'yxati",
        ),
      };
    },
    [canReadPayments, loadTaskParts, token],
  );

  const loadOrderSetupData = useCallback(
    async (data: OrderDetail) => {
      const [paymentMethodsResult, inventoryItemsResult, staffResult] =
        await Promise.allSettled([
          canLoadPaymentMethods
            ? getPaymentMethodsRequest(token, data.organizationId)
            : Promise.resolve([] as PaymentMethod[]),
          canLoadInventoryItems
            ? getInventoryItemsRequest(token, data.organizationId)
            : Promise.resolve([] as InventoryItem[]),
          canLoadStaffMembers
            ? getStaffRequest(token, data.organizationId)
            : Promise.resolve([] as StaffMember[]),
        ]);

      return {
        paymentMethods: readSettledValue(
          paymentMethodsResult,
          [] as PaymentMethod[],
          "To'lov usullari",
        ),
        inventoryItems: readSettledValue(
          inventoryItemsResult,
          [] as InventoryItem[],
          "Sklad mahsulotlari",
        ),
        staffMembers: readSettledValue(
          staffResult,
          [] as StaffMember[],
          "Xodimlar ro'yxati",
        ),
      };
    },
    [canLoadInventoryItems, canLoadPaymentMethods, canLoadStaffMembers, token],
  );

  const refreshOrder = useCallback(
    async (orderId: string) => {
      const data = await getOrderByIdRequest(token, orderId);
      const runtimeData = await loadOrderRuntimeData(data);

      setOrder(data);
      setPayments(runtimeData.payments);
      setTaskParts(runtimeData.taskParts);
      setStatus(data.status);
      setLaborEstimate(
        String(Number(data.financial?.subtotalLaborAmount ?? 0)),
      );
      setPartsEstimate(
        String(Number(data.financial?.subtotalPartsAmount ?? 0)),
      );
      setDiscountAmount(String(Number(data.financial?.discountAmount ?? 0)));
      setTaxAmount(String(Number(data.financial?.taxAmount ?? 0)));
      setPartTaskId((current) => current || data.tasks[0]?.id || "");
      setAssignmentTaskId((current) => current || data.tasks[0]?.id || "");

      return data;
    },
    [loadOrderRuntimeData, token],
  );

  useEffect(() => {
    if (!token || !id) return;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const data = await getOrderByIdRequest(token, id);
        const [runtimeData, setupData] = await Promise.all([
          loadOrderRuntimeData(data),
          loadOrderSetupData(data),
        ]);

        setOrder(data);
        setPayments(runtimeData.payments);
        setTaskParts(runtimeData.taskParts);
        setStatus(data.status);
        setPaymentMethods(setupData.paymentMethods);
        setInventoryItems(setupData.inventoryItems);
        setStaffMembers(setupData.staffMembers);
        setIntakeNotes(data.intakeNotes ?? "");
        setDiagnosis(data.internalDiagnosisText ?? "");
        setLaborEstimate(
          String(Number(data.financial?.subtotalLaborAmount ?? 0)),
        );
        setPartsEstimate(
          String(Number(data.financial?.subtotalPartsAmount ?? 0)),
        );
        setDiscountAmount(String(Number(data.financial?.discountAmount ?? 0)));
        setTaxAmount(String(Number(data.financial?.taxAmount ?? 0)));
        setPartTaskId(data.tasks[0]?.id ?? "");
        setAssignmentTaskId(data.tasks[0]?.id ?? "");
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Zakaz topilmadi.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [
    canLoadInventoryItems,
    canLoadPaymentMethods,
    canLoadStaffMembers,
    canReadPayments,
    canReadTaskParts,
    id,
    loadOrderRuntimeData,
    loadOrderSetupData,
    token,
  ]);

  async function handleCheckoutConfirm(cashAmount: number, cardAmount: number) {
    if (!token || !order) return;

    setError("");
    setMessage("");

    try {
      await updateOrderRequest(token, order.id, {
        status: "delivered",
        payment: {
          cash: cashAmount,
          card: cardAmount,
        },
      });
      await refreshOrder(order.id);
      setMessage("Zakaz tugatildi va hisob-kitob saqlandi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zakaz tugatilmadi.");
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !id || !order) return;

    setError("");
    setMessage("");

    if (!status) {
      setError("Zakaz holatini tanlang.");
      return;
    }

    if (status === "delivered" && order.status !== "delivered") {
      setCheckoutModalOpen(true);
      return;
    }

    try {
      await updateOrderRequest(token, id, {
        status,
        intakeNotes,
        internalDiagnosisText: diagnosis,
      });
      await refreshOrder(id);
      setMessage("Zakaz yangilandi.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Zakaz yangilanmadi.",
      );
    }
  }

  async function handleQuickStatusChange(nextStatus: string) {
    if (!token || !order) return;

    if (nextStatus === "delivered" && order.status !== "delivered") {
      setCheckoutModalOpen(true);
      return;
    }

    setError("");
    setMessage("");

    try {
      await updateOrderRequest(token, order.id, {
        status: nextStatus,
      });

      await refreshOrder(order.id);
      setMessage(`Zakaz holati "${getOrderStatusLabel(nextStatus)}" ga o'tdi.`);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Holat yangilanmadi.",
      );
    }
  }

  async function handleEstimateSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !order?.financial?.id) return;

    setError("");
    setMessage("");

    try {
      const updatedFinancial = await updateOrderFinancialRequest(
        token,
        order.financial.id,
        {
          orderId: order.id,
          organizationId: order.organizationId,
          subtotalLaborAmount: estimateSummary.labor,
          subtotalPartsAmount: estimateSummary.parts,
          discountAmount: estimateSummary.discount,
          taxAmount: estimateSummary.tax,
          grandTotalAmount: estimateSummary.total,
          paidTotalAmount: estimateSummary.paid,
          balanceDueAmount: estimateSummary.balance,
        },
      );

      setOrder((current) =>
        current
          ? {
              ...current,
              financial: updatedFinancial,
            }
          : current,
      );
      setMessage("Taxminiy narx yangilandi.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Taxminiy narx yangilanmadi.",
      );
    }
  }

  async function handleTaskCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !order) return;

    setError("");
    setMessage("");

    if (!taskTitle.trim()) {
      setError("Ish nomini kiriting.");
      return;
    }

    if (Number(taskEstimate || 0) < 0) {
      setError("Ish summasi manfiy bo'lishi mumkin emas.");
      return;
    }

    try {
      await createOrderTaskRequest(token, {
        organizationId: order.organizationId,
        orderId: order.id,
        lineNo: nextTaskLineNo,
        title: taskTitle,
        estimatedLaborAmount: Number(taskEstimate || 0),
        actualLaborAmount: 0,
      });

      const data = await getOrderByIdRequest(token, order.id);
      const partsPerTask = await loadTaskParts(data.tasks);
      setOrder(data);
      setTaskParts(partsPerTask);
      setLaborEstimate(
        String(Number(data.financial?.subtotalLaborAmount ?? 0)),
      );
      setPartTaskId((current) => current || data.tasks[0]?.id || "");
      setAssignmentTaskId((current) => current || data.tasks[0]?.id || "");
      setTaskTitle("");
      setTaskEstimate("");
      setMessage("Ish qo'shildi va taxminiy summa yangilandi.");
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Ish qo'shilmadi.",
      );
    }
  }

  async function handleTaskStatusChange(taskId: string, nextStatus: string) {
    if (!token || !order) return;

    setError("");
    setMessage("");
    setTaskStatusUpdatingId(taskId);

    try {
      await updateOrderTaskRequest(token, taskId, {
        status: nextStatus,
      });

      const data = await getOrderByIdRequest(token, order.id);
      setOrder(data);
      setMessage("Ish holati yangilandi.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Ish holati yangilanmadi.",
      );
    } finally {
      setTaskStatusUpdatingId("");
    }
  }

  async function handlePartCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !order) return;

    setError("");
    setMessage("");

    if (!partTaskId) {
      setError("Avval ishni tanlang.");
      return;
    }

    if (!partItemId) {
      setError("Avval detalni tanlang.");
      return;
    }

    if (!partQuantity.trim()) {
      setError("Detal sonini kiriting.");
      return;
    }

    if (Number(partQuantity || 0) <= 0) {
      setError("Detal soni 0 dan katta bo'lishi kerak.");
      return;
    }

    try {
      const fallbackPrice = Number(selectedInventoryItem?.salePrice ?? 0);
      const unitPrice = Number(partUnitPrice || fallbackPrice);

      await createOrderTaskPartRequest(token, {
        organizationId: order.organizationId,
        orderTaskId: partTaskId,
        inventoryItemId: partItemId,
        quantity: Number(partQuantity || 1),
        unitCostAmount: Number(selectedInventoryItem?.costPrice ?? 0),
        unitPriceAmount: unitPrice,
      });

      const data = await getOrderByIdRequest(token, order.id);
      const partsPerTask = await loadTaskParts(data.tasks);

      setOrder(data);
      setTaskParts(partsPerTask);
      setPartsEstimate(
        String(Number(data.financial?.subtotalPartsAmount ?? 0)),
      );
      setLaborEstimate(
        String(Number(data.financial?.subtotalLaborAmount ?? 0)),
      );
      setPartItemId("");
      setPartQuantity("1");
      setPartUnitPrice("");
      setMessage("Detal qo'shildi va summa yangilandi.");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Detal qo'shilmadi.",
      );
    }
  }

  async function handleAssignmentCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !order || !currentStaffMember) return;

    setError("");
    setMessage("");

    if (!assignmentStaffId) {
      setError("Biriktirish uchun xodim tanlang.");
      return;
    }

    try {
      await createOrderAssignmentRequest(token, {
        organizationId: order.organizationId,
        orderId: order.id,
        orderTaskId: assignmentTaskId || undefined,
        toStaffId: assignmentStaffId,
        assignedByStaffId: currentStaffMember.id,
        status: "assigned",
        assignmentTypeCode: assignmentTaskId
          ? "task_assignment"
          : "order_assignment",
        note: assignmentNote || undefined,
      });

      const data = await getOrderByIdRequest(token, order.id);
      setOrder(data);
      setAssignmentStaffId("");
      setAssignmentNote("");
      setMessage("Ish ustaga biriktirildi.");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Biriktirish saqlanmadi.",
      );
    }
  }

  async function handleApprovalCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !order || !currentStaffMember) return;

    setError("");
    setMessage("");

    if (!approvalTypeCode) {
      setError("Tasdiq turini tanlang.");
      return;
    }

    try {
      await createOrderApprovalRequest(token, {
        organizationId: order.organizationId,
        orderId: order.id,
        requestedByStaffId: currentStaffMember.id,
        status: "pending",
        approvalTypeCode,
        requestNote: approvalNote || undefined,
      });

      const data = await getOrderByIdRequest(token, order.id);
      setOrder(data);
      setApprovalTypeCode("estimate");
      setApprovalNote("");
      setMessage("Tasdiq so'rovi qo'shildi.");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Tasdiq saqlanmadi.",
      );
    }
  }

  async function handlePaymentCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !order || !currentStaffMember) return;

    setError("");
    setMessage("");

    if (!paymentAmount.trim()) {
      setError("To'lov summasini kiriting.");
      return;
    }

    if (Number(paymentAmount || 0) <= 0) {
      setError("To'lov summasi 0 dan katta bo'lishi kerak.");
      return;
    }

    try {
      await createPaymentRequest(token, {
        organizationId: order.organizationId,
        orderId: order.id,
        paymentMethodCode: paymentMethodCode as
          | "cash"
          | "card"
          | "bank_transfer"
          | "online"
          | "other",
        amount: Number(paymentAmount || 0),
        paidAt: paymentPaidAt,
        receivedByStaffId: currentStaffMember.id,
        note: paymentNote || undefined,
      });

      await refreshOrder(order.id);
      setPaymentAmount("");
      setPaymentNote("");
      setMessage("To'lov qo'shildi.");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "To'lov saqlanmadi.",
      );
    }
  }

  return (
    <WorkspaceLayout>
      <section className="hero-panel workspace-hero">
        <div className="hero-copy">
          <p className="eyebrow">Zakaz tafsiloti</p>
          <h2>
            Zakazni
            <span> nazorat va yangilash</span>
          </h2>
          <p className="hero-text">
            Holat, qabul eslatmalari, diagnoz va operatsion jarayon bitta joyda
            ko'rinadi.
          </p>
        </div>
        {order ? (
          <div className="workspace-spotlight">
            <span className="signal">Live</span>
            <strong>{order.orderNumber}</strong>
            <p>
              {order.client.fullName} | {order.asset.displayName}
            </p>
          </div>
        ) : null}
      </section>

      {error ? <div className="workspace-alert is-danger">{error}</div> : null}
      {message ? (
        <div className="workspace-alert is-success">{message}</div>
      ) : null}

      {taskSummary.isAllCompleted &&
      order?.status !== "completed" &&
      order?.status !== "delivered" &&
      order?.status !== "cancelled" ? (
        <div
          className="workspace-alert is-success"
          style={{
            fontWeight: 600,
            border: "1px solid var(--success-border, var(--success))",
          }}
        >
          ✅ Hamma vazifalar yakunlandi! Menejer sifatida ko'rib chiqib,
          buyurtma holatini "Tugallangan" deb saqlashni unutmang.
        </div>
      ) : null}

      {loading ? (
        <section className="panel workspace-empty">
          <h3>Zakaz yuklanmoqda...</h3>
        </section>
      ) : null}

      {!loading && order ? (
        <>
          <section className="workspace-summary-grid">
            <article className="workspace-summary-card">
              <span>Holati</span>
              <strong>{getOrderStatusLabel(order.status)}</strong>
              <p>{getOrderStageLabel(order.status)}</p>
            </article>
            <article className="workspace-summary-card">
              <span>Ishlar</span>
              <strong>{taskSummary.totalTasks}</strong>
              <p>{taskSummary.openTasks} tasi hali ochiq</p>
            </article>
            <article className="workspace-summary-card">
              <span>To'langan summa</span>
              <strong>
                {formatMoneyUzs(Number(order.financial?.paidTotalAmount ?? 0))}
              </strong>
              <p>Qabul qilingan to'lov</p>
            </article>
            <article className="workspace-summary-card">
              <span>Qolgan qarz</span>
              <strong>
                {formatMoneyUzs(Number(order.financial?.balanceDueAmount ?? 0))}
              </strong>
              <p>Qolgan to'lov</p>
            </article>
            <article className="workspace-summary-card">
              <span>Keyingi qadam</span>
              <strong>{getOrderStatusLabel(order.status)}</strong>
              <p>{getOrderNextStepLabel(order.status)}</p>
            </article>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Sizning imkoniyatingiz</p>
                <h3>
                  {canUpdateOrder || canUpdateTask
                    ? "Faol boshqaruv rejimi"
                    : "Faqat ko'rish rejimi"}
                </h3>
              </div>
            </div>
            <div className="workspace-empty-state">
              <strong>
                {canUpdateOrder
                  ? "Siz holat, qabul eslatmasi va ichki diagnoz maydonlarini yangilashingiz mumkin."
                  : canUpdateTask
                    ? "Siz vazifalar holatini yangilay olasiz va ish jarayonini yurita olasiz."
                    : "Siz zakaz tafsilotini to'liq ko'rasiz, lekin undagi yozuvlarni o'zgartira olmaysiz."}
              </strong>
            </div>
          </section>

          <section className="panel helper-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Bu yerda nima qilasiz?</p>
                <h3>Zakaz tafsiloti oqimi</h3>
              </div>
            </div>
            <div className="guidance-list">
              <div className="guidance-item">
                1. Tepada zakazning hozirgi holatini ko'rasiz.
              </div>
              <div className="guidance-item">
                2. Pastda mijoz, ishlar va tasdiqlarni tekshirasiz.
              </div>
              <div className="guidance-item">
                3. Ruxsatingiz bo'lsa status va eslatmalarni yangilaysiz.
              </div>
            </div>
          </section>

          <section className="panel helper-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Qadam-baqadam</p>
                <h3>Shu zakaz bo'yicha ish tartibi</h3>
              </div>
            </div>
            <div className="step-grid">
              {workflowSteps.map((step, index) => (
                <article className="step-card" key={step.title}>
                  <span className="eyebrow">{index + 1}-qadam</span>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                  <p className="workspace-muted order-step-state">
                    {step.state}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-grid">
            <article className="panel panel-wide">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Qisqa ko'rinish</p>
                  <h3>{order.orderNumber}</h3>
                </div>
                <span className="status-pill">
                  {getOrderStatusLabel(order.status)}
                </span>
              </div>

              <div className="workspace-summary-grid">
                <div className="workspace-summary-card">
                  <span>Mijoz</span>
                  <strong>{order.client.fullName}</strong>
                  <p>{order.client.phone || "Telefon kiritilmagan"}</p>
                </div>
                <div className="workspace-summary-card">
                  <span>Mashina</span>
                  <strong>{order.asset.displayName}</strong>
                  <p>{order.branch.name} filiali</p>
                </div>
                <div className="workspace-summary-card">
                  <span>Jami summa</span>
                  <strong>
                    {formatMoneyUzs(
                      Number(order.financial?.grandTotalAmount ?? 0),
                    )}
                  </strong>
                  <p>Jami zakaz summasi</p>
                </div>
                <div className="workspace-summary-card">
                  <span>Tugagan ishlar</span>
                  <strong>{taskSummary.completedTasks}</strong>
                  <p>Tugallangan ishlar</p>
                </div>
              </div>

              <div className="detail-list order-detail-meta">
                <div>
                  <span>Ochgan xodim</span>
                  <strong>{order.createdByStaff?.fullName || "-"}</strong>
                </div>
                <div>
                  <span>Mas'ul menejer</span>
                  <strong>{order.assignedManager?.fullName || "-"}</strong>
                </div>
                <div>
                  <span>Tasdiqlar</span>
                  <strong>{order.approvals?.length ?? 0}</strong>
                </div>
                <div>
                  <span>Biriktirishlar</span>
                  <strong>{order.assignments?.length ?? 0}</strong>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">1-qadam</p>
                  <h3>Qabul va holat</h3>
                </div>
              </div>

              {canUpdateOrder || canApproveOrder ? (
                <form className="workspace-form-stack" onSubmit={handleUpdate}>
                  <label className="field">
                    <span>Holati</span>
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      {statusOptions.map((item) => (
                        <option key={item} value={item}>
                          {getOrderStatusLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {recommendedStatusActions.length ? (
                    <div className="status-stack">
                      <div className="workspace-summary-card">
                        <span>Tezkor keyingi amallar</span>
                        <strong>
                          {recommendedStatusActions.length} ta variant
                        </strong>
                        <p>
                          Faqat ruxsat etilgan keyingi holatlar ko'rsatiladi.
                        </p>
                      </div>
                      <div className="task-action-row">
                        {recommendedStatusActions.map((action) => (
                          <button
                            key={action.value}
                            type="button"
                            className="task-action-btn"
                            disabled={action.disabled}
                            onClick={() =>
                              handleQuickStatusChange(action.value)
                            }
                            title={action.disabledReason || action.label}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                      {recommendedStatusActions.some(
                        (action) => action.disabledReason,
                      ) ? (
                        <p className="workspace-muted">
                          {
                            recommendedStatusActions.find(
                              (action) => action.disabledReason,
                            )?.disabledReason
                          }
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <label className="field">
                    <span>Qabul eslatmasi</span>
                    <textarea
                      rows={4}
                      value={intakeNotes}
                      onChange={(event) => setIntakeNotes(event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>Ichki diagnoz</span>
                    <textarea
                      rows={4}
                      value={diagnosis}
                      onChange={(event) => setDiagnosis(event.target.value)}
                    />
                  </label>

                  <button className="primary-btn">Saqlash</button>
                </form>
              ) : (
                <div className="workspace-empty-state">
                  <strong>
                    Siz bu zakazni ko'ra olasiz, lekin holat yoki ma'lumotlarni
                    o'zgartira olmaysiz.
                  </strong>
                </div>
              )}
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">2-qadam</p>
                  <h3>Narx va umumiy summa</h3>
                </div>
              </div>

              {canUpdateOrder ? (
                <form
                  className="workspace-form-stack"
                  onSubmit={handleEstimateSave}
                >
                  <div className="workspace-form-grid">
                    <label className="field">
                      <span>Ish summasi</span>
                      <input
                        value={laborEstimate}
                        onChange={(event) =>
                          setLaborEstimate(event.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Detal summasi</span>
                      <input
                        value={partsEstimate}
                        onChange={(event) =>
                          setPartsEstimate(event.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Chegirma</span>
                      <input
                        value={discountAmount}
                        onChange={(event) =>
                          setDiscountAmount(event.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Soliq</span>
                      <input
                        value={taxAmount}
                        onChange={(event) => setTaxAmount(event.target.value)}
                      />
                    </label>
                  </div>

                  <div className="workspace-summary-grid">
                    <div className="workspace-summary-card">
                      <span>Taxminiy jami</span>
                      <strong>{formatMoneyUzs(estimateSummary.total)}</strong>
                      <p>Ish + detal - chegirma + soliq</p>
                    </div>
                    <div className="workspace-summary-card">
                      <span>Qolgan qarz</span>
                      <strong>{formatMoneyUzs(estimateSummary.balance)}</strong>
                      <p>Jami summa - to'langan summa</p>
                    </div>
                  </div>

                  <button className="primary-btn">
                    Taxminiy narxni saqlash
                  </button>
                </form>
              ) : (
                <div className="status-stack">
                  <div className="workspace-summary-card">
                    <span>Ish summasi</span>
                    <strong>
                      {formatMoneyUzs(
                        Number(order.financial?.subtotalLaborAmount ?? 0),
                      )}
                    </strong>
                  </div>
                  <div className="workspace-summary-card">
                    <span>Detal summasi</span>
                    <strong>
                      {formatMoneyUzs(
                        Number(order.financial?.subtotalPartsAmount ?? 0),
                      )}
                    </strong>
                  </div>
                  <div className="workspace-summary-card">
                    <span>Chegirma</span>
                    <strong>
                      {formatMoneyUzs(
                        Number(order.financial?.discountAmount ?? 0),
                      )}
                    </strong>
                  </div>
                  <div className="workspace-summary-card">
                    <span>Soliq</span>
                    <strong>
                      {formatMoneyUzs(Number(order.financial?.taxAmount ?? 0))}
                    </strong>
                  </div>
                </div>
              )}
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">4-qadam</p>
                  <h3>To'lov holati va tarix</h3>
                </div>
              </div>

              <div className="workspace-summary-grid">
                <div className="workspace-summary-card">
                  <span>Jami tushgan</span>
                  <strong>
                    {formatMoneyUzs(
                      Number(order.financial?.paidTotalAmount ?? 0),
                    )}
                  </strong>
                  <p>Hozirgacha tushgan to'lov</p>
                </div>
                <div className="workspace-summary-card">
                  <span>Qolgan qarz</span>
                  <strong>
                    {formatMoneyUzs(
                      Number(order.financial?.balanceDueAmount ?? 0),
                    )}
                  </strong>
                  <p>Hali yopilmagan qarz</p>
                </div>
              </div>

              {canCreatePayment && currentStaffMember ? (
                <form
                  className="workspace-form-stack"
                  onSubmit={handlePaymentCreate}
                >
                  <div className="workspace-form-grid">
                    <label className="field">
                      <span>To'lov turi</span>
                      <select
                        value={paymentMethodCode}
                        onChange={(event) =>
                          setPaymentMethodCode(event.target.value)
                        }
                      >
                        {paymentMethodOptions.map((methodCode) => (
                          <option key={methodCode} value={methodCode}>
                            {getPaymentMethodLabel(methodCode)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Summa</span>
                      <input
                        value={paymentAmount}
                        onChange={(event) =>
                          setPaymentAmount(event.target.value)
                        }
                        placeholder="Masalan: 250000"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>To'langan vaqt</span>
                      <input
                        type="datetime-local"
                        value={paymentPaidAt}
                        onChange={(event) =>
                          setPaymentPaidAt(event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Izoh</span>
                    <textarea
                      rows={3}
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      placeholder="Masalan: Avans to'lovi"
                    />
                  </label>
                  <button className="primary-btn">To'lov yozish</button>
                </form>
              ) : null}

              <div className="status-stack">
                {payments.map((payment) => (
                  <div className="task-card" key={payment.id}>
                    <div className="status-row">
                      <span>
                        {getPaymentMethodLabel(payment.paymentMethodCode)}
                      </span>
                      <strong>{formatMoneyUzs(Number(payment.amount))}</strong>
                    </div>
                    <div className="detail-list">
                      <div>
                        <span>Qabul qilgan</span>
                        <strong>
                          {payment.receivedByStaff?.fullName || "-"}
                        </strong>
                      </div>
                      <div>
                        <span>Sana</span>
                        <strong>{formatDateTimeUz(payment.paidAt)}</strong>
                      </div>
                    </div>
                    {payment.note ? (
                      <p className="workspace-muted">{payment.note}</p>
                    ) : null}
                  </div>
                ))}
                {!payments.length ? (
                  <p className="workspace-muted">
                    Bu zakaz uchun hali to'lov yozilmagan.
                  </p>
                ) : null}
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">1-qadam</p>
                  <h3>Qabul ma'lumoti</h3>
                </div>
              </div>

              <div className="status-stack">
                <div className="workspace-summary-card">
                  <span>Mijoz so'rovi</span>
                  <strong>{order.customerRequestText || "-"}</strong>
                  <p>Mijoz aytgan muammo</p>
                </div>
                <div className="workspace-summary-card">
                  <span>Qabul eslatmasi</span>
                  <strong>{order.intakeNotes || "-"}</strong>
                  <p>Qabul paytidagi eslatmalar</p>
                </div>
                <div className="workspace-summary-card">
                  <span>Ichki diagnoz</span>
                  <strong>{order.internalDiagnosisText || "-"}</strong>
                  <p>Ichki texnik izoh</p>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">3-qadam</p>
                  <h3>Ishni biriktirish</h3>
                </div>
              </div>

              {canAssignOrder && currentStaffMember ? (
                staffMembers.length ? (
                  <form
                    className="workspace-form-stack"
                    onSubmit={handleAssignmentCreate}
                  >
                    <div className="workspace-form-grid">
                      <label className="field">
                        <span>Qaysi ish</span>
                        <select
                          value={assignmentTaskId}
                          onChange={(event) =>
                            setAssignmentTaskId(event.target.value)
                          }
                        >
                          <option value="">Butun zakaz bo'yicha</option>
                          {order.tasks.map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Qaysi xodimga</span>
                        <select
                          value={assignmentStaffId}
                          onChange={(event) =>
                            setAssignmentStaffId(event.target.value)
                          }
                          required
                        >
                          <option value="">Xodimni tanlang</option>
                          {staffMembers
                            .filter((staff) => staff.isActive)
                            .map((staff) => (
                              <option key={staff.id} value={staff.id}>
                                {staff.fullName} ({staff.primaryRole})
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <label className="field">
                      <span>Izoh</span>
                      <textarea
                        rows={3}
                        value={assignmentNote}
                        onChange={(event) =>
                          setAssignmentNote(event.target.value)
                        }
                        placeholder="Masalan: Bugun tushgacha diagnostikani yakunlash"
                      />
                    </label>
                    <button className="primary-btn">Ustaga biriktirish</button>
                  </form>
                ) : (
                  <div className="workspace-empty-state">
                    <strong>
                      Xodimlar ro'yxati yuklanmadi yoki hozircha mavjud emas.
                    </strong>
                  </div>
                )
              ) : (
                <div className="workspace-empty-state">
                  <strong>
                    Bu bo'lim faqat ish taqsimlay oladigan rol uchun ochiladi.
                  </strong>
                </div>
              )}
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">3-qadam</p>
                  <h3>Tasdiq so'rovi</h3>
                </div>
              </div>

              {canApproveOrder && currentStaffMember ? (
                <form
                  className="workspace-form-stack"
                  onSubmit={handleApprovalCreate}
                >
                  <div className="workspace-form-grid">
                    <label className="field">
                      <span>Tasdiq turi</span>
                      <select
                        value={approvalTypeCode}
                        onChange={(event) =>
                          setApprovalTypeCode(event.target.value)
                        }
                      >
                        <option value="estimate">Narx tasdig'i</option>
                        <option value="work_start">Ishni boshlash</option>
                        <option value="parts_purchase">Detal xaridi</option>
                        <option value="delivery">Topshirish</option>
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>Izoh</span>
                    <textarea
                      rows={3}
                      value={approvalNote}
                      onChange={(event) => setApprovalNote(event.target.value)}
                      placeholder="Masalan: Klient bilan 850 000 so'mga kelishildi"
                    />
                  </label>
                  <button className="primary-btn">
                    Tasdiq so'rovi qo'shish
                  </button>
                </form>
              ) : (
                <div className="workspace-empty-state">
                  <strong>
                    Bu bo'lim faqat tasdiq bera oladigan rol uchun ochiladi.
                  </strong>
                </div>
              )}
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">2-qadam</p>
                  <h3>Ishga detal biriktirish</h3>
                </div>
              </div>

              {canManageOrderContent ? (
                <>
                  <form
                    className="workspace-form-stack"
                    onSubmit={handlePartCreate}
                  >
                    <div className="workspace-form-grid">
                      <label className="field">
                        <span>Qaysi ish uchun</span>
                        <select
                          value={partTaskId}
                          onChange={(event) =>
                            setPartTaskId(event.target.value)
                          }
                          required
                        >
                          <option value="">Ishni tanlang</option>
                          {order.tasks.map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Soni</span>
                        <input
                          value={partQuantity}
                          onChange={(event) =>
                            setPartQuantity(event.target.value)
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Sotuv narxi</span>
                        <input
                          value={partUnitPrice}
                          onChange={(event) =>
                            setPartUnitPrice(event.target.value)
                          }
                          placeholder={
                            selectedInventoryItem
                              ? String(
                                  Number(selectedInventoryItem.salePrice ?? 0),
                                )
                              : "Masalan: 90000"
                          }
                        />
                      </label>
                    </div>

                    {/* Qidiruv bilan sklad tovarlari */}
                    <label className="field">
                      <span>Tovar / ehtiyot qism qidirish</span>
                      <input
                        value={partSearch}
                        onChange={(event) => {
                          setPartSearch(event.target.value);
                          setPartItemId("");
                        }}
                        placeholder="Masalan: moy filtri, amortizator..."
                        autoComplete="off"
                      />
                    </label>

                    {/* Tanlangan tovar */}
                    {selectedInventoryItem ? (
                      <div className="selected-part-card">
                        <div className="selected-part-info">
                          <span className="selected-part-check">✓</span>
                          <div>
                            <strong>{selectedInventoryItem.name}</strong>
                            {selectedInventoryItem.sku ? (
                              <small> · {selectedInventoryItem.sku}</small>
                            ) : null}
                            <p className="workspace-muted">
                              Narxi:{" "}
                              {formatMoneyUzs(
                                Number(selectedInventoryItem.salePrice ?? 0),
                              )}{" "}
                              / {selectedInventoryItem.unitName}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="part-clear-btn"
                          onClick={() => {
                            setPartItemId("");
                            setPartSearch("");
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : partSearch.trim().length > 0 ? (
                      <div className="parts-search-results">
                        {inventoryItems
                          .filter(
                            (item) =>
                              item.name
                                .toLowerCase()
                                .includes(partSearch.toLowerCase()) ||
                              (item.sku ?? "")
                                .toLowerCase()
                                .includes(partSearch.toLowerCase()),
                          )
                          .slice(0, 8)
                          .map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="part-search-row"
                              onClick={() => {
                                setPartItemId(item.id);
                                setPartSearch(item.name);
                                if (!partUnitPrice) {
                                  setPartUnitPrice(
                                    String(Number(item.salePrice ?? 0)),
                                  );
                                }
                              }}
                            >
                              <span className="part-search-name">
                                {item.name}
                              </span>
                              <span className="part-search-meta">
                                {item.sku ? `SKU: ${item.sku} · ` : ""}
                                {formatMoneyUzs(
                                  Number(item.salePrice ?? 0),
                                )} / {item.unitName}
                              </span>
                            </button>
                          ))}
                        {inventoryItems.filter(
                          (item) =>
                            item.name
                              .toLowerCase()
                              .includes(partSearch.toLowerCase()) ||
                            (item.sku ?? "")
                              .toLowerCase()
                              .includes(partSearch.toLowerCase()),
                        ).length === 0 ? (
                          <p
                            className="workspace-muted"
                            style={{ padding: "8px 12px" }}
                          >
                            Tovar topilmadi.
                          </p>
                        ) : null}
                      </div>
                    ) : inventoryItems.length > 0 ? (
                      <p className="workspace-muted">
                        Tovar nomini yozing — qidiruv ishlaydi.
                      </p>
                    ) : (
                      <p className="workspace-muted">
                        Sklad bo'sh yoki yuklanmagan.
                      </p>
                    )}

                    <button
                      className="primary-btn"
                      disabled={!partItemId || !partTaskId}
                    >
                      Detal qo'shish
                    </button>
                  </form>

                  {partTaskId ? (
                    <div className="status-stack">
                      {selectedTaskParts.length ? (
                        <div className="workspace-summary-card">
                          <span>Tanlangan ish bo'yicha detal summasi</span>
                          <strong>
                            {formatMoneyUzs(
                              selectedTaskParts.reduce(
                                (sum, part) =>
                                  sum +
                                  Number(part.quantity) *
                                    Number(part.unitPriceAmount),
                                0,
                              ),
                            )}
                          </strong>
                          <p>
                            Tanlangan ishga yozilgan barcha detallar summasi
                          </p>
                        </div>
                      ) : null}
                      {selectedTaskParts.map((part) => (
                        <div className="status-row" key={part.id}>
                          <span>
                            {part.inventoryItem.name}
                            <br />
                            <small className="workspace-muted">
                              {Number(part.quantity)} x{" "}
                              {formatMoneyUzs(Number(part.unitPriceAmount))}
                            </small>
                          </span>
                          <strong>
                            {formatMoneyUzs(
                              Number(part.quantity) *
                                Number(part.unitPriceAmount),
                            )}
                          </strong>
                        </div>
                      ))}
                      {!selectedTaskParts.length ? (
                        <p className="workspace-muted">
                          Bu ish uchun hali detal qo'shilmagan.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="status-stack">
                  {taskParts.map((part) => (
                    <div className="status-row" key={part.id}>
                      <span>
                        {part.orderTask.title}: {part.inventoryItem.name}
                        <br />
                        <small className="workspace-muted">
                          {Number(part.quantity)} x{" "}
                          {formatMoneyUzs(Number(part.unitPriceAmount))}
                        </small>
                      </span>
                      <strong>
                        {formatMoneyUzs(
                          Number(part.quantity) * Number(part.unitPriceAmount),
                        )}
                      </strong>
                    </div>
                  ))}
                  {!taskParts.length ? (
                    <p className="workspace-muted">
                      Zakaz uchun hali detal yozilmagan.
                    </p>
                  ) : null}
                </div>
              )}
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">2-qadam</p>
                  <h3>Ishlar ro'yxati</h3>
                </div>
              </div>

              {canManageOrderContent ? (
                <form
                  className="workspace-form-stack"
                  onSubmit={handleTaskCreate}
                >
                  <div className="workspace-form-grid">
                    <label className="field">
                      <span>Ish nomi</span>
                      <input
                        value={taskTitle}
                        onChange={(event) => setTaskTitle(event.target.value)}
                        placeholder="Masalan: Diagnostika"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Taxminiy ish summasi</span>
                      <input
                        value={taskEstimate}
                        onChange={(event) =>
                          setTaskEstimate(event.target.value)
                        }
                        placeholder="Masalan: 120000"
                      />
                    </label>
                  </div>
                  <button className="primary-btn">Ish qo'shish</button>
                </form>
              ) : null}

              <div className="status-stack">
                {order.tasks.map((task) => {
                  const partsForTask = taskPartsByTask[task.id] ?? [];
                  const partsTotal = partsForTask.reduce(
                    (sum, part) =>
                      sum +
                      Number(part.quantity) * Number(part.unitPriceAmount),
                    0,
                  );
                  const laborTotal = Number(task.estimatedLaborAmount ?? 0);
                  const taskTotal = laborTotal + partsTotal;

                  return (
                    <div className="task-card" key={task.id}>
                      <div className="status-row">
                        <span>
                          {task.title}
                          <br />
                          <small className="workspace-muted">
                            Ish narxi: {formatMoneyUzs(laborTotal)}
                          </small>
                        </span>
                        <strong>{getTaskStatusLabel(task.status)}</strong>
                      </div>

                      <div className="task-parts-summary">
                        <span>Detal summasi: {formatMoneyUzs(partsTotal)}</span>
                        <strong>Jami: {formatMoneyUzs(taskTotal)}</strong>
                      </div>

                      {canOperateTask(task) && (
                        <div className="task-action-row">
                          {taskStatusOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={`task-action-btn${task.status === option.value ? " is-active" : ""}`}
                              disabled={
                                task.status === option.value ||
                                taskStatusUpdatingId === task.id
                              }
                              onClick={() =>
                                handleTaskStatusChange(task.id, option.value)
                              }
                            >
                              {taskStatusUpdatingId === task.id &&
                              task.status !== option.value
                                ? "Saqlanmoqda..."
                                : option.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {canUpdateTask &&
                      !canUpdateOrder &&
                      !canOperateTask(task) ? (
                        <p className="workspace-muted">
                          Bu vazifa sizga biriktirilmagan.
                        </p>
                      ) : null}

                      {partsForTask.length ? (
                        <div className="task-parts-list">
                          {partsForTask.map((part) => (
                            <div className="task-part-row" key={part.id}>
                              <span>
                                {part.inventoryItem.name}
                                <br />
                                <small className="workspace-muted">
                                  {Number(part.quantity)} x{" "}
                                  {formatMoneyUzs(Number(part.unitPriceAmount))}
                                </small>
                              </span>
                              <strong>
                                {formatMoneyUzs(
                                  Number(part.quantity) *
                                    Number(part.unitPriceAmount),
                                )}
                              </strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="workspace-muted">
                          Bu ish uchun hali detal yozilmagan.
                        </p>
                      )}
                    </div>
                  );
                })}
                {!order.tasks.length ? (
                  <p className="workspace-muted">Ish hali qo'shilmagan.</p>
                ) : null}
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">3-qadam</p>
                  <h3>Biriktirishlar</h3>
                </div>
              </div>

              <div className="status-stack">
                {order.assignments?.map((assignment) => (
                  <div className="task-card" key={assignment.id}>
                    <div className="status-row">
                      <span>
                        {assignment.toStaff?.fullName || "Xodim belgilanmagan"}
                        <br />
                        <small className="workspace-muted">
                          {assignment.orderTask?.title
                            ? `Ish: ${assignment.orderTask.title}`
                            : "Butun zakaz bo'yicha"}
                        </small>
                      </span>
                      <strong>
                        {getAssignmentStatusLabel(assignment.status)}
                      </strong>
                    </div>
                    <div className="detail-list">
                      <div>
                        <span>Kim biriktirdi</span>
                        <strong>
                          {assignment.assignedByStaff?.fullName || "-"}
                        </strong>
                      </div>
                      <div>
                        <span>Qabul qilgan</span>
                        <strong>
                          {assignment.acceptedByStaff?.fullName || "-"}
                        </strong>
                      </div>
                    </div>
                    {assignment.note ? (
                      <p className="workspace-muted">{assignment.note}</p>
                    ) : null}
                  </div>
                ))}
                {!order.assignments?.length ? (
                  <p className="workspace-muted">Biriktirish hali yo'q.</p>
                ) : null}
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">3-qadam</p>
                  <h3>Tasdiqlar</h3>
                </div>
              </div>

              <div className="status-stack">
                {order.approvals?.map((approval) => (
                  <div className="task-card" key={approval.id}>
                    <div className="status-row">
                      <span>
                        {getApprovalTypeLabel(approval.approvalTypeCode)}
                      </span>
                      <strong>{getApprovalStatusLabel(approval.status)}</strong>
                    </div>
                    <div className="detail-list">
                      <div>
                        <span>So'rov bergan</span>
                        <strong>
                          {approval.requestedByStaff?.fullName || "-"}
                        </strong>
                      </div>
                      <div>
                        <span>Tasdiqlovchi</span>
                        <strong>
                          {approval.approvedByStaff?.fullName || "-"}
                        </strong>
                      </div>
                    </div>
                    {approval.requestNote ? (
                      <p className="workspace-muted">{approval.requestNote}</p>
                    ) : null}
                    {approval.decisionNote ? (
                      <p className="workspace-muted">
                        Qaror: {approval.decisionNote}
                      </p>
                    ) : null}
                  </div>
                ))}
                {!order.approvals?.length ? (
                  <p className="workspace-muted">Tasdiq hali yo'q.</p>
                ) : null}
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Yakuniy tarix</p>
                  <h3>So'nggi o'zgarishlar</h3>
                </div>
              </div>

              <div className="status-stack">
                {order.statusHistory?.map((item) => (
                  <div className="status-row" key={item.id}>
                    <span>
                      {getOrderStatusLabel(item.fromStatus || "new")} -&gt;{" "}
                      {getOrderStatusLabel(item.toStatus)}
                    </span>
                    <strong>
                      {new Date(item.createdAt).toLocaleDateString("uz-UZ")}
                    </strong>
                  </div>
                ))}
                {!order.statusHistory?.length ? (
                  <p className="workspace-muted">Tarix hali shakllanmagan.</p>
                ) : null}
              </div>
            </article>
          </section>
        </>
      ) : null}

      <OrderCheckoutModal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        onConfirm={handleCheckoutConfirm}
        balanceDueAmount={Number(order?.financial?.balanceDueAmount ?? 0)}
        totalAmount={Number(order?.financial?.grandTotalAmount ?? 0)}
        availableMethods={paymentMethodOptions}
      />
    </WorkspaceLayout>
  );
}

export default OrderDetailPage;
