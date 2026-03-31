import {
  type CreateOrderWorkflowPayload,
  type OrderItem,
  updateOrderFinancialRequest,
  createOrderAssignmentRequest,
} from './api'

export type IntakeFormState = {
  orderNumber: string
  createdByStaffId: string
  customerName: string
  customerPhone: string
  vehicleName: string
  plateNumber: string
  customerRequestText: string
  laborEstimate: string
  partsEstimate: string
}

export type IntakeTask = {
  title: string
  assignedStaffId: string
  estimatedLaborAmount: string
}

type CreateOrderFromIntakeParams = {
  accessToken: string
  organizationId: string
  branchId: string
  form: IntakeFormState
  selectedBrand: string
  selectedIssues: string[]
  tasks: IntakeTask[]
  currentStaffId?: string | null
  fallbackStaffId?: string | null
  createOrder: (payload: CreateOrderWorkflowPayload) => Promise<OrderItem>
}

export async function createOrderFromIntake({
  accessToken,
  organizationId,
  branchId,
  form,
  selectedBrand,
  selectedIssues,
  tasks,
  currentStaffId,
  fallbackStaffId,
  createOrder,
}: CreateOrderFromIntakeParams) {
  const vehicleName = selectedBrand || form.vehicleName
  const issueText = [...selectedIssues, form.customerRequestText]
    .filter(Boolean)
    .join(', ')

  const validTasks = tasks.filter((t) => t.title.trim())

  // Calculate totals
  const laborFromTasks = validTasks.reduce(
    (sum, t) => sum + Number(t.estimatedLaborAmount || 0),
    0,
  )
  const laborEstimate = laborFromTasks > 0 ? laborFromTasks : Number(form.laborEstimate || 0)
  const partsEstimate = Number(form.partsEstimate || 0)
  const estimateTotal = laborEstimate + partsEstimate

  const staffId = form.createdByStaffId || currentStaffId || fallbackStaffId || ''
  const hasAssignedTasks = validTasks.some((t) => t.assignedStaffId)
  const inferredStatus =
    hasAssignedTasks
      ? 'in_progress'
      : estimateTotal > 0 || validTasks.length > 0
        ? 'estimated'
        : issueText.trim()
          ? 'pending_diagnosis'
          : 'new'

  const createdOrder = await createOrder({
    organizationId,
    branchId,
    orderNumber: form.orderNumber.trim() || undefined,
    createdByStaffId: staffId,
    customerRequestText: issueText,
    intakeNotes: form.plateNumber ? `Davlat raqami: ${form.plateNumber}` : undefined,
    status: inferredStatus,
    client: {
      fullName: form.customerName,
      phone: form.customerPhone || undefined,
    },
    asset: {
      assetTypeCode: 'vehicle',
      displayName: vehicleName,
    },
    vehicleProfile: form.plateNumber
      ? { plateNumber: form.plateNumber }
      : undefined,
    tasks: validTasks.map((task, index) => ({
      lineNo: index + 1,
      title: task.title.trim(),
      assignedStaffId: task.assignedStaffId || undefined,
      estimatedLaborAmount: Number(task.estimatedLaborAmount || 0),
      actualLaborAmount: 0,
    })),
  })

  // Update financial if there's an estimate
  if (createdOrder.financial && estimateTotal > 0) {
    await updateOrderFinancialRequest(accessToken, createdOrder.financial.id, {
      orderId: createdOrder.id,
      organizationId,
      subtotalLaborAmount: laborEstimate,
      subtotalPartsAmount: partsEstimate,
      discountAmount: 0,
      taxAmount: 0,
      grandTotalAmount: estimateTotal,
      paidTotalAmount: Number(createdOrder.financial.paidTotalAmount ?? 0),
      balanceDueAmount:
        estimateTotal - Number(createdOrder.financial.paidTotalAmount ?? 0),
    })
  }

  for (const task of createdOrder.tasks ?? []) {
    const matchingTask = validTasks.find(
      (_, index) => index + 1 === Number(task.lineNo ?? 0),
    )

    if (matchingTask?.assignedStaffId && staffId) {
      try {
        await createOrderAssignmentRequest(accessToken, {
          organizationId,
          orderId: createdOrder.id,
          orderTaskId: task.id,
          toStaffId: matchingTask.assignedStaffId,
          assignedByStaffId: staffId,
          status: 'assigned',
          assignmentTypeCode: 'task_assignment',
        })
      } catch {
        // Assignment failure doesn't block order creation.
      }
    }
  }

  return createdOrder
}
