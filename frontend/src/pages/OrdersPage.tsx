import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/access'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { useWorkspaceSection } from '../hooks/useWorkspaceSection'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { useStaff } from '../hooks/useOrganizations'
import { useOrders, useCreateOrder, useDeleteOrder } from '../hooks/useOrders'
import { useToast } from '../hooks/useToast'
import { updateOrderRequest } from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'
import { createOrderFromIntake, type IntakeTask } from '../lib/orderIntake'

const DONE_STATUSES = ['completed', 'delivered', 'cancelled']
const CAR_BRANDS = ['Cobalt', 'Gentra / Lacetti', 'Spark', 'Nexia (1,2,3)', 'Damas', 'Matiz', 'Captiva']
const ISSUE_TYPES = ['Moy almashtirish', 'Xodovoy qismi', 'Dvigatel ishi', 'Elektrika', 'Tormoz sistemasi', "Kuzov va bo'yoq"]
const ORDER_SECTIONS = ['create', 'incoming', 'workflow', 'completed'] as const
const ORDER_SECTIONS_NO_CREATE = ['incoming', 'workflow', 'completed'] as const

function getStatusBarClass(status: string) {
  if (['completed', 'delivered'].includes(status)) return 'green'
  if (['in_progress', 'approved'].includes(status)) return ''
  if (status === 'new') return 'blue'
  return 'yellow'
}

function getOrderBadgeClass(status: string) {
  if (['completed', 'delivered'].includes(status)) return 'tayyor'
  if (['in_progress', 'approved', 'estimated'].includes(status)) return 'jarayonda'
  if (status === 'new') return 'qabul'
  return 'kutilmoqda'
}

