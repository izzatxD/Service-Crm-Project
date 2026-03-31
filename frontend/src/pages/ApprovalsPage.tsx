import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/access'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { useApprovals, useUpdateApproval } from '../hooks/useApprovals'
import { useToast } from '../hooks/useToast'
import { useWorkspaceSection } from '../hooks/useWorkspaceSection'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { formatDateTimeUz } from '../lib/format'
import { getApprovalStatusLabel, getApprovalTypeLabel } from '../lib/labels'

type ApprovalTab = 'pending' | 'approved' | 'rejected' | 'all'
const APPROVAL_SECTIONS = ['summary', 'list'] as const

function ApprovalsPage() {
  const { auth } = useAuth()
  const token = auth?.accessToken ?? ''
  const canApprove = hasPermission(auth, 'order.approve')
  const { toast } = useToast()
  const { organizationId } = useWorkspaceSelection()
  const { data: approvals = [] } = useApprovals(token, !!token)
  const updateApproval = useUpdateApproval(token)
  const [tab, setTab] = useState<ApprovalTab>('pending')

  const currentStaffMember = useMemo(() => {
    return (
      auth?.me?.staffMembers.find((member) => member.organizationId === organizationId) ??
      auth?.me?.staffMembers[0] ??
      null
    )
  }, [auth?.me?.staffMembers, organizationId])

  const scopedApprovals = useMemo(() => {
    if (!organizationId) return approvals
    return approvals.filter((approval) => approval.organizationId === organizationId)
  }, [approvals, organizationId])

  const filteredApprovals = useMemo(() => {
    if (tab === 'all') return scopedApprovals
    return scopedApprovals.filter((approval) => approval.status === tab)
  }, [scopedApprovals, tab])

  const approvalSummary = useMemo(() => {
    return {
      pending: scopedApprovals.filter((approval) => approval.status === 'pending').length,
      approved: scopedApprovals.filter((approval) => approval.status === 'approved').length,
      rejected: scopedApprovals.filter((approval) => approval.status === 'rejected').length,
    }
  }, [scopedApprovals])

  const priorityApprovals = useMemo(() => {
    return scopedApprovals
      .filter((approval) => approval.status === 'pending')
      .sort((left, right) => {
        return new Date(left.requestedAt ?? 0).getTime() - new Date(right.requestedAt ?? 0).getTime()
      })
      .slice(0, 3)
  }, [scopedApprovals])
  const { activeSection } = useWorkspaceSection(APPROVAL_SECTIONS, 'summary')

  async function handleDecision(approvalId: string, status: 'approved' | 'rejected') {
    if (!currentStaffMember?.id) {
      toast('Tasdiqlovchi xodim topilmadi.', 'error')
      return
    }

    try {
      await updateApproval.mutateAsync({
        approvalId,
        payload: {
          approvedByStaffId: currentStaffMember.id,
          status,
          decisionNote: status === 'approved' ? 'Panel orqali tasdiqlandi' : 'Panel orqali rad etildi',
        },
      })
      toast(status === 'approved' ? 'Tasdiqlandi.' : 'Rad etildi.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Tasdiq yangilanmadi.', 'error')
    }
  }

  return (
    <WorkspaceLayout>
      <div className="bot-topbar">
        <div className="bot-topbar-left">
          <div className="bot-topbar-title">Tasdiqlar</div>
          <div className="bot-topbar-subtitle">Approval va qarorlar markazi</div>
        </div>
      </div>

      {activeSection === 'summary' ? (
        <>
          <section className="workspace-summary-grid" id="summary">
            <article className="workspace-summary-card">
              <span>Kutilayotgan</span>
              <strong>{approvalSummary.pending}</strong>
              <p>Tasdiq kutayotgan yozuvlar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Jami</span>
              <strong>{scopedApprovals.length}</strong>
              <p>Tasdiq yozuvlari</p>
            </article>
            <article className="workspace-summary-card">
              <span>Tasdiqlangan</span>
              <strong>{approvalSummary.approved}</strong>
              <p>Ijobiy hal bo'lganlar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Rad etilgan</span>
              <strong>{approvalSummary.rejected}</strong>
              <p>Qayta ko'rib chiqish kerak bo'lganlar</p>
            </article>
          </section>

          {priorityApprovals.length > 0 ? (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Tezkor navbat</p>
                  <h3>Eng yaqin ko'rilishi kerak bo'lganlar</h3>
                </div>
              </div>
              <div className="report-stack">
                {priorityApprovals.map((approval) => (
                  <div key={approval.id} className="report-row">
                    <div>
                      <strong>{approval.order?.orderNumber || 'Order'}</strong>
                      <span>{getApprovalTypeLabel(approval.approvalTypeCode || 'estimate')} | {formatDateTimeUz(approval.requestedAt)}</span>
                    </div>
                    <b>{approval.requestedByStaff?.fullName || '-'}</b>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <div className="main-tabs" id="list">
            <button className={`main-tab${tab === 'pending' ? ' is-active' : ''}`} onClick={() => setTab('pending')}>
              KUTILAYOTGAN
            </button>
            <button className={`main-tab${tab === 'approved' ? ' is-active' : ''}`} onClick={() => setTab('approved')}>
              TASDIQLANGAN
            </button>
            <button className={`main-tab${tab === 'rejected' ? ' is-active' : ''}`} onClick={() => setTab('rejected')}>
              RAD ETILGAN
            </button>
            <button className={`main-tab${tab === 'all' ? ' is-active' : ''}`} onClick={() => setTab('all')}>
              BARCHASI
            </button>
          </div>

          <section className="panel" id="list">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Approval list</p>
                <h3>Jarayondagi qarorlar</h3>
              </div>
            </div>

            {filteredApprovals.length === 0 ? (
              <div className="workspace-empty-state">
                <strong>Tasdiq topilmadi</strong>
                <p>Tanlangan filtr bo'yicha hozircha approval yo'q.</p>
              </div>
            ) : (
              <div className="approval-list">
                {filteredApprovals.map((approval) => (
                  <article key={approval.id} className="approval-card">
                    <div className="approval-card-head">
                      <div>
                        <div className="approval-type">{getApprovalTypeLabel(approval.approvalTypeCode)}</div>
                        <strong>{approval.order?.orderNumber || 'Order topilmadi'}</strong>
                      </div>
                      <span className={`status-pill ${approval.status === 'approved' ? 'green' : approval.status === 'rejected' ? 'red' : 'accent'}`}>
                        {getApprovalStatusLabel(approval.status)}
                      </span>
                    </div>

                    <div className="approval-meta">
                      <span>So'rovchi: {approval.requestedByStaff?.fullName || '-'}</span>
                      <span>So'ralgan: {formatDateTimeUz(approval.requestedAt)}</span>
                      <span>Qaror: {formatDateTimeUz(approval.decidedAt)}</span>
                    </div>

                    {approval.requestNote ? <p className="client-note">{approval.requestNote}</p> : null}
                    {approval.decisionNote ? <p className="client-note">Qaror: {approval.decisionNote}</p> : null}

                    <div className="approval-actions">
                      {approval.order?.id ? (
                        <Link className="ghost-btn" to={`/orders/${approval.order.id}`}>
                          Orderni ochish
                        </Link>
                      ) : null}
                      {canApprove && approval.status === 'pending' && (
                        <>
                          <button className="ghost-btn" onClick={() => handleDecision(approval.id, 'rejected')}>
                            Rad etish
                          </button>
                          <button className="primary-btn" onClick={() => handleDecision(approval.id, 'approved')}>
                            Tasdiqlash
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </WorkspaceLayout>
  )
}

export default ApprovalsPage
