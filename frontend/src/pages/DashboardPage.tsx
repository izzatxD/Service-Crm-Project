import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import {
  canManagePlatform,
  canAccessExpenses,
  canAccessInventory,
  canAccessPayments,
} from '../auth/access'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { useWorkspaceSection } from '../hooks/useWorkspaceSection'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import {
  useOrganizations,
  useStaff,
  useCreateOrganization,
  useCreateBranch,
  useCreateStaff,
} from '../hooks/useOrganizations'
import { useDashboardSummary } from '../hooks/useDashboard'
import { useToast } from '../hooks/useToast'
import { formatMoney } from '../lib/format'
import { getBusinessTypeLabel, getOrderStatusLabel } from '../lib/labels'

const roleOptions = ['admin', 'manager', 'worker', 'cashier', 'viewer'] as const
const businessTypeOptions = [
  { value: 'auto_service', label: 'Avto servis' },
  { value: 'service_center', label: 'Servis markazi' },
  { value: 'retail', label: 'Savdo' },
]
const DASHBOARD_SECTIONS = ['summary', 'debtors', 'actions', 'organizations'] as const
const DASHBOARD_SECTIONS_STANDARD = ['summary', 'debtors', 'actions'] as const

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function DashboardActionCard({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="dashboard-quick-link">
      <div className="dashboard-quick-card">
        <span className="dashboard-quick-label">{label}</span>
        <span className="dashboard-quick-arrow">&gt;</span>
      </div>
    </Link>
  )
}

