import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { useApprovals } from '../hooks/useApprovals'
import { useDashboardSummary } from '../hooks/useDashboard'
import { useOrders } from '../hooks/useOrders'
import { useWorkspaceSection } from '../hooks/useWorkspaceSection'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { getApprovalTypeLabel, getOrderNextStepLabel, getOrderStatusLabel } from '../lib/labels'

const NOTIFICATION_SECTIONS = ['summary', 'approvals', 'debt', 'work', 'intake'] as const

function money(value: number) {
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(value) + " so'm"
}

function NotificationsPage() {
  const { auth } = useAuth()
  const token = auth?.accessToken ?? ''
  const { organizationId, branchId } = useWorkspaceSelection()

  const { data: summary } = useDashboardSummary(token, organizationId, branchId || undefined)
  const { data: orders = [] } = useOrders(token, organizationId)
  const { data: approvals = [] } = useApprovals(token, !!token)

  const scopedOrders = useMemo(() => {
    const byOrganization = branchId
      ? orders.filter((order) => order.branch.id === branchId)
      : orders

    return byOrganization
  }, [branchId, orders])

  const scopedApprovals = useMemo(() => {
    return approvals.filter((item) => item.organizationId === organizationId && item.status === 'pending')
  }, [approvals, organizationId])

  const debtAlerts = useMemo(() => {
    return scopedOrders
      .filter((order) => Number(order.financial?.balanceDueAmount ?? 0) > 0)
      .sort((left, right) => Number(right.financial?.balanceDueAmount ?? 0) - Number(left.financial?.balanceDueAmount ?? 0))
      .slice(0, 5)
  }, [scopedOrders])

  const urgentOrders = useMemo(() => {
    return scopedOrders
      .filter((order) =>
        ['urgent', 'high'].includes(order.priority) &&
        !['completed', 'delivered', 'cancelled'].includes(order.status),
      )
      .slice(0, 5)
  }, [scopedOrders])

  const waitingPartsOrders = useMemo(() => {
    return scopedOrders.filter((order) => order.status === 'waiting_parts').slice(0, 5)
  }, [scopedOrders])

  const intakeAttentionOrders = useMemo(() => {
    return scopedOrders
      .filter((order) => ['new', 'pending_diagnosis', 'estimated'].includes(order.status))
      .slice(0, 5)
  }, [scopedOrders])
  const { activeSection } = useWorkspaceSection(NOTIFICATION_SECTIONS, 'summary')

  return (
    <WorkspaceLayout>
      <div className="bot-topbar">
        <div className="bot-topbar-left">
          <div className="bot-topbar-title">Bildirishnomalar</div>
          <div className="bot-topbar-subtitle">Diqqat talab qiladigan ish signallari</div>
        </div>
      </div>

      {activeSection === 'summary' ? (
        <section className="workspace-summary-grid" id="summary">
          <article className="workspace-summary-card">
            <span>Pending approval</span>
            <strong>{scopedApprovals.length}</strong>
            <p>Manager qarori kutayotgan yozuvlar</p>
          </article>
          <article className="workspace-summary-card">
            <span>Qarz ogohlantirish</span>
            <strong>{debtAlerts.length}</strong>
            <p>Balansi ochiq orderlar</p>
          </article>
          <article className="workspace-summary-card">
            <span>Detal kutilmoqda</span>
            <strong>{waitingPartsOrders.length}</strong>
            <p>Parts topilishi kerak bo'lgan ishlar</p>
          </article>
          <article className="workspace-summary-card">
            <span>Shoshilinch</span>
            <strong>{urgentOrders.length}</strong>
            <p>Urgent yoki yuqori prioritet orderlar</p>
          </article>
        </section>
      ) : activeSection === 'approvals' ? (
        <section className="dashboard-grid" id="approvals">
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Tasdiq kutyapti</p>
                <h3>Pending approvallar</h3>
              </div>
            </div>
            {scopedApprovals.length === 0 ? (
              <div className="workspace-empty-state">
                <strong>Pending approval yo'q</strong>
                <p>Hozircha qaror kutayotgan yozuv topilmadi.</p>
              </div>
            ) : (
              <div className="report-stack">
                {scopedApprovals.map((item) => (
                  item.order?.id ? (
                    <Link key={item.id} to={`/orders/${item.order.id}`} className="report-row notification-row">
                      <div>
                        <strong>{item.order.orderNumber || 'Order'}</strong>
                        <span>{getApprovalTypeLabel(item.approvalTypeCode)} | {item.requestedByStaff?.fullName || '-'}</span>
                      </div>
                      <b>Kutilmoqda</b>
                    </Link>
                  ) : (
                    <div key={item.id} className="report-row notification-row is-disabled">
                      <div>
                        <strong>{item.order?.orderNumber || 'Order topilmadi'}</strong>
                        <span>{getApprovalTypeLabel(item.approvalTypeCode)} | {item.requestedByStaff?.fullName || '-'}</span>
                      </div>
                      <b>Kutilmoqda</b>
                    </div>
                  )
                ))}
              </div>
            )}
          </article>
        </section>
      ) : activeSection === 'debt' ? (
        <section className="dashboard-grid">
          <article className="panel" id="debt">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Qarz signali</p>
                <h3>To'lov talab qiladigan orderlar</h3>
              </div>
            </div>
            {debtAlerts.length === 0 ? (
              <div className="workspace-empty-state">
                <strong>Qarzli order yo'q</strong>
                <p>Balansi ochiq order topilmadi.</p>
              </div>
            ) : (
              <div className="report-stack">
                {debtAlerts.map((item) => (
                  <Link key={item.id} to={`/orders/${item.id}`} className="report-row notification-row">
                    <div>
                      <strong>{item.orderNumber}</strong>
                      <span>{item.client.fullName} | {item.asset.displayName}</span>
                    </div>
                    <b>{money(Number(item.financial?.balanceDueAmount ?? 0))}</b>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : activeSection === 'work' ? (
        <section className="dashboard-grid" id="work">
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Parts kutilmoqda</p>
                <h3>Detalsiz turib qolgan ishlar</h3>
              </div>
            </div>
            {waitingPartsOrders.length === 0 ? (
              <div className="workspace-empty-state">
                <strong>Kutilayotgan detal yo'q</strong>
                <p>Hozircha waiting parts holatidagi order topilmadi.</p>
              </div>
            ) : (
              <div className="report-stack">
                {waitingPartsOrders.map((item) => (
                  <Link key={item.id} to={`/orders/${item.id}`} className="report-row notification-row">
                    <div>
                      <strong>{item.orderNumber}</strong>
                      <span>{item.client.fullName} | {getOrderNextStepLabel(item.status)}</span>
                    </div>
                    <b>{getOrderStatusLabel(item.status)}</b>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Shoshilinchlar</p>
                <h3>Ustuvor orderlar</h3>
              </div>
            </div>
            {urgentOrders.length === 0 ? (
              <div className="workspace-empty-state">
                <strong>Shoshilinch order yo'q</strong>
                <p>Urgent yoki yuqori prioritet order topilmadi.</p>
              </div>
            ) : (
              <div className="report-stack">
                {urgentOrders.map((item) => (
                  <Link key={item.id} to={`/orders/${item.id}`} className="report-row notification-row">
                    <div>
                      <strong>{item.orderNumber}</strong>
                      <span>{item.client.fullName} | {getOrderStatusLabel(item.status)}</span>
                    </div>
                    <b>{item.priority}</b>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : (
        <section className="panel notification-panel-wide" id="intake">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Qabul nazorati</p>
              <h3>Keyingi qadam kutayotgan orderlar</h3>
            </div>
            <b className="notification-panel-metric">{summary?.orders.active ?? scopedOrders.length}</b>
          </div>
          {intakeAttentionOrders.length === 0 ? (
            <div className="workspace-empty-state">
              <strong>Qabul e'tibori talab qilinmayapti</strong>
              <p>Yangi, diagnosis yoki smeta bosqichidagi order topilmadi.</p>
            </div>
          ) : (
            <div className="report-stack">
              {intakeAttentionOrders.map((item) => (
                <Link key={item.id} to={`/orders/${item.id}`} className="report-row notification-row">
                  <div>
                    <strong>{item.orderNumber}</strong>
                    <span>{item.client.fullName} | {getOrderNextStepLabel(item.status)}</span>
                  </div>
                  <b>{getOrderStatusLabel(item.status)}</b>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </WorkspaceLayout>
  )
}

export default NotificationsPage
