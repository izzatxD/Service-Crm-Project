import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { useStaff } from '../hooks/useOrganizations'
import { useCreateOrder, useOrders } from '../hooks/useOrders'
import { useToast } from '../hooks/useToast'
import { useWorkspaceSection } from '../hooks/useWorkspaceSection'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { createOrderFromIntake, type IntakeTask } from '../lib/orderIntake'

const CAR_BRANDS = ['Cobalt', 'Gentra / Lacetti', 'Spark', 'Nexia (1,2,3)', 'Damas', 'Matiz', 'Captiva']
const ISSUE_TYPES = ['Moy almashtirish', 'Xodovoy qismi', 'Dvigatel ishi', 'Elektrika', 'Tormoz sistemasi', "Kuzov va bo'yoq"]
const ACTIVE_QUEUE_STATUSES = ['new', 'pending_diagnosis', 'estimated', 'approved', 'waiting_parts']
const RECEPTION_SECTIONS = ['summary', 'create', 'today', 'queue'] as const

function money(value: number) {
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(value) + " so'm"
}

function formatDate(dateStr: string) {
  try {
    const date = new Date(dateStr)
    return (
      date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' +
      date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    )
  } catch {
    return dateStr
  }
}

function generateOrderPreview() {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `ORD-${yy}${mm}${dd}-...`
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

function isToday(dateStr?: string | null) {
  if (!dateStr) return false
  const value = new Date(dateStr)
  const now = new Date()
  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  )
}