function DashboardPage() {
  const { auth } = useAuth()
  const token = auth?.accessToken ?? ''
  const isPlatformAdmin = canManagePlatform(auth)
  const { toast } = useToast()
  const { organizationId, branchId, setOrganizationId, setBranchId } = useWorkspaceSelection()
  const [orgForm, setOrgForm] = useState({ name: '', businessTypeCode: 'auto_service' })
  const [branchForm, setBranchForm] = useState({ name: '', code: '', phone: '', addressLine: '' })
  const [staffForm, setStaffForm] = useState({
    fullName: '', email: '', phone: '', password: '', primaryRole: 'admin',
  })

  const { data: organizations = [], isLoading, refetch } = useOrganizations(token)
  const { data: staff = [] } = useStaff(token, organizationId)
  const { data: summary } = useDashboardSummary(token, organizationId, branchId || undefined)

  const createOrg = useCreateOrganization(token)
  const createBranch = useCreateBranch(token)
  const createStaff = useCreateStaff(token, organizationId)

  const selectedOrganization = useMemo(
    () => organizations.find((item) => item.id === organizationId) ?? null,
    [organizationId, organizations],
  )

  const selectedBranchName =
    selectedOrganization?.branches.find((item) => item.id === branchId)?.name ?? ''
  const { activeSection, setActiveSection } = useWorkspaceSection(
    isPlatformAdmin ? DASHBOARD_SECTIONS : DASHBOARD_SECTIONS_STANDARD,
    'summary',
  )

  const todayTushum = summary?.finance.todayPayments ?? 0
  const jamiTushum = summary?.finance.paidTotal ?? 0
  const kutilayotganTushum = summary?.finance.balanceDue ?? 0
  const qabulCount = summary?.orders.byStatus
    .filter((status) => ['new', 'pending_diagnosis'].includes(status.status))
    .reduce((sum, status) => sum + status.count, 0)
  const topshirildiCount = summary?.orders.byStatus
    .filter((status) => ['completed', 'delivered'].includes(status.status))
    .reduce((sum, status) => sum + status.count, 0)
  const activeCount = summary?.orders.active ?? 0
  const topDebtors = summary?.finance.topDebtors ?? []

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!orgForm.name.trim()) {
      toast('Firma nomini kiriting.', 'error')
      return
    }

    try {
      const created = await createOrg.mutateAsync({
        name: orgForm.name,
        businessTypeCode: orgForm.businessTypeCode,
        timezone: 'Asia/Tashkent',
        currencyCode: 'UZS',
      })
      setOrganizationId(created.id)
      setOrgForm({ name: '', businessTypeCode: 'auto_service' })
      toast('Firma yaratildi.', 'success')
      setActiveSection('organizations', true)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Firma yaratilmadi.', 'error')
    }
  }

  async function handleCreateBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId) {
      toast('Avval firma tanlang.', 'error')
      return
    }
    if (!branchForm.name.trim()) {
      toast('Filial nomini kiriting.', 'error')
      return
    }

    try {
      await createBranch.mutateAsync({ organizationId, ...branchForm })
      setBranchForm({ name: '', code: '', phone: '', addressLine: '' })
      toast("Filial qo'shildi.", 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : "Filial qo'shilmadi.", 'error')
    }
  }

  async function handleCreateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId) {
      toast('Avval firma tanlang.', 'error')
      return
    }
    if (!staffForm.fullName.trim()) {
      toast('Xodim ismini kiriting.', 'error')
      return
    }
    if (!staffForm.email.trim()) {
      toast('Email kiriting.', 'error')
      return
    }
    if (!staffForm.password.trim()) {
      toast('Parol kiriting.', 'error')
      return
    }

    try {
      await createStaff.mutateAsync({
        organizationId,
        fullName: staffForm.fullName,
        email: staffForm.email,
        phone: staffForm.phone || undefined,
        password: staffForm.password,
        primaryRole: staffForm.primaryRole as typeof roleOptions[number],
      })
      setStaffForm({ fullName: '', email: '', phone: '', password: '', primaryRole: 'admin' })
      toast("Xodim yaratildi.", 'success')
      setActiveSection('organizations', true)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Xodim yaratilmadi.', 'error')
    }
  }

  const userName =
    auth?.me?.staffMember?.fullName?.split(' ')[0] ||
    auth?.me?.staffMembers[0]?.fullName?.split(' ')[0] ||
    auth?.me?.platformAdmin?.fullName?.split(' ')[0] ||
    auth?.me?.fullName?.split(' ')[0] ||
    auth?.session.loginIdentifier?.split('@')[0] ||
    auth?.session.email?.split('@')[0] ||
    'Foydalanuvchi'

  return (
    <WorkspaceLayout>
      <div className="bot-topbar">
        <div className="bot-topbar-left">
          <div className="bot-topbar-title">AvtoUSTA CRM</div>
          <div className="bot-topbar-subtitle">Boshqaruv ko'rinishi</div>
        </div>
        <div className="bot-topbar-actions">
          <button className="icon-round-btn" onClick={() => refetch()} title="Yangilash">
            <RefreshIcon />
          </button>
        </div>
      </div>

      <div className="dashboard-user-row">
        <div>
          <div className="dashboard-user-name">{userName}</div>
          <div className="dashboard-user-role">
            {isPlatformAdmin ? 'BOSHQARUV PANELI' : selectedOrganization?.name?.toUpperCase() || 'BOSHQARUV PANELI'}
          </div>
        </div>
        {isPlatformAdmin && activeSection === 'organizations' && (
          <div className="dashboard-user-actions">
            <button className="icon-round-btn" onClick={() => setActiveSection('summary')} title="Asosiy ko'rinish">
              H
            </button>
          </div>
        )}
      </div>

      {activeSection === 'summary' ? (
        <>
          <div className="kassa-card" id="summary">
            <div className="kassa-header">
              <div className="kassa-label">KUTILAYOTGAN TUSHUM</div>
              {canAccessExpenses(auth) && (
                <Link to="/expenses" className="kassa-action-btn">
                  + Chiqim
                </Link>
              )}
            </div>
            <div className="kassa-amount">{isLoading ? '-' : formatMoney(kutilayotganTushum)}</div>
            <div className="kassa-sub-grid">
              <div className="kassa-sub-item">
                <div className="kassa-sub-label">BUGUNGI TUSHUM</div>
                <div className={`kassa-sub-value ${todayTushum > 0 ? 'green' : ''}`}>
                  {isLoading ? '-' : formatMoney(todayTushum)}
                </div>
              </div>
              <div className="kassa-sub-item">
                <div className="kassa-sub-label">JAMI TUSHUM</div>
                <div className="kassa-sub-value">{isLoading ? '-' : formatMoney(jamiTushum)}</div>
              </div>
            </div>
          </div>

          <div className="stat-mini-grid">
            <div className="stat-mini-card">
              <div className="stat-mini-label">QABUL</div>
              <div className="stat-mini-value">{isLoading ? '-' : qabulCount}</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-label">TOPSHIRILDI</div>
              <div className="stat-mini-value green">{isLoading ? '-' : topshirildiCount}</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-label">JAMI XIZMAT</div>
              <div className="stat-mini-value accent sm">{isLoading ? '-' : formatMoney(summary?.finance.grandTotal ?? 0)}</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-label">TO'LANGAN</div>
              <div className="stat-mini-value accent sm">{isLoading ? '-' : formatMoney(summary?.finance.paidTotal ?? 0)}</div>
            </div>
          </div>

          <div className="section-hdr">
            <div className="section-hdr-title">
              JARAYONDAGI ISHLAR
              {activeCount > 0 && <span className="section-hdr-badge">{activeCount}</span>}
            </div>
            <Link to="/orders#workflow" className="section-hdr-action">BARCHASI &gt;</Link>
          </div>

          {activeCount === 0 && (
            <div className="empty-state dashboard-empty-inline">
              <div className="dashboard-empty-copy">Faol zakaz yo'q</div>
            </div>
          )}

          {activeCount > 0 && (
            <div className="dashboard-active-wrap">
              <Link to="/orders#workflow" className="person-item dashboard-active-card">
                <div className="person-avatar dashboard-active-avatar">#</div>
                <div className="person-info">
                  <div className="person-name">{selectedOrganization?.name || 'Zakazlar'}</div>
                  <div className="person-sub">{selectedBranchName || 'Barcha filiallar'}</div>
                </div>
                <div className="person-amount">
                  <div className="person-debt-amount dashboard-active-count">{activeCount} ta</div>
                  <div className="person-debt-label">FAOL</div>
                </div>
              </Link>
            </div>
          )}
        </>
      ) : activeSection === 'debtors' ? (
        canAccessPayments(auth) ? (
          <>
            <div className="section-hdr" id="debtors">
              <div className="section-hdr-title">TOP QARZDORLAR</div>
              <Link to="/payments#debtors" className="section-hdr-action">BARCHASI &gt;</Link>
            </div>

            {topDebtors.length === 0 && (
              <div className="empty-state dashboard-empty-compact">
                <div className="dashboard-empty-copy">Qarzdor yo'q</div>
              </div>
            )}

            {topDebtors.slice(0, 3).map((item) => (
              <Link to={`/orders/${item.id}`} className="person-item" key={item.id}>
                <div className="person-avatar">{item.clientName.charAt(0).toUpperCase()}</div>
                <div className="person-info">
                  <div className="person-name">{item.clientName}</div>
                  <div className="person-sub">
                    {item.orderNumber} | {item.assetName} | {getOrderStatusLabel(item.status)}
                  </div>
                </div>
                <div className="person-amount">
                  <div className="person-debt-amount">{formatMoney(item.balanceDueAmount)}</div>
                  <div className="debtor-paid-text">{formatMoney(item.paidTotalAmount)} to'langan</div>
                </div>
              </Link>
            ))}
          </>
        ) : (
          <div className="empty-state dashboard-empty-compact">
            <div className="dashboard-empty-copy">Qarzdorlarni ko'rish uchun ruxsat yo'q</div>
          </div>
        )
      ) : activeSection === 'actions' ? (
        <>
          <div className="section-hdr dashboard-section-gap" id="actions">
            <div className="section-hdr-title">TEZKOR HARAKATLAR</div>
          </div>

          <div className="dashboard-quick-actions">
            <DashboardActionCard to="/orders#incoming" label="Zakazlar ro'yxati" />
            <DashboardActionCard to="/reports#summary" label="Hisobotlar" />
            {canAccessPayments(auth) && <DashboardActionCard to="/payments#debtors" label="To'lovlar va qarzlar" />}
            {canAccessInventory(auth) && <DashboardActionCard to="/inventory#summary" label="Sklad" />}
          </div>
        </>
      ) : isPlatformAdmin ? (
        <div className="dashboard-admin-wrap" id="organizations">
          <div className="panel dashboard-panel-stack">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Yangi firma</p>
                <h3>Firma yaratish</h3>
              </div>
            </div>
            <form className="workspace-form-stack" onSubmit={handleCreateOrganization}>
              <label className="field">
                <span>Nomi</span>
                <input
                  value={orgForm.name}
                  onChange={(e) => setOrgForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Masalan: Cariva Sergeli"
                  required
                />
              </label>
              <label className="field">
                <span>Biznes turi</span>
                <select value={orgForm.businessTypeCode} onChange={(e) => setOrgForm((c) => ({ ...c, businessTypeCode: e.target.value }))}>
                  {businessTypeOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <button className="primary-btn" disabled={createOrg.isPending}>
                {createOrg.isPending ? 'Saqlanmoqda...' : 'Firma yaratish'}
              </button>
            </form>
          </div>

          {organizations.map((item) => (
            <div key={item.id} className="organization-card dashboard-panel-stack">
              <div>
                <strong>{item.name}</strong>
                <p>{getBusinessTypeLabel(item.businessTypeCode)} | {item.currencyCode}</p>
              </div>
              <div className="dashboard-chip-row">
                {item.branches.map((branch) => (
                  <span key={branch.id} className="branch-chip">{branch.name}</span>
                ))}
                {!item.branches.length && <span className="branch-chip">Filial yo'q</span>}
              </div>
              <button
                className="inline-btn"
                onClick={() => {
                  setOrganizationId(item.id)
                  setBranchId('')
                }}
              >
                Tanlash
              </button>
            </div>
          ))}

          {selectedOrganization && (
            <div className="panel dashboard-panel-stack">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Filial qo'shish</p>
                  <h3>{selectedOrganization.name}</h3>
                </div>
              </div>
              <form className="workspace-form-stack" onSubmit={handleCreateBranch}>
                <label className="field">
                  <span>Filial nomi</span>
                  <input value={branchForm.name} onChange={(e) => setBranchForm((c) => ({ ...c, name: e.target.value }))} required />
                </label>
                <label className="field">
                  <span>Kod</span>
                  <input value={branchForm.code} onChange={(e) => setBranchForm((c) => ({ ...c, code: e.target.value }))} />
                </label>
                <label className="field">
                  <span>Telefon</span>
                  <input value={branchForm.phone} onChange={(e) => setBranchForm((c) => ({ ...c, phone: e.target.value }))} />
                </label>
                <button className="primary-btn" disabled={createBranch.isPending}>
                  {createBranch.isPending ? 'Saqlanmoqda...' : "Filial qo'shish"}
                </button>
              </form>
            </div>
          )}

          <div className="panel dashboard-panel-stack">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Yangi xodim</p>
                <h3>Xodim yaratish</h3>
              </div>
            </div>
            <form className="workspace-form-stack" onSubmit={handleCreateStaff}>
              <label className="field">
                <span>To'liq ismi</span>
                <input value={staffForm.fullName} onChange={(e) => setStaffForm((c) => ({ ...c, fullName: e.target.value }))} required />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={staffForm.email} onChange={(e) => setStaffForm((c) => ({ ...c, email: e.target.value }))} required />
              </label>
              <label className="field">
                <span>Telefon</span>
                <input value={staffForm.phone} onChange={(e) => setStaffForm((c) => ({ ...c, phone: e.target.value }))} placeholder="+998..." />
              </label>
              <label className="field">
                <span>Parol</span>
                <input type="password" value={staffForm.password} onChange={(e) => setStaffForm((c) => ({ ...c, password: e.target.value }))} required />
              </label>
              <label className="field">
                <span>Rol</span>
                <select value={staffForm.primaryRole} onChange={(e) => setStaffForm((c) => ({ ...c, primaryRole: e.target.value }))}>
                  {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <button className="primary-btn" disabled={!organizationId || createStaff.isPending}>
                {createStaff.isPending ? 'Saqlanmoqda...' : 'Xodim yaratish'}
              </button>
            </form>
          </div>

          {staff.map((member) => (
            <div key={member.id} className="team-card dashboard-panel-stack">
              <div>
                <strong className="dashboard-team-name">{member.fullName}</strong>
                <div className="team-meta dashboard-team-meta">
                  <span className="branch-chip">{member.primaryRole}</span>
                  <span className="branch-chip">{member.user.email}</span>
                </div>
              </div>
            </div>
          ))}

          {!staff.length && (
            <p className="workspace-muted dashboard-empty-text">
              {organizationId ? "Xodim yo'q" : 'Avval firma tanlang'}
            </p>
          )}
        </div>
      ) : null}

      <div className="bot-footer-tag">@carService_Crm_bot</div>
    </WorkspaceLayout>
  )
}

export default DashboardPage
