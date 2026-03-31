import { useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import PageHeader from './PageHeader'
import {
  canAccessClients,
  canAccessDashboard,
  canAccessNotifications,
  canAccessExpenses,
  canAccessInventory,
  canAccessMyTasks,
  canAccessOrders,
  canAccessPayments,
  canAccessReception,
  canAccessSettings,
  canAccessStaff,
  canManagePlatform,
  getPrimaryAccessLabel,
  hasPermission,
} from '../auth/access'

type WorkspaceLayoutProps = {
  children: ReactNode
}

type NavTone = 'home' | 'reception' | 'orders' | 'my-tasks' | 'notifications' | 'payments' | 'inventory' | 'clients' | 'staff' | 'approvals' | 'reports' | 'settings' | 'admin'

type NavItem = {
  to: string
  label: string
  shortLabel: string
  icon: ReactNode
  tone: NavTone
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}

type ContextNavItem = {
  to: string
  label: string
}

type PageMeta = {
  title: string
  subtitle: string
}

function requiresScopedBranch(pathname: string, hash: string) {
  const section = hash.replace('#', '')

  return (
    (pathname === '/orders' && section === 'create') ||
    (pathname === '/reception' && section === 'create') ||
    (pathname === '/inventory' && section === 'movements')
  )
}

function getWorkspacePageMeta(pathname: string): PageMeta {
  if (pathname.startsWith('/orders/')) {
    return {
      title: 'Zakaz tafsiloti',
      subtitle: "Holat, smeta va topshirish bosqichlari bir joyda boshqariladi.",
    }
  }

  if (pathname.startsWith('/staff/')) {
    return {
      title: 'Xodim profili',
      subtitle: "Rol, samaradorlik va faoliyat tafsilotlari ko'rinadi.",
    }
  }

  const pageMetaMap: Record<string, PageMeta> = {
    '/dashboard': {
      title: 'Boshqaruv paneli',
      subtitle: "Kunlik ko'rsatkichlar, tushum va operatsion signal markazi.",
    },
    '/reception': {
      title: 'Qabul',
      subtitle: 'Yangi mijoz, intake va navbat oqimini tez boshqarish uchun ish maydoni.',
    },
    '/orders': {
      title: 'Zakazlar',
      subtitle: 'Qabul qilingan, jarayondagi va tugallangan ishlar nazorati.',
    },
    '/my-tasks': {
      title: 'Mening ishlarim',
      subtitle: "Sizga biriktirilgan vazifalar va bajarilgan ishlar ko'rinadi.",
    },
    '/notifications': {
      title: 'Bildirishnomalar',
      subtitle: "Muhim ogohlantirishlar, qarzdorlik va jarayon signallari shu yerda.",
    },
    '/payments': {
      title: "To'lovlar",
      subtitle: "Qarzlar, tushum va chiqimlar oqimini yagona ko'rinishda kuzating.",
    },
    '/inventory': {
      title: 'Sklad',
      subtitle: "Mahsulotlar qoldig'i, harakati va sarf nazorati shu yerda.",
    },
    '/clients': {
      title: 'Mijozlar',
      subtitle: "Mijoz bazasi, servis tarixi va aktivlari bo'yicha tezkor ko'rinish.",
    },
    '/staff': {
      title: 'Xodimlar',
      subtitle: "Jamoa, rollar va ruxsatlarni boshqarish uchun asosiy bo'lim.",
    },
    '/settings': {
      title: 'Sozlamalar',
      subtitle: 'Firma, filial, katalog va billing sozlamalarini shu yerda yuriting.',
    },
    '/approvals': {
      title: 'Tasdiqlar',
      subtitle: 'Qaror kutayotgan ishlar va approval jarayonlarini boshqaring.',
    },
    '/reports': {
      title: 'Hisobotlar',
      subtitle: 'KPI, moliya va jamoa samaradorligini tahlil qilish oynasi.',
    },
  }

  return pageMetaMap[pathname] ?? {
    title: 'Ish maydoni',
    subtitle: 'Servis operatsiyalarini boshqarish uchun asosiy panel.',
  }
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function ReceptionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h3l2 2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M12 11v6" />
      <path d="M9 14h6" />
    </svg>
  )
}

function PayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </svg>
  )
}

function ClientsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function ApprovalsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function SettingsPanelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function ExitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    organizationId,
    branchId,
    organizations,
    selectedOrganization,
    availableBranches,
    isOrganizationLocked,
    isOrganizationsLoading,
    setOrganizationId,
    setBranchId,
  } = useWorkspaceSelection()
  const isPlatformAdmin = canManagePlatform(auth)
  const canCreateOrder = hasPermission(auth, 'order.create')
  const accessLabel = getPrimaryAccessLabel(auth)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const workspaceLabel =
    auth?.me?.staffMember?.fullName ??
    auth?.me?.staffMembers[0]?.fullName ??
    auth?.me?.platformAdmin?.fullName ??
    auth?.me?.fullName ??
    auth?.session.loginIdentifier ??
    auth?.session.email ??
    'Ishchi panel'
  const userEmail =
    auth?.session.email ??
    auth?.session.loginIdentifier ??
    auth?.me?.platformAdmin?.email ??
    ''
  const userInitials = useMemo(() => {
    const source = workspaceLabel.trim()
    if (!source) return 'A'
    const parts = source.split(/\s+/).filter(Boolean)
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'A'
  }, [workspaceLabel])
  const pageMeta = useMemo(() => getWorkspacePageMeta(location.pathname), [location.pathname])
  const requiresBranchScope = useMemo(
    () => requiresScopedBranch(location.pathname, location.hash),
    [location.hash, location.pathname],
  )
  const branchSelectLabel = requiresBranchScope ? 'Filial tanlang' : 'Barcha filiallar'
  const organizationLabel =
    selectedOrganization?.name ??
    auth?.me?.organization?.name ??
    'Firma tanlanmagan'
  const organizationHint = isOrganizationLocked
    ? 'Bu akkaunt uchun biriktirilgan firma'
    : organizations.length > 0
      ? `${organizations.length} ta firma mavjud`
      : "Firma yo'q"
  const selectedBranchName =
    availableBranches.find((branch) => branch.id === branchId)?.name ?? ''
  const branchHint = !organizationId
    ? 'Avval firma tanlang'
    : availableBranches.length > 1
      ? `${availableBranches.length} ta filial orasidan tanlang`
      : availableBranches.length === 1
        ? 'Bitta filial mavjud'
        : "Filial yo'q"

  function handleLogout() {
    setIsAccountMenuOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  const navItems: NavItem[] = [
    ...(canAccessDashboard(auth)
      ? [{ to: '/dashboard', label: "Boshqaruv paneli va ko'rsatkichlar", shortLabel: 'Bosh', icon: <HomeIcon />, tone: 'home' as NavTone }]
      : []),
    ...(canAccessReception(auth)
      ? [{ to: '/reception', label: "Yangi mijoz va qabul oqimi", shortLabel: 'Qabul', icon: <ReceptionIcon />, tone: 'reception' as NavTone }]
      : []),
    ...(canAccessOrders(auth)
      ? [{ to: '/orders', label: 'Zakazlar va ish jarayoni', shortLabel: 'Ishlar', icon: <OrdersIcon />, tone: 'orders' as NavTone }]
      : []),
    ...(canAccessMyTasks(auth)
      ? [{ to: '/my-tasks', label: 'Menga biriktirilgan ishlar', shortLabel: 'Ishlarim', icon: <ApprovalsIcon />, tone: 'my-tasks' as NavTone }]
      : []),
    ...(canAccessNotifications(auth)
      ? [{ to: '/notifications', label: 'Muhim signallar va ogohlantirishlar', shortLabel: 'Signal', icon: <BellIcon />, tone: 'notifications' as NavTone }]
      : []),
    ...((canAccessPayments(auth) || canAccessExpenses(auth))
      ? [{ to: '/payments', label: "To'lovlar, qarzlar va chiqimlar", shortLabel: "To'lov", icon: <PayIcon />, tone: 'payments' as NavTone }]
      : []),
    ...(canAccessInventory(auth)
      ? [{ to: '/inventory', label: 'Sklad va qoldiq nazorati', shortLabel: 'Sklad', icon: <SettingsIcon />, tone: 'inventory' as NavTone }]
      : []),
    ...(canAccessClients(auth)
      ? [{ to: '/clients', label: 'Mijozlar va servis tarixi', shortLabel: 'Mijozlar', icon: <ClientsIcon />, tone: 'clients' as NavTone }]
      : []),
    ...(canAccessStaff(auth)
      ? [{ to: '/staff', label: 'Xodimlar, rollar va jamoa', shortLabel: 'Xodimlar', icon: <TeamIcon />, tone: 'staff' as NavTone }]
      : []),
    ...(canAccessSettings(auth)
      ? [{ to: '/settings', label: 'Firma, filial va katalog boshqaruvi', shortLabel: 'Sozlamalar', icon: <SettingsPanelIcon />, tone: 'settings' as NavTone }]
      : []),
    ...(canAccessOrders(auth)
      ? [{ to: '/approvals', label: 'Tasdiqlar va qarorlar markazi', shortLabel: 'Tasdiqlar', icon: <ApprovalsIcon />, tone: 'approvals' as NavTone }]
      : []),
    ...(canAccessDashboard(auth)
      ? [{ to: '/reports', label: 'Tahlil, KPI va hisobotlar', shortLabel: 'Hisobotlar', icon: <ReportsIcon />, tone: 'reports' as NavTone }]
      : []),
    ...(isPlatformAdmin
      ? [{
          to: '/dashboard',
          label: 'Firma va admin boshqaruvi',
          shortLabel: 'Admin',
          icon: <AdminIcon />,
          tone: 'admin' as NavTone,
          onClick: (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault()
            navigate('/dashboard#organizations')
          },
        }]
      : []),
  ]

  const contextNavItems = useMemo(() => {
    if (location.pathname === '/dashboard') {
      return [
        { to: '/dashboard#summary', label: 'Bugungi holat' },
        { to: '/dashboard#debtors', label: 'Qarzdorlar' },
        { to: '/dashboard#actions', label: 'Tezkor amallar' },
        ...(isPlatformAdmin ? [{ to: '/dashboard#organizations', label: 'Tashkilotlar' }] : []),
      ] satisfies ContextNavItem[]
    }

    if (location.pathname === '/orders') {
      return [
        { to: '/orders#create', label: 'Yangi qabul' },
        { to: '/orders#incoming', label: 'Qabul qilinganlar' },
        { to: '/orders#workflow', label: 'Jarayondagi ishlar' },
        { to: '/orders#completed', label: 'Topshirilganlar' },
      ] satisfies ContextNavItem[]
    }

    if (location.pathname === '/reception') {
      return [
        { to: '/reception#summary', label: 'Bugungi holat' },
        { to: '/reception#create', label: 'Tezkor qabul' },
        { to: '/reception#today', label: 'Bugun kelganlar' },
        { to: '/reception#queue', label: 'Navbat' },
      ] satisfies ContextNavItem[]
    }

    if (location.pathname === '/payments') {
      return [
        { to: '/payments#debtors', label: 'Qarzdorlar' },
        { to: '/payments#expenses', label: 'Chiqimlar' },
      ] satisfies ContextNavItem[]
    }

    if (location.pathname === '/my-tasks') {
      return [
        { to: '/my-tasks#active-tasks', label: 'Faol ishlar' },
        { to: '/my-tasks#completed-tasks', label: 'Bajarilganlar' },
      ] satisfies ContextNavItem[]
    }

    if (location.pathname === '/notifications') {
      return [
        { to: '/notifications#summary', label: 'Umumiy holat' },
        { to: '/notifications#approvals', label: 'Tasdiqlar' },
        { to: '/notifications#debt', label: 'Qarzlar' },
        { to: '/notifications#work', label: 'Ish signallari' },
        { to: '/notifications#intake', label: 'Qabul nazorati' },
      ] satisfies ContextNavItem[]
    }

    if (location.pathname === '/inventory') {
      return [
        { to: '/inventory#summary', label: 'Umumiy holat' },
        { to: '/inventory#items', label: 'Mahsulotlar' },
        { to: '/inventory#movements', label: 'Harakatlar' },
      ] satisfies ContextNavItem[]
    }

    if (location.pathname === '/clients') {
      return [
        { to: '/clients#summary', label: 'Umumiy holat' },
        { to: '/clients#list', label: "Mijozlar ro'yxati" },
      ] satisfies ContextNavItem[]
    }

    if (location.pathname === '/staff') {
      return [
        { to: '/staff#summary', label: 'Role summary' },
        { to: '/staff#list', label: "Jamoa ro'yxati" },
        ...(hasPermission(auth, 'staff.manage') ? [{ to: '/staff#create', label: "Yangi xodim" }] : []),
      ] satisfies ContextNavItem[]
    }

    if (location.pathname === '/settings') {
      return [
        { to: '/settings#summary', label: 'Umumiy holat' },
        { to: '/settings#organization', label: 'Firma' },
        { to: '/settings#branches', label: 'Filiallar' },
        { to: '/settings#catalogs', label: 'Kataloglar' },
        { to: '/settings#billing', label: "To'lov usullari" },
      ] satisfies ContextNavItem[]
    }

    if (location.pathname === '/approvals') {
      return [
        { to: '/approvals#summary', label: 'Umumiy holat' },
        { to: '/approvals#list', label: 'Approval list' },
      ] satisfies ContextNavItem[]
    }

    if (location.pathname === '/reports') {
      return [
        { to: '/reports#summary', label: 'KPI' },
        { to: '/reports#finance', label: 'Moliya' },
        { to: '/reports#team', label: 'Jamoa load' },
        { to: '/reports#approvals', label: 'Tasdiqlar' },
      ] satisfies ContextNavItem[]
    }

    return [] satisfies ContextNavItem[]
  }, [auth, isPlatformAdmin, location.pathname])

  function isContextItemActive(item: ContextNavItem) {
    const [itemPath, itemHash = ''] = item.to.split('#')
    const currentHash = location.hash.replace('#', '')
    if (itemPath !== location.pathname) {
      return false
    }
    if (!itemHash) {
      return currentHash === ''
    }
    return currentHash === itemHash
  }

  return (
    <div className="shell app-shell">
      <aside className="sidebar-panel">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">A</div>
          <div className="sidebar-brand-copy">
            <strong>AvtoUSTA CRM</strong>
            <span>{workspaceLabel}</span>
          </div>
        </div>

        <div className="sidebar-section-label">Bo'limlar</div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={`${item.to}-${item.shortLabel}`}
              to={item.to}
              className={({ isActive }) => `sidebar-link sidebar-link-${item.tone}${isActive ? ' is-active' : ''}`}
              onClick={item.onClick}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-copy">
                <strong>{item.shortLabel}</strong>
                <small>{item.label}</small>
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content content-area">
        <header className="workspace-main-header">
          <PageHeader
            title={pageMeta.title}
            subtitle={pageMeta.subtitle}
            actions={(
              <>
                <div className="workspace-scope-inline">
                  <div className="workspace-scope-inline-label">Ish maydoni</div>
                  <div className="workspace-scope-inline-controls">
                    {isOrganizationLocked ? (
                      <div
                        className="workspace-scope-readonly workspace-scope-readonly--inline"
                        title={organizationHint}
                      >
                        <span>Firma</span>
                        <strong>{organizationLabel}</strong>
                      </div>
                    ) : (
                      <label
                        className="workspace-scope-field workspace-scope-field--inline"
                        title={organizationHint}
                      >
                        <span>Firma</span>
                        <select
                          value={organizationId}
                          onChange={(event) => setOrganizationId(event.target.value)}
                          disabled={isOrganizationsLoading || organizations.length === 0}
                        >
                          <option value="">
                            {organizations.length > 0 ? 'Firma tanlang' : "Firma yo'q"}
                          </option>
                          {organizations.map((organization) => (
                            <option key={organization.id} value={organization.id}>
                              {organization.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label
                      className="workspace-scope-field workspace-scope-field--inline"
                      title={selectedBranchName ? `${selectedBranchName} tanlangan` : branchHint}
                    >
                      <span>Filial</span>
                      <select
                        value={branchId}
                        onChange={(event) => setBranchId(event.target.value)}
                        disabled={!organizationId || availableBranches.length === 0}
                      >
                        <option value="">{branchSelectLabel}</option>
                        {availableBranches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {requiresBranchScope && !branchId ? (
                    <div className="workspace-scope-inline-hint">
                      Bu bo'lim uchun filial tanlang.
                    </div>
                  ) : null}
                </div>

                <div className="workspace-main-header-meta">
                  {canCreateOrder && (
                    <button
                      className="workspace-header-cta"
                      onClick={() => navigate('/orders#create')}
                      title="Yangi qabul"
                    >
                      <span>+</span>
                      <strong>Yangi qabul</strong>
                    </button>
                  )}

                  <div className={`workspace-account-bar workspace-account-bar--desktop${isAccountMenuOpen ? ' is-open' : ''}`}>
                    <button
                      className="workspace-account-trigger"
                      onClick={() => setIsAccountMenuOpen((current) => !current)}
                      title="Akkaunt menyusi"
                    >
                      <div className="workspace-account-avatar">{userInitials}</div>
                      <div className="workspace-account-copy">
                        <strong>{workspaceLabel}</strong>
                        <span>{accessLabel}</span>
                      </div>
                    </button>
                    {isAccountMenuOpen && (
                      <div className="workspace-account-menu">
                        <div className="workspace-account-menu-head">
                          <strong>{workspaceLabel}</strong>
                          <span>{accessLabel}</span>
                        </div>
                        <div className="workspace-account-menu-email">{userEmail}</div>
                        <button
                          className="workspace-account-menu-btn is-danger"
                          onClick={handleLogout}
                          title="Akkauntdan chiqish"
                        >
                          <ExitIcon />
                          Chiqish
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          />

          {contextNavItems.length > 0 && (
            <div className="workspace-section-nav workspace-section-nav--header">
              <div className="workspace-section-nav-label">Ichki bo'limlar</div>
              <div className="workspace-section-nav-row">
                {contextNavItems.map((item) => (
                  <Link
                    key={`${item.to}-${item.label}`}
                    to={item.to}
                    className={`workspace-section-chip${isContextItemActive(item) ? ' is-active' : ''}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </header>

        <div className={`workspace-account-bar${isAccountMenuOpen ? ' is-open' : ''}`}>
          <button
            className="workspace-account-trigger"
            onClick={() => setIsAccountMenuOpen((current) => !current)}
            title="Akkaunt menyusi"
          >
            <div className="workspace-account-avatar">{userInitials}</div>
            <div className="workspace-account-copy">
              <strong>{workspaceLabel}</strong>
              <span>{accessLabel}</span>
            </div>
          </button>
          {isAccountMenuOpen && (
            <div className="workspace-account-menu">
              <div className="workspace-account-menu-head">
                <strong>{workspaceLabel}</strong>
                <span>{accessLabel}</span>
              </div>
              <div className="workspace-account-menu-email">{userEmail}</div>
              <button
                className="workspace-account-menu-btn is-danger"
                onClick={handleLogout}
                title="Akkauntdan chiqish"
              >
                <ExitIcon />
                Chiqish
              </button>
            </div>
          )}
        </div>
        {contextNavItems.length > 0 && (
          <div className="workspace-section-nav">
            <div className="workspace-section-nav-label">Ichki bo'limlar</div>
            <div className="workspace-section-nav-row">
              {contextNavItems.map((item) => (
                <Link
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  className={`workspace-section-chip${isContextItemActive(item) ? ' is-active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
        {children}
      </main>

      <nav className="bottom-nav">
        {navItems.slice(0, 2).map((item) => (
          <NavLink
            key={`mobile-${item.to}-${item.shortLabel}`}
            to={item.to}
            className={({ isActive }) => `nav-tab${isActive ? ' is-active' : ''}`}
            onClick={item.onClick}
          >
            {item.icon}
            {item.shortLabel}
          </NavLink>
        ))}

        {canCreateOrder && (
          <button
            className="nav-fab"
            onClick={() => navigate('/orders#create')}
            title="Yangi qabul"
          >
            +
          </button>
        )}

        {navItems.slice(2).map((item) => (
          <NavLink
            key={`mobile-${item.to}-${item.shortLabel}`}
            to={item.to}
            className={({ isActive }) => `nav-tab${isActive ? ' is-active' : ''}`}
            onClick={item.onClick}
          >
            {item.icon}
            {item.shortLabel}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default WorkspaceLayout
