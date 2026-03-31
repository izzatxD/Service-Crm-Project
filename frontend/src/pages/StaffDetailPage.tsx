import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/access'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { useStaffProfile } from '../hooks/useOrganizations'
import { usePermissions, useRoles, useUpdateRole } from '../hooks/useRoles'
import { PERMISSION_CATEGORY_LABELS, formatPermissionLabel, groupPermissionsByCategory } from '../lib/permissions'
import { useToast } from '../hooks/useToast'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { formatDateTimeUz, formatMoney } from '../lib/format'

function StaffDetailPage() {
  const { id = '' } = useParams()
  const { auth } = useAuth()
  const token = auth?.accessToken ?? ''
  const canManageRolePermissions = hasPermission(auth, 'system.settings')
  const { toast } = useToast()
  const { setOrganizationId } = useWorkspaceSelection()
  const { data, isLoading, isError, error } = useStaffProfile(token, id, !!id)
  const profile = data?.staffMember
  const organizationId = profile?.organizationId ?? ''
  const { data: roles = [] } = useRoles(token, organizationId)
  const { data: allPermissions = [] } = usePermissions(token)
  const updateRole = useUpdateRole(token, organizationId)
  const [viewingPermissionRoleId, setViewingPermissionRoleId] = useState('')
  const [editingPermissionRoleId, setEditingPermissionRoleId] = useState('')
  const [editingPermissionIds, setEditingPermissionIds] = useState<string[]>([])

  useEffect(() => {
    if (data?.staffMember.organizationId) {
      setOrganizationId(data.staffMember.organizationId)
    }
  }, [data?.staffMember.organizationId, setOrganizationId])

  const summary = data?.summary
  const activeTasks = data?.activeTasks ?? []
  const completedTasks = data?.recentCompletedTasks ?? []
  const recentPayments = data?.recentPayments ?? []
  const recentApprovals = data?.recentApprovals ?? []
  const recentAssignments = data?.recentAssignments ?? []
  const editableAssignedRoles = useMemo(() => {
    if (!profile) return []

    return profile.assignedRoles.map((assigned) => {
      const grantedPermissions = assigned.role.rolePermissions ?? []
      const grantedIds = new Set(grantedPermissions.map((item) => item.permissionId))
      const missingPermissions = allPermissions.filter((permission) => !grantedIds.has(permission.id))
      const grantedGrouped = groupPermissionsByCategory(
        grantedPermissions.map((item) => ({
          ...item,
          code: item.permission.code,
        })),
      )
      const missingGrouped = groupPermissionsByCategory(missingPermissions)

      return {
        ...assigned,
        grantedPermissions,
        missingPermissions,
        grantedGrouped,
        missingGrouped,
      }
    })
  }, [allPermissions, profile])
  const groupedAllPermissions = useMemo(() => {
    return groupPermissionsByCategory(allPermissions)
  }, [allPermissions])
  const viewingRole = useMemo(
    () => roles.find((role) => role.id === viewingPermissionRoleId) ?? null,
    [roles, viewingPermissionRoleId],
  )
  const editingRole = useMemo(
    () => roles.find((role) => role.id === editingPermissionRoleId) ?? null,
    [editingPermissionRoleId, roles],
  )
  const activeRole = editingRole ?? viewingRole
  const activeAssignedRole = useMemo(() => {
    if (!activeRole || !editableAssignedRoles.length) return null
    return editableAssignedRoles.find((assigned) => assigned.role.id === activeRole.id) ?? null
  }, [activeRole, editableAssignedRoles])

  function startPermissionView(roleId: string) {
    setViewingPermissionRoleId(roleId)
  }

  function startPermissionEdit(roleId: string) {
    const targetRole = roles.find((role) => role.id === roleId)
    if (!targetRole) {
      toast('Rol topilmadi.', 'error')
      return
    }

    setViewingPermissionRoleId('')
    setEditingPermissionRoleId(roleId)
    setEditingPermissionIds(
      targetRole.rolePermissions?.map((item) => item.permissionId) ?? [],
    )
  }

  function cancelPermissionEdit() {
    setViewingPermissionRoleId('')
    setEditingPermissionRoleId('')
    setEditingPermissionIds([])
  }

  function toggleEditingPermission(permissionId: string) {
    setEditingPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId],
    )
  }

  async function handleSaveRolePermissions() {
    if (!editingPermissionRoleId || !organizationId) {
      toast('Rol tanlanmagan.', 'error')
      return
    }

    const targetRole = roles.find((role) => role.id === editingPermissionRoleId)
    if (!targetRole) {
      toast('Rol topilmadi.', 'error')
      return
    }

    try {
      await updateRole.mutateAsync({
        id: editingPermissionRoleId,
        payload: {
          organizationId,
          name: targetRole.name,
          code: targetRole.code,
          permissionIds: editingPermissionIds,
        },
      })
      cancelPermissionEdit()
      toast('Role ruxsatlari yangilandi.', 'success')
    } catch (updateError) {
      toast(
        updateError instanceof Error
          ? updateError.message
          : 'Role ruxsatlari yangilanmadi.',
        'error',
      )
    }
  }

  return (
    <WorkspaceLayout>
      <div className="bot-topbar">
        <div className="bot-topbar-left">
          <div className="bot-topbar-title">Xodim profili</div>
          <div className="bot-topbar-subtitle">Natija, yuklama va tarix</div>
        </div>
      </div>

      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <Link className="back-btn" to="/staff">Xodimlar ro'yxatiga qaytish</Link>
            <p className="eyebrow">Profil kartasi</p>
            <h2 style={{ marginTop: 4 }}>{profile?.fullName ?? 'Yuklanmoqda...'}</h2>
            <p style={{ color: 'var(--text-2)', marginTop: 6 }}>
              {profile?.organization.name ?? '-'} / {profile?.primaryRole ?? '-'}
            </p>
          </div>

          {profile ? (
            <div className="dashboard-chip-row" style={{ alignSelf: 'flex-start' }}>
              <span className={`status-pill ${profile.isActive ? 'green' : 'red'}`}>
                {profile.isActive ? 'faol' : 'nofaol'}
              </span>
              {profile.assignedRoles.map((assigned) => (
                <span key={assigned.id} className="status-pill accent">{assigned.role.name}</span>
              ))}
            </div>
          ) : null}
        </div>

        {profile ? (
          <div className="client-meta-row" style={{ marginTop: 16 }}>
            <div className="client-meta-chip">
              <span>Email</span>
              <strong>{profile.user.email}</strong>
            </div>
            <div className="client-meta-chip">
              <span>Telefon</span>
              <strong>{profile.user.phone || "Yo'q"}</strong>
            </div>
            <div className="client-meta-chip">
              <span>Ish boshlagan</span>
              <strong>{profile.hiredAt ? formatDateTimeUz(profile.hiredAt).split(',')[0] : '-'}</strong>
            </div>
          </div>
        ) : null}
      </section>

      {isLoading ? (
        <section className="panel">
          <div className="workspace-empty-state">
            <strong>Profil yuklanmoqda</strong>
            <p>Xodimning umumiy ishlari tayyorlanmoqda.</p>
          </div>
        </section>
      ) : null}

      {isError ? (
        <section className="panel">
          <div className="workspace-empty-state">
            <strong>Profilni yuklab bo'lmadi</strong>
            <p>{error instanceof Error ? error.message : "Noma'lum xato yuz berdi."}</p>
          </div>
        </section>
      ) : null}

      {summary ? (
        <>
          {profile?.assignedRoles.length ? (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Role ruxsatlari</p>
                  <h3>Qaysi role nimaga ruxsat beradi</h3>
                </div>
              </div>

              <div className="workspace-form-stack">
                {editableAssignedRoles.map((assigned) => (
                  <article key={assigned.id} className="team-card role-permission-card is-compact">
                    <div className="team-card-head role-permission-card__head">
                      <div className="team-copy role-permission-card__title">
                        <strong>{assigned.role.name}</strong>
                        <span>{assigned.role.code}</span>
                      </div>
                      <div className="role-permission-card__meta">
                        <span className="status-pill green">
                          {assigned.grantedPermissions.length} ta berilgan
                        </span>
                        <span className="status-pill">
                          {assigned.missingPermissions.length} ta yopiq
                        </span>
                      </div>
                    </div>

                    <div className="role-permission-card__preview">
                      <div className="dashboard-chip-row">
                        {assigned.grantedPermissions.slice(0, 4).map((item) => (
                          <span key={item.permissionId} className="status-pill green">
                            {formatPermissionLabel(item.permission.code)}
                          </span>
                        ))}
                        {assigned.grantedPermissions.length > 4 ? (
                          <span className="status-pill">
                            +{assigned.grantedPermissions.length - 4} ta yana
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="role-permission-card__actions">
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => startPermissionView(assigned.role.id)}
                      >
                        Ko'rish
                      </button>
                      {canManageRolePermissions ? (
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => startPermissionEdit(assigned.role.id)}
                        >
                          Tahrirlash
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeRole ? (
            <div className="role-permission-drawer-backdrop" onClick={cancelPermissionEdit}>
              <section
                className="role-permission-drawer"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="role-permission-drawer__head">
                  <div>
                    <p className="eyebrow">
                      {editingRole ? 'Ruxsatlarni tahrirlash' : 'Role ruxsatlari'}
                    </p>
                    <h3>{activeRole.name}</h3>
                    <p className="role-permission-drawer__code">{activeRole.code}</p>
                  </div>
                  <div className="role-permission-drawer__top-actions">
                    {!editingRole && canManageRolePermissions ? (
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => startPermissionEdit(activeRole.id)}
                      >
                        Tahrirlash
                      </button>
                    ) : null}
                    <button type="button" className="ghost-btn" onClick={cancelPermissionEdit}>
                      Yopish
                    </button>
                  </div>
                </div>

                <div className="role-permission-editor role-permission-editor--drawer">
                  {editingRole ? (
                    <>
                      <div className="role-permission-editor__groups">
                        {Object.entries(groupedAllPermissions).map(([category, permissions]) => (
                          <section key={category} className="role-permission-editor__group">
                            <span className="role-permission-group__title">
                              {PERMISSION_CATEGORY_LABELS[category] ?? category}
                            </span>
                            <div className="role-permission-editor__options">
                              {permissions.map((permission) => (
                                <label key={permission.id} className="role-permission-editor__option">
                                  <input
                                    type="checkbox"
                                    checked={editingPermissionIds.includes(permission.id)}
                                    onChange={() => toggleEditingPermission(permission.id)}
                                  />
                                  <div>
                                    <strong>{formatPermissionLabel(permission.code)}</strong>
                                    <small>{permission.code}</small>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>

                      <div className="role-permission-drawer__actions">
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={handleSaveRolePermissions}
                          disabled={updateRole.isPending}
                        >
                          {updateRole.isPending ? 'Saqlanmoqda...' : 'Ruxsatlarni saqlash'}
                        </button>
                        <button type="button" className="ghost-btn" onClick={cancelPermissionEdit}>
                          Bekor qilish
                        </button>
                      </div>
                    </>
                  ) : activeAssignedRole ? (
                    <div className="role-permission-view">
                      <section className="role-permission-view__section">
                        <div className="role-permission-view__header">
                          <strong>Berilgan ruxsatlar</strong>
                          <span className="status-pill green">
                            {activeAssignedRole.grantedPermissions.length} ta
                          </span>
                        </div>
                        <div className="role-permission-view__groups">
                          {Object.entries(
                            activeAssignedRole.grantedGrouped as Record<
                              string,
                              Array<{ permissionId: string; permission: { code: string } }>
                            >,
                          ).map(([category, permissions]) => (
                            <div key={category} className="role-permission-view__group">
                              <span className="role-permission-group__title">
                                {PERMISSION_CATEGORY_LABELS[category] ?? category}
                              </span>
                              <div className="dashboard-chip-row">
                                {permissions.map((item) => (
                                  <span key={item.permissionId} className="status-pill green">
                                    {formatPermissionLabel(item.permission.code)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="role-permission-view__section">
                        <div className="role-permission-view__header">
                          <strong>Yopiq ruxsatlar</strong>
                          <span className="status-pill">
                            {activeAssignedRole.missingPermissions.length} ta
                          </span>
                        </div>
                        <div className="role-permission-view__groups">
                          {Object.entries(
                            activeAssignedRole.missingGrouped as Record<
                              string,
                              Array<{ id: string; code: string }>
                            >,
                          ).map(([category, permissions]) => (
                            <div key={category} className="role-permission-view__group">
                              <span className="role-permission-group__title">
                                {PERMISSION_CATEGORY_LABELS[category] ?? category}
                              </span>
                              <div className="dashboard-chip-row">
                                {permissions.map((permission) => (
                                  <span key={permission.id} className="status-pill">
                                    {formatPermissionLabel(permission.code)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}

          <section className="workspace-summary-grid">
            <article className="workspace-summary-card">
              <span>Jami task</span>
              <strong>{summary.totalTaskCount}</strong>
              <p>Biriktirilgan barcha ishlar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Aktiv task</span>
              <strong>{summary.activeTaskCount}</strong>
              <p>Hozir bajarilayotgan ishlar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Bajarilgan</span>
              <strong>{summary.completedTaskCount}</strong>
              <p>Yakunlangan tasklar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Effektivlik</span>
              <strong>{summary.completionRate}%</strong>
              <p>Yakunlangan task ulushi</p>
            </article>
            <article className="workspace-summary-card">
              <span>Approval</span>
              <strong>{summary.requestedApprovalCount + summary.approvedDecisionCount}</strong>
              <p>So'rov va qarorlar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Qabul qilingan to'lov</span>
              <strong>{formatMoney(summary.collectedAmount, '')}</strong>
              <p>{summary.paymentCount} ta payment</p>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel panel-wide">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Aktiv ishlar</p>
                  <h3>Hozirgi task va orderlar</h3>
                </div>
              </div>

              {activeTasks.length === 0 ? (
                <div className="workspace-empty-state">
                  <strong>Aktiv task yo'q</strong>
                  <p>Bu xodimga hozircha ochiq ish biriktirilmagan.</p>
                </div>
              ) : (
                <div className="staff-grid">
                  {activeTasks.map((task) => (
                    <article key={task.id} className="team-card">
                      <div className="team-card-head">
                        <div className="team-copy">
                          <strong>{task.title}</strong>
                          <span>{task.order.orderNumber} / {task.order.client.fullName}</span>
                        </div>
                        <span className="status-pill accent">{task.status}</span>
                      </div>
                      <div className="client-meta-row">
                        <div className="client-meta-chip">
                          <span>Avto</span>
                          <strong>{task.order.asset.displayName}</strong>
                        </div>
                        <div className="client-meta-chip">
                          <span>Narx</span>
                          <strong>{formatMoney(task.estimatedLaborAmount, '')}</strong>
                        </div>
                        <div className="client-meta-chip">
                          <span>Yangilangan</span>
                          <strong>{formatDateTimeUz(task.updatedAt)}</strong>
                        </div>
                      </div>
                      <Link className="ghost-btn" to={`/orders/${task.order.id}`}>Orderni ochish</Link>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Ish yuritish</p>
                  <h3>Yuklama ko'rsatkichlari</h3>
                </div>
              </div>

              <div className="workspace-form-stack">
                <div className="client-meta-chip">
                  <span>Orderlar</span>
                  <strong>{summary.assignedOrderCount}</strong>
                </div>
                <div className="client-meta-chip">
                  <span>Aktiv assignment</span>
                  <strong>{summary.activeAssignmentCount}</strong>
                </div>
                <div className="client-meta-chip">
                  <span>Yopilgan assignment</span>
                  <strong>{summary.completedAssignmentCount}</strong>
                </div>
                <div className="client-meta-chip">
                  <span>Pauza task</span>
                  <strong>{summary.pausedTaskCount}</strong>
                </div>
                <div className="client-meta-chip">
                  <span>Tasdiqlangan qaror</span>
                  <strong>{summary.approvedDecisionCount}</strong>
                </div>
                <div className="client-meta-chip">
                  <span>Rad etilgan qaror</span>
                  <strong>{summary.rejectedDecisionCount}</strong>
                </div>
              </div>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel panel-wide">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Tarix</p>
                  <h3>So'nggi bajarilgan ishlar</h3>
                </div>
              </div>

              {completedTasks.length === 0 ? (
                <div className="workspace-empty-state">
                  <strong>Yakunlangan task yo'q</strong>
                  <p>Bu xodim bo'yicha hali history yig'ilmagan.</p>
                </div>
              ) : (
                <div className="workspace-form-stack">
                  {completedTasks.map((task) => (
                    <article key={task.id} className="team-card">
                      <div className="team-card-head">
                        <div className="team-copy">
                          <strong>{task.title}</strong>
                          <span>{task.order.orderNumber} / {task.order.client.fullName}</span>
                        </div>
                        <span className="status-pill green">completed</span>
                      </div>
                      <div className="client-meta-row">
                        <div className="client-meta-chip">
                          <span>Avto</span>
                          <strong>{task.order.asset.displayName}</strong>
                        </div>
                        <div className="client-meta-chip">
                          <span>Mehnat</span>
                          <strong>{formatMoney(task.actualLaborAmount, '')}</strong>
                        </div>
                        <div className="client-meta-chip">
                          <span>Tugagan</span>
                          <strong>{formatDateTimeUz(task.completedAt)}</strong>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">To'lovlar</p>
                  <h3>Qabul qilgan paymentlar</h3>
                </div>
              </div>

              {recentPayments.length === 0 ? (
                <div className="workspace-empty-state">
                  <strong>Payment yo'q</strong>
                  <p>Bu xodim hali payment qabul qilmagan.</p>
                </div>
              ) : (
                <div className="workspace-form-stack">
                  {recentPayments.map((payment) => (
                    <div key={payment.id} className="client-meta-chip">
                      <span>{payment.order.orderNumber} / {payment.paymentMethodCode}</span>
                      <strong>{formatMoney(payment.amount, '')}</strong>
                      <small style={{ color: 'var(--text-3)' }}>
                        {payment.order.client.fullName} / {formatDateTimeUz(payment.paidAt)}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Approval</p>
                  <h3>So'nggi tasdiqlar</h3>
                </div>
              </div>

              {recentApprovals.length === 0 ? (
                <div className="workspace-empty-state">
                  <strong>Approval topilmadi</strong>
                  <p>Bu xodim bo'yicha approval tarixi yo'q.</p>
                </div>
              ) : (
                <div className="workspace-form-stack">
                  {recentApprovals.map((approval) => (
                    <article key={approval.id} className="team-card">
                      <div className="team-card-head">
                        <div className="team-copy">
                          <strong>{approval.order.orderNumber}</strong>
                          <span>{approval.approvalTypeCode}</span>
                        </div>
                        <span className={`status-pill ${approval.status === 'approved' ? 'green' : approval.status === 'rejected' ? 'red' : 'accent'}`}>
                          {approval.status}
                        </span>
                      </div>
                      <div className="dashboard-chip-row">
                        <span className="status-pill">{approval.perspective === 'requested' ? "so'rovchi" : 'qaror qiluvchi'}</span>
                      </div>
                      <p style={{ color: 'var(--text-2)', marginTop: 10 }}>
                        {approval.decisionNote || approval.requestNote || "Qo'shimcha izoh yo'q."}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Assignment</p>
                  <h3>So'nggi biriktirishlar</h3>
                </div>
              </div>

              {recentAssignments.length === 0 ? (
                <div className="workspace-empty-state">
                  <strong>Assignment yo'q</strong>
                  <p>Bu xodim bo'yicha assignment harakati topilmadi.</p>
                </div>
              ) : (
                <div className="workspace-form-stack">
                  {recentAssignments.map((assignment) => (
                    <article key={assignment.id} className="team-card">
                      <div className="team-card-head">
                        <div className="team-copy">
                          <strong>{assignment.order.orderNumber}</strong>
                          <span>{assignment.orderTask?.title || 'Order assignment'}</span>
                        </div>
                        <span className="status-pill accent">{assignment.status}</span>
                      </div>
                      <p style={{ color: 'var(--text-2)', marginTop: 10 }}>
                        {assignment.toStaff.fullName} / {formatDateTimeUz(assignment.assignedAt)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      ) : null}
    </WorkspaceLayout>
  )
}

export default StaffDetailPage
