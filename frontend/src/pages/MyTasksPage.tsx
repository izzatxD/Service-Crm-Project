import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { useOrders } from '../hooks/useOrders'
import { useToast } from '../hooks/useToast'
import { useWorkspaceSection } from '../hooks/useWorkspaceSection'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { updateOrderTaskRequest } from '../lib/api'
import { formatMoneyUzs } from '../lib/format'
import { getOrderStatusLabel } from '../lib/labels'

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: 'Kutilmoqda',
  in_progress: 'Bajarilmoqda',
  waiting_parts: 'Detal kutilmoqda',
  completed: 'Bajarildi',
  cancelled: 'Bekor qilindi',
}

const TASK_STATUS_COLORS: Record<string, string> = {
  pending: 'is-info',
  in_progress: 'is-warning',
  waiting_parts: 'is-warning',
  completed: 'is-success',
  cancelled: '',
}

const NEXT_STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  pending: [{ value: 'in_progress', label: 'Boshlash' }],
  in_progress: [
    { value: 'waiting_parts', label: 'Detal kerak' },
    { value: 'completed', label: 'Bajarildi' },
  ],
  waiting_parts: [
    { value: 'in_progress', label: 'Davom etish' },
    { value: 'completed', label: 'Bajarildi' },
  ],
  completed: [],
  cancelled: [],
}

const MY_TASK_SECTIONS = ['active-tasks', 'completed-tasks'] as const

