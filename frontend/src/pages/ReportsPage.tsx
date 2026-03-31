import { useMemo } from 'react'

import { useAuth } from '../auth/AuthContext'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { useApprovals } from '../hooks/useApprovals'
import { useClients } from '../hooks/useClients'
import { useDashboardSummary } from '../hooks/useDashboard'
import { useOrders } from '../hooks/useOrders'
import { useStaff } from '../hooks/useOrganizations'
import { useWorkspaceSection } from '../hooks/useWorkspaceSection'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { formatMoney } from '../lib/format'
import { getApprovalTypeLabel, getOrderStatusLabel } from '../lib/labels'

const REPORT_SECTIONS = ['summary', 'finance', 'team', 'approvals'] as const

function ReportsPage() {
  const { auth } = useAuth()
  const token = auth?.accessToken ?? ''
  const { organizationId, branchId } = useWorkspaceSelection()
  const { activeSection } = useWorkspaceSection(REPORT_SECTIONS, 'summary')

  const { data: summary } = useDashboardSummary(token, organizationId, branchId || undefined)
  const { data: clients = [] } = useClients(token, organizationId)
  const { data: staff = [] } = useStaff(token, organizationId, true)
  const { data: approvals = [] } = useApprovals(token, !!token)
  const { data: orders = [] } = useOrders(token, organizationId)

  const scopedOrders = useMemo(() => {
    if (!branchId) {
      return orders
    }

    return orders.filter((order) => order.branch.id === branchId)
  }, [branchId, orders])

  const scopedApprovals = useMemo(
    () => approvals.filter((item) => item.organizationId === organizationId),
    [approvals, organizationId],
  )

  const clientDebtLeaders = useMemo(
    () => (summary?.finance.topDebtors ?? []).slice(0, 5),
    [summary?.finance.topDebtors],
  )

  const staffLoad = useMemo(() => {
    return staff
      .map((member) => {
        const activeTaskCount = scopedOrders.reduce(
          (sum, order) =>
            sum +
            order.tasks.filter((task) =>
              task.assignedStaff?.id === member.id &&
              ['pending', 'in_progress', 'waiting_parts'].includes(task.status),
            ).length,
          0,
        )

        return {
          id: member.id,
          fullName: member.fullName,
          role: member.primaryRole,
          activeTaskCount,
        }
      })
      .sort((left, right) => right.activeTaskCount - left.activeTaskCount)
      .slice(0, 5)
  }, [scopedOrders, staff])

  const orderHealth = useMemo(() => {
    const total = scopedOrders.length
    const completed = scopedOrders.filter((order) =>
      ['completed', 'delivered'].includes(order.status),
    ).length
    const waitingParts = scopedOrders.filter((order) => order.status === 'waiting_parts').length
    const unpaid = scopedOrders.filter(
      (order) => Number(order.financial?.balanceDueAmount ?? 0) > 0.01,
    ).length

    return {
      total,
      waitingParts,
      unpaid,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
    }
  }, [scopedOrders])

  const statusBreakdown = useMemo(() => {
    return (summary?.orders.byStatus ?? [])
      .filter((item) => item.count > 0)
      .sort((left, right) => right.count - left.count)
  }, [summary?.orders.byStatus])

  const pendingApprovals = scopedApprovals.filter((item) => item.status === 'pending')

  return (
    <WorkspaceLayout>
      <div className="bot-topbar">
        <div className="bot-topbar-left">
          <div className="bot-topbar-title">Hisobotlar</div>
          <div className="bot-topbar-subtitle">Tahlil va boshqaruv ko'rsatkichlari</div>
        </div>
      </div>

      {activeSection === 'summary' ? (
        <>
          <section className="workspace-summary-grid" id="summary">
            <article className="workspace-summary-card">
              <span>Tushum</span>
              <strong>{formatMoney(Number(summary?.finance.paidTotal ?? 0))}</strong>
              <p>Jami to'langan summa</p>
            </article>
            <article className="workspace-summary-card">
              <span>Qarz</span>
              <strong>{formatMoney(Number(summary?.finance.balanceDue ?? 0))}</strong>
              <p>Hali undirilmagan summa</p>
            </article>
            <article className="workspace-summary-card">
              <span>Faol order</span>
              <strong>{summary?.orders.active ?? 0}</strong>
              <p>Jarayondagi ishlar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Tasdiq kutmoqda</span>
              <strong>{pendingApprovals.length}</strong>
              <p>Tasdiq kutayotganlar</p>
            </article>
          </section>

          <section className="workspace-summary-grid">
            <article className="workspace-summary-card">
              <span>Yopilish darajasi</span>
              <strong>{orderHealth.completionRate}%</strong>
              <p>Tugagan va topshirilgan orderlar ulushi</p>
            </article>
            <article className="workspace-summary-card">
              <span>Detal kutilmoqda</span>
              <strong>{orderHealth.waitingParts}</strong>
              <p>Jarayonni ushlab turgan orderlar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Qarzi bor order</span>
              <strong>{orderHealth.unpaid}</strong>
              <p>To'liq yopilmagan buyurtmalar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Jami order</span>
              <strong>{orderHealth.total}</strong>
              <p>Tanlangan scope bo'yicha</p>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Order holatlari</p>
                  <h3>Status breakdown</h3>
                </div>
              </div>
              {statusBreakdown.length === 0 ? (
                <div className="workspace-empty-state">
                  <strong>Statistika yo'q</strong>
                  <p>Tanlangan scope bo'yicha orderlar hali topilmadi.</p>
                </div>
              ) : (
                <div className="report-stack">
                  {statusBreakdown.map((item) => (
                    <div key={item.status} className="report-row">
                      <div>
                        <strong>{getOrderStatusLabel(item.status)}</strong>
                        <span>Joriy jarayon bo'yicha orderlar</span>
                      </div>
                      <b>{item.count}</b>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Mijoz bazasi</p>
                  <h3>Qisqa nazorat</h3>
                </div>
              </div>
              <div className="report-metric-list">
                <div className="report-metric-item">
                  <span>Jami mijoz</span>
                  <strong>{clients.length}</strong>
                </div>
                <div className="report-metric-item">
                  <span>Faol xodim</span>
                  <strong>{staff.filter((item) => item.isActive).length}</strong>
                </div>
                <div className="report-metric-item">
                  <span>Bugungi order</span>
                  <strong>{summary?.orders.today ?? 0}</strong>
                </div>
                <div className="report-metric-item">
                  <span>Bekor qilingan</span>
                  <strong>{summary?.orders.cancelled ?? 0}</strong>
                </div>
              </div>
            </article>
          </section>
        </>
      ) : activeSection === 'finance' ? (
        <section className="dashboard-grid" id="finance">
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Moliya</p>
                <h3>Asosiy ko'rsatkichlar</h3>
              </div>
            </div>
            <div className="report-metric-list">
              <div className="report-metric-item">
                <span>Bugungi tushum</span>
                <strong>{formatMoney(Number(summary?.finance.todayPayments ?? 0))}</strong>
              </div>
              <div className="report-metric-item">
                <span>Jami xizmat</span>
                <strong>{formatMoney(Number(summary?.finance.grandTotal ?? 0))}</strong>
              </div>
              <div className="report-metric-item">
                <span>Detal summasi</span>
                <strong>{formatMoney(Number(summary?.finance.partsTotal ?? 0))}</strong>
              </div>
              <div className="report-metric-item">
                <span>Mehnat summasi</span>
                <strong>{formatMoney(Number(summary?.finance.laborTotal ?? 0))}</strong>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Qarzdor mijozlar</p>
                <h3>Eng katta qarzdorlar</h3>
              </div>
            </div>
            {clientDebtLeaders.length === 0 ? (
              <div className="workspace-empty-state">
                <strong>Qarzdor yo'q</strong>
                <p>Hozircha qarzdor mijoz topilmadi.</p>
              </div>
            ) : (
              <div className="report-stack">
                {clientDebtLeaders.map((item) => (
                  <div key={item.id} className="report-row">
                    <div>
                      <strong>{item.clientName}</strong>
                      <span>{item.orderNumber} | {item.assetName}</span>
                    </div>
                    <b>{formatMoney(item.balanceDueAmount)}</b>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : activeSection === 'team' ? (
        <section className="dashboard-grid" id="team">
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Jamoa yuklamasi</p>
                <h3>Eng band xodimlar</h3>
              </div>
            </div>
            {staffLoad.length === 0 ? (
              <div className="workspace-empty-state">
                <strong>Xodim topilmadi</strong>
                <p>Tanlangan firma bo'yicha xodim yo'q.</p>
              </div>
            ) : (
              <div className="report-stack">
                {staffLoad.map((item) => (
                  <div key={item.id} className="report-row">
                    <div>
                      <strong>{item.fullName}</strong>
                      <span>{item.role}</span>
                    </div>
                    <b>{item.activeTaskCount} task</b>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : (
        <section className="dashboard-grid">
          <article className="panel" id="approvals">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Tasdiqlar</p>
                <h3>Kutilayotgan qarorlar</h3>
              </div>
            </div>
            {pendingApprovals.length === 0 ? (
              <div className="workspace-empty-state">
                <strong>Tasdiq kutayotgan yozuv yo'q</strong>
                <p>Hozircha tasdiq kutayotgan yozuv topilmadi.</p>
              </div>
            ) : (
              <div className="report-stack">
                {pendingApprovals.slice(0, 5).map((item) => (
                  <div key={item.id} className="report-row">
                    <div>
                      <strong>{item.order?.orderNumber || 'Order'}</strong>
                      <span>{getApprovalTypeLabel(item.approvalTypeCode || 'estimate')}</span>
                    </div>
                    <b>{item.requestedByStaff?.fullName || '-'}</b>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      )}
    </WorkspaceLayout>
  )
}

export default ReportsPage
