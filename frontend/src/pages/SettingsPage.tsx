import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { canManagePlatform, hasPermission } from '../auth/access'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { useExpenseCategories, useCreateExpenseCategory } from '../hooks/useExpenses'
import {
  useCreateBranch,
  useCreateOrganization,
  useOrganizations,
} from '../hooks/useOrganizations'
import { usePaymentMethods } from '../hooks/usePayments'
import {
  useCreateRole,
  usePermissions,
  useRoles,
  useUpdateRole,
  useDeleteRole
} from '../hooks/useRoles'
import { useToast } from '../hooks/useToast'
import { useWorkspaceSection } from '../hooks/useWorkspaceSection'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { PERMISSION_CATEGORY_LABELS, formatPermissionLabel, groupPermissionsByCategory } from '../lib/permissions'

const BUSINESS_TYPES = [
  { value: 'auto_service', label: 'Avto servis' },
  { value: 'body_shop', label: 'Kuzov va bo\'yoq' },
  { value: 'detailing', label: 'Detailing' },
]

const SALES_MANAGER_PERMISSIONS = [
  'order.create',
  'order.read',
  'order.update',
  'order.approve',
  'inventory.read',
  'payment.create',
  'payment.read',
  'task.update',
]

const SETTINGS_SECTIONS = ['summary', 'organization', 'branches', 'catalogs', 'billing'] as const

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function SettingsPage() {
  const { auth } = useAuth()
  const token = auth?.accessToken ?? ''
  const { toast } = useToast()
  const { organizationId, setOrganizationId } = useWorkspaceSelection()
  const canCreateOrg = canManagePlatform(auth)
  const canCreateBranch = hasPermission(auth, 'system.settings')
  const canReadPaymentMethods =
    hasPermission(auth, 'payment.read') ||
    hasPermission(auth, 'payment.create') ||
    hasPermission(auth, 'system.settings')
  const canReadExpenseCategories =
    hasPermission(auth, 'expense.create') ||
    hasPermission(auth, 'system.settings')
  const canCreateCategory = hasPermission(auth, 'expense.create')
  const canManageRoles = hasPermission(auth, 'system.settings') || canManagePlatform(auth)

  const [orgForm, setOrgForm] = useState({
    name: '',
    businessTypeCode: 'auto_service',
  })
  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    phone: '',
    addressLine: '',
  })
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
  })
  const [roleForm, setRoleForm] = useState({
    name: '',
    code: '',
    permissionIds: [] as string[],
  })
  const [editingRoleId, setEditingRoleId] = useState('')

  const { data: organizations = [], refetch } = useOrganizations(token)
  const { data: paymentMethods = [] } = usePaymentMethods(
    token,
    organizationId,
    !!organizationId && canReadPaymentMethods,
  )
  const { data: expenseCategories = [] } = useExpenseCategories(
    token,
    organizationId,
    !!organizationId && canReadExpenseCategories,
  )
  const createOrganization = useCreateOrganization(token)
  const createBranch = useCreateBranch(token)
  const createExpenseCategory = useCreateExpenseCategory(token, organizationId)

  const { data: roles = [] } = useRoles(token, organizationId)
  const { data: allPermissions = [] } = usePermissions(token)
  const createRole = useCreateRole(token, organizationId)
  const updateRole = useUpdateRole(token, organizationId)
  useDeleteRole(token, organizationId)

  const selectedOrganization = useMemo(
    () => organizations.find((item) => item.id === organizationId) ?? null,
    [organizationId, organizations],
  )
  const groupedPermissions = useMemo(
    () => groupPermissionsByCategory(allPermissions),
    [allPermissions],
  )
  const { activeSection } = useWorkspaceSection(SETTINGS_SECTIONS, 'summary')

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!orgForm.name.trim()) {
      toast('Firma nomini kiriting.', 'error')
      return
    }

    try {
      const created = await createOrganization.mutateAsync({
        name: orgForm.name.trim(),
        businessTypeCode: orgForm.businessTypeCode,
        timezone: 'Asia/Tashkent',
        currencyCode: 'UZS',
      })
      setOrganizationId(created.id)
      setOrgForm({ name: '', businessTypeCode: 'auto_service' })
      toast('Firma yaratildi.', 'success')
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
      await createBranch.mutateAsync({
        organizationId,
        name: branchForm.name.trim(),
        code: branchForm.code || undefined,
        phone: branchForm.phone || undefined,
        addressLine: branchForm.addressLine || undefined,
      })
      setBranchForm({ name: '', code: '', phone: '', addressLine: '' })
      toast("Filial qo'shildi.", 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : "Filial qo'shilmadi.", 'error')
    }
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId) {
      toast('Avval firma tanlang.', 'error')
      return
    }
    if (!categoryForm.name.trim()) {
      toast('Kategoriya nomini kiriting.', 'error')
      return
    }

    try {
      await createExpenseCategory.mutateAsync({
        organizationId,
        name: categoryForm.name.trim(),
        code: categoryForm.code || undefined,
      })
      setCategoryForm({ name: '', code: '' })
      toast('Expense kategoriya qo\'shildi.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kategoriya qo\'shilmadi.', 'error')
    }
  }

  async function handleCreateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId) {
      toast('Avval firma tanlang.', 'error')
      return
    }
    if (!roleForm.name.trim() || !roleForm.code.trim()) {
      toast('Rol nomi va kodini kiriting.', 'error')
      return
    }

    try {
      if (editingRoleId) {
        await updateRole.mutateAsync({
          id: editingRoleId,
          payload: {
            organizationId,
            name: roleForm.name.trim(),
            code: roleForm.code.trim(),
            permissionIds: roleForm.permissionIds,
          },
        })
      } else {
        await createRole.mutateAsync({
          organizationId,
          name: roleForm.name.trim(),
          code: roleForm.code.trim(),
          permissionIds: roleForm.permissionIds,
          isSystemRole: false,
        })
      }

      setEditingRoleId('')
      setRoleForm({ name: '', code: '', permissionIds: [] })
      toast(
        editingRoleId
          ? "Rol ruxsatlari yangilandi."
          : "Rol muvaffaqiyatli qo'shildi.",
        'success',
      )
    } catch (err) {
      toast(
        err instanceof Error
          ? err.message
          : editingRoleId
            ? "Rol yangilanmadi."
            : "Rol qo'shilmadi.",
        'error',
      )
    }
  }

  async function handleCreateSalesManager() {
    if (!organizationId) {
      toast('Avval firma tanlang.', 'error')
      return
    }
    const salesPermissions = allPermissions.filter((p) =>
      SALES_MANAGER_PERMISSIONS.includes(p.code)
    )

    try {
      await createRole.mutateAsync({
        organizationId,
        name: 'Sotuv Menejeri',
        code: 'sales_manager',
        description: 'Darhol sotuv va zakazlarni yurituvchi menejer roli',
        permissionIds: salesPermissions.map((p) => p.id),
        isSystemRole: false,
      })
      toast("Sotuv menejeri roli yaratildi.", 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : "Rol yaratishda xato.", 'error')
    }
  }

  function togglePermission(permissionId: string) {
    setRoleForm((prev) => {
      const exists = prev.permissionIds.includes(permissionId)
      if (exists) {
        return { ...prev, permissionIds: prev.permissionIds.filter((id) => id !== permissionId) }
      }
      return { ...prev, permissionIds: [...prev.permissionIds, permissionId] }
    })
  }

  function startRoleEdit(roleId: string) {
    const targetRole = roles.find((role) => role.id === roleId)
    if (!targetRole) {
      toast('Rol topilmadi.', 'error')
      return
    }

    setEditingRoleId(targetRole.id)
    setRoleForm({
      name: targetRole.name,
      code: targetRole.code,
      permissionIds: targetRole.rolePermissions?.map((item) => item.permissionId) ?? [],
    })
  }

  function resetRoleForm() {
    setEditingRoleId('')
    setRoleForm({
      name: '',
      code: '',
      permissionIds: [],
    })
  }

  return (
    <WorkspaceLayout>
      <div className="bot-topbar">
        <div className="bot-topbar-left">
          <div className="bot-topbar-title">Sozlamalar</div>
          <div className="orders-topbar-note">Firma, filial va katalog boshqaruvi</div>
        </div>
        <div className="bot-topbar-actions">
          <button className="icon-round-btn" onClick={() => refetch()} title="Yangilash">
            <RefreshIcon />
          </button>
        </div>
      </div>

      {activeSection === 'summary' ? (
        <div className="workspace-summary-grid settings-summary-grid" id="summary">
          <article className="workspace-summary-card">
            <span>Firmalar</span>
            <strong>{organizations.length}</strong>
            <p>Siz ko'ra oladigan barcha firmalar</p>
          </article>
          <article className="workspace-summary-card">
            <span>Filiallar</span>
            <strong>{selectedOrganization?.branches.length ?? 0}</strong>
            <p>Tanlangan firma ichidagi filiallar</p>
          </article>
          <article className="workspace-summary-card">
            <span>Payment methods</span>
            <strong>{paymentMethods.length}</strong>
            <p>To'lov qabul qilish usullari</p>
          </article>
          <article className="workspace-summary-card">
            <span>Expense categories</span>
            <strong>{expenseCategories.length}</strong>
            <p>Chiqimlar uchun katalog bo'limlari</p>
          </article>
        </div>
      ) : activeSection === 'organization' ? (
        <div className="settings-layout">
          <section className="panel settings-panel" id="organization">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Tanlangan firma</p>
                <h3>{selectedOrganization?.name ?? 'Firma tanlanmagan'}</h3>
              </div>
            </div>
            {selectedOrganization ? (
              <div className="settings-stack">
                <div className="settings-meta-grid">
                  <div><span>Biznes turi</span><strong>{selectedOrganization.businessTypeCode}</strong></div>
                  <div><span>Valyuta</span><strong>{selectedOrganization.currencyCode}</strong></div>
                  <div><span>Timezone</span><strong>{selectedOrganization.timezone}</strong></div>
                  <div><span>Holat</span><strong>{selectedOrganization.isActive ? 'Faol' : 'Nofaol'}</strong></div>
                </div>
                <div className="settings-inline-actions">
                  <Link className="ghost-btn" to="/staff">Jamoani boshqarish</Link>
                  <Link className="ghost-btn" to="/reports">Hisobotlarni ko'rish</Link>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">#</div>
                <strong>Firma tanlanmagan</strong>
                <p>Headerdagi workspace filter orqali firma tanlang.</p>
              </div>
            )}
          </section>

          {canCreateOrg && (
            <section className="panel settings-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Platform</p>
                  <h3>Yangi firma yaratish</h3>
                </div>
              </div>
              <form className="workspace-form-stack" onSubmit={handleCreateOrganization}>
                <label className="field">
                  <span>Firma nomi</span>
                  <input value={orgForm.name} onChange={(event) => setOrgForm((current) => ({ ...current, name: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>Biznes turi</span>
                  <select value={orgForm.businessTypeCode} onChange={(event) => setOrgForm((current) => ({ ...current, businessTypeCode: event.target.value }))}>
                    {BUSINESS_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <button className="primary-btn" disabled={createOrganization.isPending}>
                  {createOrganization.isPending ? 'Saqlanmoqda...' : 'Firma yaratish'}
                </button>
              </form>
            </section>
          )}
        </div>
      ) : activeSection === 'branches' ? (
        <div className="settings-layout">
          <section className="panel settings-panel" id="branches">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Filiallar</p>
                <h3>Filial va aloqa ma'lumotlari</h3>
              </div>
            </div>
            <div className="settings-card-list">
              {selectedOrganization?.branches.length ? (
                selectedOrganization.branches.map((branch) => (
                  <article key={branch.id} className="settings-card-item">
                    <strong>{branch.name}</strong>
                    <p>{branch.addressLine || 'Manzil kiritilmagan'}</p>
                    <div className="settings-card-tags">
                      <span>{branch.code || 'Kod yo\'q'}</span>
                      <span>{branch.phone || 'Telefon yo\'q'}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">#</div>
                  <strong>Filial yo'q</strong>
                  <p>Tanlangan firma uchun hali filial ochilmagan.</p>
                </div>
              )}
            </div>
          </section>

          {canCreateBranch && (
            <section className="panel settings-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Yangi filial</p>
                  <h3>Filial qo'shish</h3>
                </div>
              </div>
              <form className="workspace-form-stack" onSubmit={handleCreateBranch}>
                <label className="field">
                  <span>Filial nomi</span>
                  <input value={branchForm.name} onChange={(event) => setBranchForm((current) => ({ ...current, name: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>Kod</span>
                  <input value={branchForm.code} onChange={(event) => setBranchForm((current) => ({ ...current, code: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Telefon</span>
                  <input value={branchForm.phone} onChange={(event) => setBranchForm((current) => ({ ...current, phone: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Manzil</span>
                  <input value={branchForm.addressLine} onChange={(event) => setBranchForm((current) => ({ ...current, addressLine: event.target.value }))} />
                </label>
                <button className="primary-btn" disabled={!organizationId || createBranch.isPending}>
                  {createBranch.isPending ? 'Saqlanmoqda...' : "Filial qo'shish"}
                </button>
              </form>
            </section>
          )}
        </div>
      ) : activeSection === 'catalogs' ? (
        <div className="settings-layout">
          <section className="panel settings-panel" id="catalogs">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Expense category</p>
                <h3>Chiqim katalogi</h3>
              </div>
            </div>
            <div className="settings-card-list">
              {!canReadExpenseCategories ? (
                <div className="empty-state">
                  <div className="empty-state-icon">#</div>
                  <strong>Ruxsat yo'q</strong>
                  <p>Chiqim katalogini ko'rish uchun `expense.create` ruxsati kerak.</p>
                </div>
              ) : expenseCategories.length ? (
                expenseCategories.map((category) => (
                  <article key={category.id} className="settings-card-item">
                    <strong>{category.name}</strong>
                    <p>{category.code || 'Kod kiritilmagan'}</p>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">#</div>
                  <strong>Kategoriya topilmadi</strong>
                  <p>Chiqimlar uchun kategoriya hali yaratilmagan.</p>
                </div>
              )}
            </div>

            {canCreateCategory && (
              <form className="workspace-form-stack settings-form-top" onSubmit={handleCreateCategory}>
                <label className="field">
                  <span>Nomi</span>
                  <input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>Kod</span>
                  <input value={categoryForm.code} onChange={(event) => setCategoryForm((current) => ({ ...current, code: event.target.value }))} />
                </label>
                <button className="primary-btn" disabled={!organizationId || createExpenseCategory.isPending}>
                  {createExpenseCategory.isPending ? 'Saqlanmoqda...' : "Kategoriya qo'shish"}
                </button>
              </form>
            )}
          </section>

          {canManageRoles && (
            <section className="panel settings-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Rollar</p>
                  <h3>Ruxsatlar va Rollar</h3>
                </div>
                <button className="ghost-btn" onClick={handleCreateSalesManager}>+ Sotuv Menejeri</button>
              </div>

              <div className="settings-card-list">
                {roles.length ? (
                  roles.map((role) => (
                    <article key={role.id} className="settings-card-item">
                      <strong>{role.name}</strong>
                      <div className="settings-card-tags">
                        <span>{role.code}</span>
                        {role.isSystemRole && <span>System</span>}
                        <span>{role.rolePermissions?.length ?? 0} ruxsat</span>
                      </div>
                      <div className="settings-inline-actions" style={{ marginTop: '0.75rem' }}>
                        <button type="button" className="ghost-btn" onClick={() => startRoleEdit(role.id)}>
                          Tahrirlash
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">#</div>
                    <strong>Hech qanday rol topilmadi</strong>
                  </div>
                )}
              </div>

              <form className="workspace-form-stack settings-form-top" onSubmit={handleCreateRole}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    {editingRoleId ? 'Rolni tahrirlash' : 'Yangi rol yaratish'}
                  </h4>
                  {editingRoleId ? (
                    <button type="button" className="ghost-btn" onClick={resetRoleForm}>
                      Bekor qilish
                    </button>
                  ) : null}
                </div>

                <div className="workspace-summary-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1rem' }}>
                  <label className="field">
                    <span>Rol nomi</span>
                    <input value={roleForm.name} onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} required placeholder="Masalan: Kichik usta" />
                  </label>
                  <label className="field">
                    <span>Kod</span>
                    <input value={roleForm.code} onChange={(event) => setRoleForm((current) => ({ ...current, code: event.target.value }))} required placeholder="junior_worker" />
                  </label>
                </div>

                <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Ruxsatlarni tanlang:</strong>
                <div style={{ display: 'grid', gap: '0.85rem', marginBottom: '1rem' }}>
                  {Object.entries(groupedPermissions).map(([category, permissions]) => (
                    <section key={category} className="role-permission-editor__group">
                      <span className="role-permission-group__title">
                        {PERMISSION_CATEGORY_LABELS[category] ?? category}
                      </span>
                      <div className="role-permission-editor__options">
                        {permissions.map((permission) => (
                          <label key={permission.id} className="role-permission-editor__option">
                            <input
                              type="checkbox"
                              checked={roleForm.permissionIds.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
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

                <button className="primary-btn" disabled={!organizationId || createRole.isPending || updateRole.isPending}>
                  {createRole.isPending || updateRole.isPending
                    ? 'Saqlanmoqda...'
                    : editingRoleId
                      ? 'Rolni yangilash'
                      : 'Rol yaratish'}
                </button>
              </form>
            </section>
          )}
        </div>
      ) : (
        <div className="settings-layout">
          <section className="panel settings-panel" id="billing">
            <div className="panel-head">
              <div>
                <p className="eyebrow">To'lov usullari</p>
                <h3>Payment method katalogi</h3>
              </div>
            </div>
            <div className="settings-card-list">
              {!canReadPaymentMethods ? (
                <div className="empty-state">
                  <div className="empty-state-icon">#</div>
                  <strong>Ruxsat yo'q</strong>
                  <p>To'lov usullarini ko'rish uchun `payment.read` yoki `payment.create` kerak.</p>
                </div>
              ) : paymentMethods.length ? (
                paymentMethods.map((method) => (
                  <article key={method.id} className="settings-card-item">
                    <strong>{method.paymentMethodCode}</strong>
                    <p>{method.isActive ? 'Faol usul' : 'Nofaol usul'}</p>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">#</div>
                  <strong>Payment method topilmadi</strong>
                  <p>Bu firma uchun to'lov usullari hali ko'rinmadi.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </WorkspaceLayout>
  )
}

export default SettingsPage