function getOrderBadgeLabel(status: string) {
  if (['completed', 'delivered'].includes(status)) return 'TAYYOR'
  if (status === 'in_progress') return 'JARAYONDA'
  if (status === 'new') return 'QABUL'
  if (status === 'approved') return 'TASDIQLANGAN'
  if (status === 'estimated') return 'BAHOLANGAN'
  if (['waiting_parts', 'pending_diagnosis'].includes(status)) return 'KUTILMOQDA'
  if (status === 'cancelled') return 'BEKOR'
  return status.toUpperCase()
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function generateOrderPreview() {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `ORD-${yy}${mm}${dd}-...`
}

function getOrderBalance(order: { financial: { balanceDueAmount: string | number } | null }) {
  return Number(order.financial?.balanceDueAmount ?? 0)
}

function OrdersPage() {
  const { auth } = useAuth()
  const token = auth?.accessToken ?? ''
  const canCreateOrder = hasPermission(auth, 'order.create')
  const { toast } = useToast()
  const { organizationId, branchId, selectedOrganization } = useWorkspaceSelection()

  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedIssues, setSelectedIssues] = useState<string[]>([])
  const [tasks, setTasks] = useState<IntakeTask[]>([{ title: '', assignedStaffId: '', estimatedLaborAmount: '' }])
  const [form, setForm] = useState({
    orderNumber: '',
    createdByStaffId: '',
    customerName: '',
    customerPhone: '',
    vehicleName: '',
    plateNumber: '',
    customerRequestText: '',
    laborEstimate: '',
    partsEstimate: '',
  })

  const { data: staff = [] } = useStaff(token, organizationId)
  const { data: orders = [], isLoading, refetch } = useOrders(token, organizationId)
  const createOrder = useCreateOrder(token)
  const deleteOrder = useDeleteOrder(token, organizationId)
  const selectedBranchName =
    selectedOrganization?.branches.find((branch) => branch.id === branchId)?.name ?? ''
  const { activeSection, setActiveSection } = useWorkspaceSection(
    canCreateOrder ? ORDER_SECTIONS : ORDER_SECTIONS_NO_CREATE,
    'incoming',
  )

  const currentStaffMember = useMemo(() => {
    return (
      auth?.me?.staffMembers.find((member) => member.organizationId === organizationId) ??
      null
    )
  }, [auth?.me?.staffMembers, organizationId])

  const canManageOrder = hasPermission(auth, 'order.update')
  const canDeleteOrder = hasPermission(auth, 'system.settings')

  const scopedOrders = useMemo(() => {
    if (!branchId) {
      return orders
    }

    return orders.filter((order) => order.branch.id === branchId)
  }, [branchId, orders])

  const filteredOrders = useMemo(() => {
    if (activeSection === 'incoming') {
      return scopedOrders.filter((order) => ['new', 'pending_diagnosis'].includes(order.status))
    }
    if (activeSection === 'workflow') {
      return scopedOrders.filter((order) =>
        ['estimated', 'approved', 'in_progress', 'waiting_parts'].includes(order.status),
      )
    }
    if (activeSection === 'completed') {
      return scopedOrders.filter((order) => DONE_STATUSES.includes(order.status))
    }
    return []
  }, [activeSection, scopedOrders])

  const orderSummary = useMemo(() => {
    const incomingCount = scopedOrders.filter((order) =>
      ['new', 'pending_diagnosis'].includes(order.status),
    ).length
    const workflowCount = scopedOrders.filter((order) =>
      ['estimated', 'approved', 'in_progress', 'waiting_parts'].includes(order.status),
    ).length
    const completedCount = scopedOrders.filter((order) =>
      ['completed', 'delivered'].includes(order.status),
    ).length
    const unpaidCount = scopedOrders.filter((order) => getOrderBalance(order) > 0.01).length

    return {
      incomingCount,
      workflowCount,
      completedCount,
      unpaidCount,
    }
  }, [scopedOrders])

  function isSafelyDeletable(status: string, paidTotalAmount?: string | number) {
    return ['new', 'pending_diagnosis'].includes(status) && Number(paidTotalAmount ?? 0) <= 0.01
  }

  async function handleCancelOrder(orderId: string) {
    if (!window.confirm("Bu orderni bekor qilmoqchimisiz?")) {
      return
    }

    try {
      await updateOrderRequest(token, orderId, { status: 'cancelled' })
      await refetch()
      toast('Order bekor qilindi.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Order bekor qilinmadi.', 'error')
    }
  }

  async function handleDeleteOrder(orderId: string) {
    if (!window.confirm("Bu orderni butunlay o'chirasizmi? Bu amal qaytarilmaydi.")) {
      return
    }

    try {
      await deleteOrder.mutateAsync(orderId)
      toast("Order o'chirildi.", 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : "Order o'chirilmadi.", 'error')
    }
  }

  function toggleIssue(issue: string) {
    setSelectedIssues((current) =>
      current.includes(issue) ? current.filter((item) => item !== issue) : [...current, issue],
    )
  }

  function addTask() {
    setTasks((prev) => [...prev, { title: '', assignedStaffId: '', estimatedLaborAmount: '' }])
  }

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, i) => i !== index))
  }

  function updateTask(index: number, field: keyof IntakeTask, value: string) {
    setTasks((prev) => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }

  const tasksLaborTotal = tasks.reduce((sum, t) => sum + Number(t.estimatedLaborAmount || 0), 0)

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId) {
      toast('Avval firma tanlang.', 'error')
      return
    }
    if (!branchId) {
      toast('Avval filial tanlang.', 'error')
      return
    }
    if (!form.customerName.trim()) {
      toast('Mijoz ismini kiriting.', 'error')
      return
    }

    const vehicleName = selectedBrand || form.vehicleName
    if (!vehicleName.trim()) {
      toast('Mashina nomini kiriting.', 'error')
      return
    }

    try {
      await createOrderFromIntake({
        accessToken: token,
        organizationId,
        branchId,
        form,
        selectedBrand,
        selectedIssues,
        tasks,
        currentStaffId: currentStaffMember?.id,
        fallbackStaffId: staff[0]?.id,
        createOrder: (payload) => createOrder.mutateAsync(payload),
      })

      setForm({
        orderNumber: '',
        createdByStaffId: currentStaffMember?.id ?? staff[0]?.id ?? '',
        customerName: '',
        customerPhone: '',
        vehicleName: '',
        plateNumber: '',
        customerRequestText: '',
        laborEstimate: '',
        partsEstimate: '',
      })
      setSelectedBrand('')
      setSelectedIssues([])
      setTasks([{ title: '', assignedStaffId: '', estimatedLaborAmount: '' }])
      setActiveSection('incoming', true)
      toast('Yangi zakaz yaratildi va ishlar biriktirildi.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Zakaz yaratilmadi.', 'error')
    }
  }

  return (
    <WorkspaceLayout>
      <div className="bot-topbar">
        {activeSection === 'create' ? (
          <>
            <div className="orders-create-header">
              <button className="back-btn" onClick={() => setActiveSection('incoming', true)}>
                Orqaga
              </button>
            </div>
            <div className="bot-topbar-left orders-create-meta">
              <div className="bot-topbar-title">Yangi qabul</div>
              <div className="orders-topbar-note">Tezkor to'ldirish formasi</div>
            </div>
          </>
        ) : (
          <>
            <div className="bot-topbar-left">
              <div className="bot-topbar-title">
                {activeSection === 'incoming'
                  ? 'Qabul qilinganlar'
                  : activeSection === 'workflow'
                    ? 'Jarayondagi ishlar'
                    : 'Topshirilganlar'}
              </div>
              <div className="orders-topbar-note">{filteredOrders.length} ta ish topildi</div>
            </div>
            <div className="bot-topbar-actions">
              {canCreateOrder && (
                <button
                  className="icon-round-btn orders-add-btn"
                  onClick={() => setActiveSection('create')}
                  title="Yangi zakaz"
                >
                  +
                </button>
              )}
              <button className="icon-round-btn" onClick={() => refetch()} title="Yangilash">
                <RefreshIcon />
              </button>
            </div>
          </>
        )}
      </div>

      {activeSection === 'create' ? (
        <div className="form-page">
          <form onSubmit={handleCreate} id="create">
            <div className="form-section">
              <div className="form-section-title">Mijoz</div>
              <div className="workspace-form-grid">
                <label className="field">
                  <span>Ismi *</span>
                  <input
                    value={form.customerName}
                    onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                    placeholder="Ahmad"
                    required
                  />
                </label>
                <label className="field">
                  <span>Telefoni</span>
                  <input
                    value={form.customerPhone}
                    onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))}
                    placeholder="+998"
                  />
                </label>
              </div>
            </div>

            <div className="form-section orders-form-spacing">
              <div className="form-section-title">Mashina</div>
              <div className="pill-select-group">
                {CAR_BRANDS.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    className={`pill-select${selectedBrand === brand ? ' is-active' : ''}`}
                    onClick={() => setSelectedBrand(selectedBrand === brand ? '' : brand)}
                  >
                    {brand}
                  </button>
                ))}
              </div>
              <label className="field">
                <input
                  value={form.vehicleName}
                  onChange={(event) => setForm((current) => ({ ...current, vehicleName: event.target.value }))}
                  placeholder="Yoki yangi modelni yozing..."
                />
              </label>
              <div className="workspace-form-grid">
                <label className="field">
                  <span>Davlat raqami</span>
                  <input
                    value={form.plateNumber}
                    onChange={(event) => setForm((current) => ({ ...current, plateNumber: event.target.value }))}
                    placeholder="01A001AA"
                  />
                </label>
                <label className="field">
                  <span>Mas'ul xodim</span>
                  <select
                    value={form.createdByStaffId || currentStaffMember?.id || staff[0]?.id || ''}
                    onChange={(event) => setForm((current) => ({ ...current, createdByStaffId: event.target.value }))}
                    disabled={!staff.length}
                  >
                    <option value="">Tanlang</option>
                    {staff.map((item) => (
                      <option key={item.id} value={item.id}>{item.fullName}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {selectedOrganization && (
              <div className="form-section orders-form-spacing">
                <div className="workspace-form-grid">
                  <label className="field">
                    <span>Filial *</span>
                    <input
                      value={selectedBranchName || "Headerdan tanlang"}
                      readOnly
                    />
                  </label>
                  <label className="field">
                    <span>Zakaz raqami</span>
                    <input
                      value={form.orderNumber}
                      onChange={(event) => setForm((current) => ({ ...current, orderNumber: event.target.value }))}
                      placeholder={generateOrderPreview()}
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="form-section orders-form-spacing">
              <div className="form-section-title">Muammo</div>
              <div className="pill-select-group">
                {ISSUE_TYPES.map((issue) => (
                  <button
                    key={issue}
                    type="button"
                    className={`pill-select${selectedIssues.includes(issue) ? ' is-active' : ''}`}
                    onClick={() => toggleIssue(issue)}
                  >
                    {issue}
                  </button>
                ))}
              </div>
              <label className="field">
                <textarea
                  value={form.customerRequestText}
                  onChange={(event) => setForm((current) => ({ ...current, customerRequestText: event.target.value }))}
                  rows={3}
                  placeholder="Nima ish qilinadi yoki texnik izohni yozing"
                />
              </label>
            </div>

            <div className="form-section orders-form-spacing">
              <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Ishlar va ustalar</span>
                <button type="button" className="ghost-btn" style={{ padding: '4px 12px', fontSize: '13px' }} onClick={addTask}>
                  + Ish qo'sh
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tasks.map((task, index) => (
                  <div key={index} className="panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '13px', minWidth: '20px' }}>#{index + 1}</span>
                      <input
                        className="field"
                        style={{ flex: 1, margin: 0 }}
                        value={task.title}
                        onChange={(e) => updateTask(index, 'title', e.target.value)}
                        placeholder="Ish nomi (masalan: Moy almashtirish)"
                      />
                      {tasks.length > 1 && (
                        <button type="button" onClick={() => removeTask(index)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>x</button>
                      )}
                    </div>
                    <div className="workspace-form-grid" style={{ marginTop: 0 }}>
                      <label className="field" style={{ margin: 0 }}>
                        <span>Usta (biriktirish)</span>
                        <select
                          value={task.assignedStaffId}
                          onChange={(e) => updateTask(index, 'assignedStaffId', e.target.value)}
                        >
                          <option value="">Tanlang (ixtiyoriy)</option>
                          {staff.filter((item) => ['worker', 'admin', 'manager'].includes(item.primaryRole)).map((item) => (
                            <option key={item.id} value={item.id}>{item.fullName} ({item.primaryRole})</option>
                          ))}
                        </select>
                      </label>
                      <label className="field" style={{ margin: 0 }}>
                        <span>Narx (so'm)</span>
                        <input
                          type="number"
                          value={task.estimatedLaborAmount}
                          onChange={(e) => updateTask(index, 'estimatedLaborAmount', e.target.value)}
                          placeholder="0"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              {tasksLaborTotal > 0 && (
                <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
                  Ishlar jami: <strong style={{ color: 'var(--accent)' }}>{tasksLaborTotal.toLocaleString()} so'm</strong>
                </div>
              )}
            </div>

            <div className="form-section orders-form-spacing">
              <div className="form-section-title">Qo'shimcha xarajat (detal)</div>
              <label className="field">
                <span>Detal / material narxi</span>
                <input
                  value={form.partsEstimate}
                  onChange={(event) => setForm((current) => ({ ...current, partsEstimate: event.target.value }))}
                  placeholder="Ixtiyoriy"
                  type="number"
                />
              </label>
            </div>

            <div className="orders-submit-wrap">
              <button className="primary-btn" disabled={!branchId || createOrder.isPending}>
                {createOrder.isPending ? 'Saqlanmoqda...' : 'Zakazni saqlash'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <section className="workspace-summary-grid">
            <article className="workspace-summary-card">
              <span>Qabul</span>
              <strong>{orderSummary.incomingCount}</strong>
              <p>Yangi va diagnoz kutilayotgan orderlar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Jarayonda</span>
              <strong>{orderSummary.workflowCount}</strong>
              <p>Smeta, tasdiq va bajarilish bosqichlari</p>
            </article>
            <article className="workspace-summary-card">
              <span>Tayyor</span>
              <strong>{orderSummary.completedCount}</strong>
              <p>Tugagan va topshirilgan orderlar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Qarzdor</span>
              <strong>{orderSummary.unpaidCount}</strong>
              <p>Balansida qarz qolgan buyurtmalar</p>
            </article>
          </section>

          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <span>Yuklanmoqda...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">#</div>
              <strong>Zakaz topilmadi</strong>
              <p>{canCreateOrder ? "Yangi zakaz ochish uchun + ni bosing" : "Bu scope ichida zakaz yo'q"}</p>
            </div>
          ) : (
            <div className="orders-list-wrap" id={activeSection}>
              {filteredOrders.map((item) => (
                <article key={item.id} className="order-mob-card order-mob-card--managed">
                  <Link to={`/orders/${item.id}`} className="order-mob-card__main">
                    <div className={`order-status-bar ${getStatusBarClass(item.status)}`} />
                    <div className="order-mob-body">
                      <div className="order-mob-top">
                        <span className="order-num">#{item.orderNumber || item.id.slice(-6)}</span>
                        <span className={`order-badge ${getOrderBadgeClass(item.status)}`}>{getOrderBadgeLabel(item.status)}</span>
                      </div>
                      <div className="order-mob-client">{item.client.fullName}</div>
                      <div className="order-mob-car">
                        {item.asset.displayName}
                        {item.branch?.name ? <> | {item.branch.name}</> : null}
                      </div>
                      {(() => {
                        const itemTasks = item.tasks || []
                        const total = itemTasks.length
                        const finished = itemTasks.filter((task) => task.status === 'completed').length
                        if (total > 0 && total === finished) {
                          return (
                            <div style={{ marginTop: 4, display: 'inline-block', backgroundColor: 'var(--success-alpha)', color: 'var(--success)', padding: '2px 8px', borderRadius: 4, fontSize: '11px', fontWeight: 600 }}>
                              Hamma ishlar tayyor ({finished}/{total})
                            </div>
                          )
                        }
                        if (total > 0) {
                          return (
                            <div style={{ marginTop: 4, display: 'inline-block', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                              Ishlar: {finished}/{total} tugatildi
                            </div>
                          )
                        }
                        return null
                      })()}
                      <div className="order-mob-footer">
                        <span className="order-mob-amount">
                          {item.financial ? formatMoney(Number(item.financial.grandTotalAmount)) : "0 so'm"}
                        </span>
                        <span className="order-mob-date">{formatDateTime(item.openedAt)}</span>
                      </div>
                    </div>
                    <div className="order-mob-arrow">&gt;</div>
                  </Link>

                  {(canManageOrder || canDeleteOrder) && (
                    <div className="order-card-actions">
                      {canManageOrder && !DONE_STATUSES.includes(item.status) && (
                        <button
                          className="ghost-btn order-card-actions__button"
                          onClick={() => handleCancelOrder(item.id)}
                        >
                          Bekor qilish
                        </button>
                      )}
                      {canDeleteOrder && isSafelyDeletable(item.status, item.financial?.paidTotalAmount) && (
                        <button
                          className="ghost-btn order-card-actions__button order-card-actions__button--danger"
                          onClick={() => handleDeleteOrder(item.id)}
                          disabled={deleteOrder.isPending}
                        >
                          O'chirish
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {canCreateOrder && filteredOrders.length > 0 && (
            <div className="orders-footer-action">
              <button className="ghost-btn" onClick={() => setActiveSection('create')}>
                + Yangi zakaz ochish
              </button>
            </div>
          )}
        </>
      )}
    </WorkspaceLayout>
  )
}

export default OrdersPage