function ReceptionPage() {
  const { auth } = useAuth()
  const token = auth?.accessToken ?? ''
  const { toast } = useToast()
  const { organizationId, branchId } = useWorkspaceSelection()

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
  const { activeSection, setActiveSection } = useWorkspaceSection(RECEPTION_SECTIONS, 'summary')

  const currentStaffMember = useMemo(() => {
    return auth?.me?.staffMembers.find((member) => member.organizationId === organizationId) ?? null
  }, [auth?.me?.staffMembers, organizationId])

  const scopedOrders = useMemo(() => {
    if (!branchId) return orders
    return orders.filter((order) => order.branch.id === branchId)
  }, [branchId, orders])

  const todayOrders = useMemo(() => {
    return scopedOrders.filter((order) => isToday(order.openedAt))
  }, [scopedOrders])

  const queueOrders = useMemo(() => {
    return scopedOrders.filter((order) => ACTIVE_QUEUE_STATUSES.includes(order.status)).slice(0, 6)
  }, [scopedOrders])

  function toggleIssue(issue: string) {
    setSelectedIssues((current) =>
      current.includes(issue) ? current.filter((item) => item !== issue) : [...current, issue],
    )
  }

  function addTask() {
    setTasks((prev) => [...prev, { title: '', assignedStaffId: '', estimatedLaborAmount: '' }])
  }

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  function updateTask(index: number, field: keyof IntakeTask, value: string) {
    setTasks((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    )
  }

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
      setActiveSection('today', true)
      toast("Yangi qabul muvaffaqiyatli yaratildi.", 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Qabul yaratilmadi.', 'error')
    }
  }

  return (
    <WorkspaceLayout>
      <div className="bot-topbar">
        <div className="bot-topbar-left">
          <div className="bot-topbar-title">Qabul</div>
          <div className="orders-topbar-note">Yangi mijoz, bugungi navbat va tezkor intake oqimi</div>
        </div>
        <div className="bot-topbar-actions">
          <button className="icon-round-btn" onClick={() => refetch()} title="Yangilash">
            <RefreshIcon />
          </button>
        </div>
      </div>

      {activeSection === 'summary' ? (
        <div className="workspace-summary-grid reception-summary-grid" id="summary">
          <article className="workspace-summary-card reception-summary-card">
            <span>Bugungi qabul</span>
            <strong>{todayOrders.length}</strong>
            <p>Bugun ochilgan zakazlar soni</p>
          </article>
          <article className="workspace-summary-card reception-summary-card">
            <span>Navbatda</span>
            <strong>{queueOrders.filter((order) => ['new', 'pending_diagnosis'].includes(order.status)).length}</strong>
            <p>Ko'rik va qabul kutayotgan mashinalar</p>
          </article>
          <article className="workspace-summary-card reception-summary-card">
            <span>Baholangan</span>
            <strong>{queueOrders.filter((order) => ['estimated', 'approved'].includes(order.status)).length}</strong>
            <p>Manager qarori yoki start kutayotgan ishlar</p>
          </article>
          <article className="workspace-summary-card reception-summary-card">
            <span>Bugungi kutilayotgan tushum</span>
            <strong>{money(todayOrders.reduce((sum, order) => sum + Number(order.financial?.grandTotalAmount ?? 0), 0))}</strong>
            <p>Bugun qabul qilingan orderlarning jami summasi</p>
          </article>
        </div>
      ) : activeSection === 'create' ? (
        <section className="panel reception-panel" id="create">
          <div className="section-hdr reception-section-hdr">
            <div className="section-hdr-title">Tezkor qabul formasi</div>
          </div>
          <div className="form-page reception-form-page">
            <form onSubmit={handleCreate}>
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
                <div className="form-section-title">Mashina va qabul</div>
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
                <label className="field">
                  <span>Zakaz raqami</span>
                  <input
                    value={form.orderNumber}
                    onChange={(event) => setForm((current) => ({ ...current, orderNumber: event.target.value }))}
                    placeholder={generateOrderPreview()}
                  />
                </label>
              </div>

              <div className="form-section orders-form-spacing">
                <div className="form-section-title">Muammo va ish turi</div>
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
                    placeholder="Mijoz aytgan muammo yoki qabul izohini yozing"
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
                          onChange={(event) => updateTask(index, 'title', event.target.value)}
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
                            onChange={(event) => updateTask(index, 'assignedStaffId', event.target.value)}
                          >
                            <option value="">Tanlang (ixtiyoriy)</option>
                            {staff.filter((item) => ['worker', 'manager'].includes(item.primaryRole)).map((item) => (
                              <option key={item.id} value={item.id}>{item.fullName} ({item.primaryRole === 'worker' ? 'Usta' : 'Menejer'})</option>
                            ))}
                          </select>
                        </label>
                        <label className="field" style={{ margin: 0 }}>
                          <span>Narx (so'm)</span>
                          <input
                            type="number"
                            value={task.estimatedLaborAmount}
                            onChange={(event) => updateTask(index, 'estimatedLaborAmount', event.target.value)}
                            placeholder="0"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="reception-estimate-note">
                  Ishlar jami: <strong>{money(tasks.reduce((sum, item) => sum + Number(item.estimatedLaborAmount || 0), 0))}</strong>
                </div>
              </div>

              <div className="form-section orders-form-spacing">
                <div className="form-section-title">Detal / material xarajati</div>
                <label className="field">
                  <span>Detal narxi (ixtiyoriy)</span>
                  <input
                    value={form.partsEstimate}
                    onChange={(event) => setForm((current) => ({ ...current, partsEstimate: event.target.value }))}
                    placeholder="0"
                    type="number"
                  />
                </label>
              </div>

              <div className="orders-submit-wrap">
                <button className="primary-btn" disabled={!branchId || createOrder.isPending}>
                  {createOrder.isPending ? 'Saqlanmoqda...' : "Qabulni saqlash va ishni boshlash"}
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : activeSection === 'today' ? (
        <section className="panel reception-panel" id="today">
          <div className="section-hdr reception-section-hdr">
            <div className="section-hdr-title">Bugun kelganlar</div>
            <span className="section-hdr-badge">{todayOrders.length}</span>
          </div>
          <div className="reception-list">
            {isLoading ? (
              <div className="empty-state">
                <div className="loading-spinner" />
                <p>Yuklanmoqda...</p>
              </div>
            ) : todayOrders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">#</div>
                <strong>Bugungi qabul yo'q</strong>
                <p>Yuqoridagi forma orqali birinchi qabulni yarating.</p>
              </div>
            ) : (
              todayOrders.slice(0, 5).map((item) => (
                <Link key={item.id} to={`/orders/${item.id}`} className="order-mob-card reception-order-card">
                  <div className="order-status-bar" />
                  <div className="order-mob-body">
                    <div className="order-mob-top">
                      <span className="order-num">#{item.orderNumber || item.id.slice(-6)}</span>
                    </div>
                    <div className="order-mob-client">{item.client.fullName}</div>
                    <div className="order-mob-car">{item.asset.displayName}</div>
                    <div className="order-mob-footer">
                      <span className="order-mob-amount">
                        {money(Number(item.financial?.grandTotalAmount ?? 0))}
                      </span>
                      <span className="order-mob-date">{formatDate(item.openedAt)}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      ) : (
        <section className="panel reception-panel" id="queue">
          <div className="section-hdr reception-section-hdr">
            <div className="section-hdr-title">Qabul navbati</div>
            <span className="section-hdr-badge">{queueOrders.length}</span>
          </div>
          <div className="reception-queue">
            {queueOrders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">#</div>
                <strong>Navbat bo'sh</strong>
                <p>Hozircha ko'rik yoki qabul kutayotgan mashina yo'q.</p>
              </div>
            ) : (
              queueOrders.map((item) => (
                <Link key={item.id} to={`/orders/${item.id}`} className="reception-queue-item">
                  <div className="reception-queue-copy">
                    <strong>{item.client.fullName}</strong>
                    <span>{item.asset.displayName}</span>
                  </div>
                  <div className="reception-queue-meta">
                    <small>{item.branch.name}</small>
                    <strong>{item.status.replace('_', ' ')}</strong>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      )}
    </WorkspaceLayout>
  )
}

export default ReceptionPage