function MyTasksPage() {
  const { auth } = useAuth()
  const token = auth?.accessToken ?? ''
  const { toast } = useToast()
  const { organizationId } = useWorkspaceSelection()
  const { activeSection } = useWorkspaceSection(MY_TASK_SECTIONS, 'active-tasks')

  const [updatingTaskId, setUpdatingTaskId] = useState('')

  const { data: orders = [], isLoading, refetch } = useOrders(token, organizationId)

  const currentStaffMember = useMemo(() => {
    return auth?.me?.staffMembers.find((member) => member.organizationId === organizationId) ?? null
  }, [auth?.me?.staffMembers, organizationId])

  const allMyTasks = useMemo(() => {
    if (!currentStaffMember) return []

    const result: Array<{
      task: { id: string; lineNo: number; title: string; status: string; estimatedLaborAmount: string | number }
      order: { id: string; orderNumber: string; status: string; client: { fullName: string }; asset: { displayName: string } }
    }> = []

    for (const order of orders) {
      for (const task of order.tasks ?? []) {
        if ((task as { assignedStaffId?: string }).assignedStaffId === currentStaffMember.id) {
          result.push({ task: task as typeof result[number]['task'], order })
        }
      }
    }

    return result
  }, [currentStaffMember, orders])

  const myTasks = useMemo(() => {
    return allMyTasks.filter((item) =>
      !['completed', 'cancelled'].includes(item.task.status ?? 'pending') &&
      !['completed', 'delivered', 'cancelled'].includes(item.order.status),
    )
  }, [allMyTasks])

  const completedTasks = useMemo(() => {
    return allMyTasks.filter((item) => item.task.status === 'completed')
  }, [allMyTasks])

  const uniqueOrdersCount = useMemo(() => {
    return new Set(allMyTasks.map((item) => item.order.id)).size
  }, [allMyTasks])

  const totalEarned = useMemo(() => {
    return completedTasks.reduce((sum, item) => sum + Number(item.task.estimatedLaborAmount ?? 0), 0)
  }, [completedTasks])

  const taskSummary = {
    active: myTasks.filter((item) => item.task.status === 'in_progress').length,
    pending: myTasks.filter((item) => item.task.status === 'pending').length,
    waitingParts: myTasks.filter((item) => item.task.status === 'waiting_parts').length,
    completedToday: completedTasks.length,
    totalOrders: uniqueOrdersCount,
    earned: totalEarned,
  }

  async function handleStatusUpdate(taskId: string, newStatus: string) {
    if (!token || updatingTaskId) return

    setUpdatingTaskId(taskId)
    try {
      await updateOrderTaskRequest(token, taskId, { status: newStatus })
      await refetch()
      if (newStatus === 'completed') {
        toast('Bajarildi. Menejer tekshirishi kutilmoqda.', 'success')
      } else {
        toast('Task holati yangilandi.', 'success')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Xatolik yuz berdi.', 'error')
    } finally {
      setUpdatingTaskId('')
    }
  }

  return (
    <WorkspaceLayout>
      <div className="bot-topbar">
        <div className="bot-topbar-left">
          <div className="bot-topbar-title">Mening ishlarim</div>
          <div className="bot-topbar-subtitle">
            {currentStaffMember ? `${currentStaffMember.fullName} - biriktirilgan tasklar` : "Profil ma'lumoti yuklanmoqda"}
          </div>
        </div>
        <div className="bot-topbar-actions">
          <button className="icon-round-btn" onClick={() => refetch()} title="Yangilash">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="workspace-summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <article className="workspace-summary-card">
          <span>Faol ishlar</span>
          <strong>{taskSummary.active}</strong>
          <p>Bajarilayotgan</p>
        </article>
        <article className="workspace-summary-card">
          <span>Kutilayotgan</span>
          <strong>{taskSummary.pending}</strong>
          <p>Hali boshlanmagan</p>
        </article>
        <article className="workspace-summary-card is-success">
          <span>Bajarildi</span>
          <strong>{taskSummary.completedToday}</strong>
          <p>Tugallangan tasklar</p>
        </article>
        <article className="workspace-summary-card">
          <span>Zakazlar</span>
          <strong>{taskSummary.totalOrders} ta</strong>
          <p>Barcha sizning zakazlar</p>
        </article>
        <article className="workspace-summary-card" style={{ gridColumn: '1 / -1', background: 'var(--bg-tertiary)', padding: '1rem' }}>
          <span>Taxminiy mehnat haqi</span>
          <strong style={{ fontSize: '1.4rem' }}>{formatMoneyUzs(taskSummary.earned)}</strong>
          <p>Bajarilgan ishlar bo'yicha umumiy kutilayotgan mablag'.</p>
        </article>
      </div>

      {activeSection === 'active-tasks' ? (
        <section className="panel" id="active-tasks">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Faol ishlar</p>
              <h3>Bajarish kerak</h3>
            </div>
            <span className="section-hdr-badge">{myTasks.length}</span>
          </div>

          {isLoading ? (
            <div className="workspace-empty-state">
              <div className="loading-spinner" />
              <p>Yuklanmoqda...</p>
            </div>
          ) : !currentStaffMember ? (
            <div className="workspace-empty-state">
              <strong>Siz ushbu firmada xodim sifatida ro'yxatga olinmagan.</strong>
              <p>Admin bilan bog'laning.</p>
            </div>
          ) : myTasks.length === 0 ? (
            <div className="workspace-empty-state">
              <strong>Faol ish yo'q</strong>
              <p>Sizga hozircha task biriktirilmagan yoki barchasi bajarilgan.</p>
            </div>
          ) : (
            <div className="status-stack">
              {myTasks.map(({ task, order }) => (
                <div className="task-card" key={task.id}>
                  <div className="status-row">
                    <div>
                      <strong>{task.title}</strong>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        #{order.orderNumber} | {order.client.fullName} | {order.asset.displayName}
                      </p>
                    </div>
                    <span className={`status-pill ${TASK_STATUS_COLORS[task.status] ?? ''}`}>
                      {TASK_STATUS_LABELS[task.status] ?? task.status}
                    </span>
                  </div>

                  <div className="detail-list" style={{ marginBottom: '0.5rem' }}>
                    <div>
                      <span>Zakaz holati</span>
                      <strong>{getOrderStatusLabel(order.status)}</strong>
                    </div>
                    <div>
                      <span>Ish narxi</span>
                      <strong>{formatMoneyUzs(Number(task.estimatedLaborAmount ?? 0))}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {(NEXT_STATUS_OPTIONS[task.status] ?? []).map((option) => (
                      <button
                        key={option.value}
                        className={option.value === 'completed' ? 'primary-btn' : 'ghost-btn'}
                        style={{ padding: '6px 14px', fontSize: '13px' }}
                        onClick={() => handleStatusUpdate(task.id, option.value)}
                        disabled={updatingTaskId === task.id}
                      >
                        {updatingTaskId === task.id ? '...' : option.label}
                      </button>
                    ))}
                    <Link
                      to={`/orders/${order.id}`}
                      className="ghost-btn"
                      style={{ padding: '6px 14px', fontSize: '13px', textDecoration: 'none' }}
                    >
                      Zakaz
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="panel" id="completed-tasks">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Bajarilganlar</p>
              <h3>Tugallangan ishlar</h3>
            </div>
            <span className="section-hdr-badge">{completedTasks.length}</span>
          </div>

          {completedTasks.length > 0 ? (
            <div className="status-stack">
              {completedTasks.slice(0, 10).map(({ task, order }) => (
                <div className="task-card" key={task.id} style={{ opacity: 0.75 }}>
                  <div className="status-row">
                    <div>
                      <strong>{task.title}</strong>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        #{order.orderNumber} | {order.client.fullName}
                      </p>
                    </div>
                    <span className="status-pill is-success">Bajarildi</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="workspace-empty-state">
              <strong>Bajarilgan ish topilmadi</strong>
              <p>Hozircha tugallangan tasklar ko'rinmayapti.</p>
            </div>
          )}
        </section>
      )}
    </WorkspaceLayout>
  )
}

export default MyTasksPage
