import { useMemo, useState, type FormEvent } from 'react'

import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/access'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { useWorkspaceSection } from '../hooks/useWorkspaceSection'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { useStaff } from '../hooks/useOrganizations'
import {
  useCreateInventoryItem,
  useCreateStockMovement,
  useInventoryItems,
  useInventoryStocks,
  useStockMovements,
} from '../hooks/useInventory'
import { useToast } from '../hooks/useToast'
import { formatMoneyUzs } from '../lib/format'
import { getInventoryItemTypeLabel, getStockMovementLabel } from '../lib/labels'

function num(value: string | number) {
  return Number(value)
}

const INVENTORY_SECTIONS = ['summary', 'items', 'movements'] as const

function InventoryPage() {
  const { auth } = useAuth()
  const token = auth?.accessToken ?? ''
  const canAdjustInventory = hasPermission(auth, 'inventory.adjust')
  const { toast } = useToast()
  const { organizationId, branchId, selectedOrganization } = useWorkspaceSelection()

  const [search, setSearch] = useState('')
  const [showMovementDetails, setShowMovementDetails] = useState(false)
  const [itemForm, setItemForm] = useState({
    name: '',
    sku: '',
    unitName: 'pcs',
    itemTypeCode: 'part',
    costPrice: '',
    salePrice: '',
  })
  const [movementForm, setMovementForm] = useState({
    inventoryItemId: '',
    createdByStaffId: '',
    movementType: 'purchase',
    quantity: '',
    unitCostAmount: '',
    note: '',
  })

  const { data: items = [] } = useInventoryItems(token, organizationId)
  const { data: stocks = [] } = useInventoryStocks(token, branchId)
  const { data: movements = [], isLoading } = useStockMovements(token, branchId)
  const { data: staff = [] } = useStaff(token, organizationId)

  const createItem = useCreateInventoryItem(token, organizationId)
  const createMovement = useCreateStockMovement(token, branchId)
  const currentStaffMember = useMemo(() => {
    return auth?.me?.staffMembers.find((member) => member.organizationId === organizationId) ?? null
  }, [auth?.me?.staffMembers, organizationId])
  const selectedBranchName =
    selectedOrganization?.branches.find((branch) => branch.id === branchId)?.name ?? ''
  const effectiveMovementItemId = movementForm.inventoryItemId || items[0]?.id || ''
  const effectiveMovementStaffId =
    movementForm.createdByStaffId || currentStaffMember?.id || staff[0]?.id || ''

  const filteredStocks = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return stocks
    return stocks.filter((stock) =>
      [stock.inventoryItem.name, stock.inventoryItem.sku, stock.inventoryItem.itemTypeCode]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [search, stocks])

  const inventorySummary = useMemo(
    () => ({
      totalItems: items.length,
      totalUnits: filteredStocks.reduce((sum, stock) => sum + num(stock.quantityOnHand), 0),
      lowStock: filteredStocks.filter((stock) => num(stock.quantityOnHand) <= num(stock.reorderLevel)).length,
      recentMovementCount: movements.length,
    }),
    [filteredStocks, items.length, movements.length],
  )
  const { activeSection } = useWorkspaceSection(INVENTORY_SECTIONS, 'summary')

  const hasItems = items.length > 0
  const hasStaff = staff.length > 0

  async function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId) {
      toast('Avval firma tanlang.', 'error')
      return
    }
    if (!itemForm.name.trim()) {
      toast('Mahsulot nomini kiriting.', 'error')
      return
    }

    try {
      await createItem.mutateAsync({
        organizationId,
        name: itemForm.name,
        sku: itemForm.sku || undefined,
        unitName: itemForm.unitName || 'pcs',
        itemTypeCode: itemForm.itemTypeCode as 'part' | 'consumable' | 'other',
        costPrice: itemForm.costPrice ? Number(itemForm.costPrice) : 0,
        salePrice: itemForm.salePrice ? Number(itemForm.salePrice) : 0,
      })
      setItemForm({ name: '', sku: '', unitName: 'pcs', itemTypeCode: 'part', costPrice: '', salePrice: '' })
      toast("Yangi mahsulot qo'shildi.", 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : "Mahsulot qo'shilmadi.", 'error')
    }
  }

  async function handleCreateMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId) {
      toast('Avval firma tanlang.', 'error')
      return
    }
    if (!branchId) {
      toast('Avval filial tanlang.', 'error')
      return
    }
    if (!hasItems) {
      toast("Avval kamida 1 ta mahsulot qo'shing.", 'error')
      return
    }
    if (!effectiveMovementItemId) {
      toast('Avval mahsulot tanlang.', 'error')
      return
    }
    if (!movementForm.quantity.trim()) {
      toast('Harakat miqdorini kiriting.', 'error')
      return
    }

    try {
      await createMovement.mutateAsync({
        organizationId,
        branchId,
        inventoryItemId: effectiveMovementItemId,
        createdByStaffId: effectiveMovementStaffId,
        movementType: movementForm.movementType as
          | 'purchase'
          | 'usage'
          | 'adjustment'
          | 'transfer_in'
          | 'transfer_out'
          | 'return_in'
          | 'return_out'
          | 'opening_balance'
          | 'correction',
        quantity: Number(movementForm.quantity),
        unitCostAmount: movementForm.unitCostAmount ? Number(movementForm.unitCostAmount) : 0,
        note: movementForm.note || undefined,
      })
      setMovementForm((current) => ({ ...current, quantity: '', unitCostAmount: '', note: '' }))
      setShowMovementDetails(false)
      toast('Sklad harakati yozildi.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Harakat yozilmadi.', 'error')
    }
  }

  return (
    <WorkspaceLayout>
      <section className="hero-panel workspace-hero">
        <div className="hero-copy">
          <p className="eyebrow">Sklad bo'limi</p>
          <h2>
            Skladni
            <span> aniq va toza boshqarish</span>
          </h2>
          <p className="hero-text">
            Mahsulot qo'shish, sklad harakatini yozish va filial qoldig'ini kuzatish bir joyda.
          </p>
        </div>
        <div className="workspace-spotlight">
          <span className="signal">{canAdjustInventory ? 'Boshqaruv' : "Ko'rish"}</span>
          <strong>{selectedOrganization?.name ?? 'Firma tanlanmagan'}</strong>
          <p>
            {selectedOrganization
              ? `${selectedBranchName || 'Filial tanlanmagan'} | ${filteredStocks.length} ta qoldiq yozuvi`
              : "Firma ma'lumoti yuklanmoqda."}
          </p>
        </div>
      </section>

      <section className="workspace-toolbar panel">
        <label className="field">
          <span>Qidiruv</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mahsulot, SKU yoki tur" />
        </label>
      </section>

      <section className="context-bar">
        <div className="context-chip">
          <span>Firma</span>
          <strong>{selectedOrganization?.name ?? "Yuklanmoqda"}</strong>
        </div>
        <div className="context-chip">
          <span>Filial</span>
          <strong>{selectedBranchName || 'Tanlanmagan'}</strong>
        </div>
        <div className="context-chip">
          <span>Natija</span>
          <strong>{filteredStocks.length} ta qoldiq yozuvi</strong>
        </div>
      </section>

      {activeSection === 'summary' ? (
        <section className="workspace-summary-grid" id="summary">
          <article className="workspace-summary-card">
            <span>Mahsulotlar</span>
            <strong>{inventorySummary.totalItems}</strong>
            <p>Firma bo'yicha</p>
          </article>
          <article className="workspace-summary-card">
            <span>Jami birlik</span>
            <strong>{inventorySummary.totalUnits}</strong>
            <p>Tanlangan filial qoldig'i</p>
          </article>
          <article className="workspace-summary-card">
            <span>Kam qolgan</span>
            <strong>{inventorySummary.lowStock}</strong>
            <p>Minimal qoldiqqa yetganlar</p>
          </article>
          <article className="workspace-summary-card">
            <span>Harakatlar</span>
            <strong>{inventorySummary.recentMovementCount}</strong>
            <p>So'nggi yozilgan harakatlar</p>
          </article>
        </section>
      ) : activeSection === 'items' ? (
        <section className="dashboard-grid" id="items">
          {canAdjustInventory ? (
            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Yangi mahsulot</p>
                  <h3>Sklad mahsuloti qo'shish</h3>
                </div>
              </div>
              <form className="workspace-form-stack" onSubmit={handleCreateItem}>
                <label className="field">
                  <span>Nomi</span>
                  <input value={itemForm.name} onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>SKU</span>
                  <input value={itemForm.sku} onChange={(event) => setItemForm((current) => ({ ...current, sku: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Turi</span>
                  <select value={itemForm.itemTypeCode} onChange={(event) => setItemForm((current) => ({ ...current, itemTypeCode: event.target.value }))}>
                    <option value="part">detal</option>
                    <option value="consumable">sarflanadigan</option>
                    <option value="other">boshqa</option>
                  </select>
                </label>
                <label className="field">
                  <span>Birligi</span>
                  <input value={itemForm.unitName} onChange={(event) => setItemForm((current) => ({ ...current, unitName: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Tannarx</span>
                  <input value={itemForm.costPrice} onChange={(event) => setItemForm((current) => ({ ...current, costPrice: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Sotuv narxi</span>
                  <input value={itemForm.salePrice} onChange={(event) => setItemForm((current) => ({ ...current, salePrice: event.target.value }))} />
                </label>
                <button className="primary-btn" disabled={createItem.isPending}>
                  {createItem.isPending ? 'Saqlanmoqda...' : "Mahsulot qo'shish"}
                </button>
              </form>
            </article>
          ) : (
            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Faqat ko'rish</p>
                  <h3>Sklad nazorati</h3>
                </div>
              </div>
              <div className="workspace-empty-state">
                <strong>Siz bu rolda qoldiqni ko'ra olasiz, lekin mahsulot qo'sha olmaysiz.</strong>
              </div>
            </article>
          )}

          <article className="panel panel-wide">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Filial qoldig'i</p>
                <h3>Qoldiq holati</h3>
              </div>
            </div>
            {isLoading ? (
              <div className="workspace-empty-state">
                <strong>Sklad ma'lumoti yuklanmoqda...</strong>
              </div>
            ) : !branchId ? (
              <div className="workspace-empty-state">
                <strong>Qoldiqni ko'rish uchun filial tanlang.</strong>
              </div>
            ) : (
              <div className="team-list">
                {filteredStocks.map((stock) => (
                  <article className="organization-card" key={stock.id}>
                    <div className="status-row">
                      <div>
                        <strong>{stock.inventoryItem.name}</strong>
                        <p>{stock.inventoryItem.sku || getInventoryItemTypeLabel(stock.inventoryItem.itemTypeCode)}</p>
                      </div>
                      <span className={`status-pill ${num(stock.quantityOnHand) <= num(stock.reorderLevel) ? 'is-warning' : ''}`}>
                        {num(stock.quantityOnHand)} {stock.inventoryItem.unitName}
                      </span>
                    </div>
                    <div className="detail-list">
                      <div><span>Filial</span><strong>{stock.branch.name}</strong></div>
                      <div><span>Minimal qoldiq</span><strong>{num(stock.reorderLevel)}</strong></div>
                      <div><span>Sotuv narxi</span><strong>{formatMoneyUzs(num(stock.inventoryItem.salePrice))}</strong></div>
                    </div>
                    {num(stock.quantityOnHand) <= num(stock.reorderLevel) ? (
                      <div className="workspace-summary-card inventory-warning-card">
                        <span>Diqqat</span>
                        <strong>Qayta to'ldirish kerak</strong>
                        <p>Bu mahsulot qoldig'i kam qolgan.</p>
                      </div>
                    ) : null}
                  </article>
                ))}
                {!filteredStocks.length ? (
                  <div className="workspace-empty-state">
                    <strong>Mos qoldiq topilmadi.</strong>
                  </div>
                ) : null}
              </div>
            )}
          </article>
        </section>
      ) : (
        <section className="dashboard-grid" id="movements">
          {canAdjustInventory ? (
            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Kirim-chiqim</p>
                  <h3>Qoldiq harakatini yozish</h3>
                </div>
              </div>

              <div className="workspace-summary-card inventory-flow-card">
                <span>Tezkor oqim</span>
                <strong>Mahsulot + turi + miqdor</strong>
                <p>Tannarx va izoh kabi joylar faqat kerak bo'lsa ochiladi.</p>
              </div>

              {!branchId ? (
                <div className="workspace-empty-state inventory-empty-gap">
                  <strong>Harakat yozish uchun avval filial tanlang.</strong>
                </div>
              ) : null}
              {!hasItems ? (
                <div className="workspace-empty-state inventory-empty-gap">
                  <strong>Harakat yozish uchun avval kamida 1 ta mahsulot qo'shing.</strong>
                </div>
              ) : null}

              <form className="workspace-form-stack" onSubmit={handleCreateMovement}>
                <div className="workspace-form-grid">
                  <label className="field">
                    <span>Mahsulot</span>
                    <select
                      value={effectiveMovementItemId}
                      onChange={(event) => setMovementForm((current) => ({ ...current, inventoryItemId: event.target.value }))}
                      disabled={!hasItems}
                    >
                      <option value="">Tanlang</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Harakat turi</span>
                    <select
                      value={movementForm.movementType}
                      onChange={(event) => setMovementForm((current) => ({ ...current, movementType: event.target.value }))}
                    >
                      <option value="purchase">kirim (xarid)</option>
                      <option value="adjustment">tuzatish</option>
                      <option value="opening_balance">boshlang'ich qoldiq</option>
                      <option value="correction">qo'lda tuzatish</option>
                    </select>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                      Detal sarfi uchun Zakaz sahifasidagi ish detal oqimidan foydalaning.
                    </p>
                  </label>
                  <label className="field">
                    <span>Miqdori</span>
                    <input
                      value={movementForm.quantity}
                      onChange={(event) => setMovementForm((current) => ({ ...current, quantity: event.target.value }))}
                      placeholder="Masalan: 12"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Xodim</span>
                    <select
                      value={effectiveMovementStaffId}
                      onChange={(event) => setMovementForm((current) => ({ ...current, createdByStaffId: event.target.value }))}
                      disabled={!hasStaff}
                    >
                      <option value="">Tanlang</option>
                      {staff.map((item) => (
                        <option key={item.id} value={item.id}>{item.fullName}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <button type="button" className="ghost-btn" onClick={() => setShowMovementDetails((current) => !current)}>
                  {showMovementDetails ? "Qo'shimcha maydonlarni yopish" : "Qo'shimcha maydonlarni ochish"}
                </button>

                {showMovementDetails ? (
                  <div className="workspace-form-grid">
                    <label className="field">
                      <span>Tannarx</span>
                      <input
                        value={movementForm.unitCostAmount}
                        onChange={(event) => setMovementForm((current) => ({ ...current, unitCostAmount: event.target.value }))}
                        placeholder="Masalan: 45000"
                      />
                    </label>
                    <label className="field">
                      <span>Izoh</span>
                      <input
                        value={movementForm.note}
                        onChange={(event) => setMovementForm((current) => ({ ...current, note: event.target.value }))}
                        placeholder="Masalan: yangi part keldi"
                      />
                    </label>
                  </div>
                ) : null}

                <button className="primary-btn" disabled={!branchId || !hasItems || createMovement.isPending}>
                  {createMovement.isPending ? 'Saqlanmoqda...' : 'Harakat yozish'}
                </button>
              </form>
            </article>
          ) : (
            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Faqat ko'rish</p>
                  <h3>Sklad harakatlari</h3>
                </div>
              </div>
              <div className="workspace-empty-state">
                <strong>Siz bu rolda harakat tarixini ko'ra olasiz, lekin yangi kirim-chiqim yoza olmaysiz.</strong>
              </div>
            </article>
          )}

          <article className="panel panel-wide">
            <div className="panel-head">
              <div>
                <p className="eyebrow">So'nggi harakatlar</p>
                <h3>Sklad harakatlari tarixi</h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', alignSelf: 'center' }}>So'nggi 100 ta</span>
            </div>
            <div className="status-stack">
              {!branchId ? (
                <p className="workspace-muted">Harakatlarni ko'rish uchun filial tanlang.</p>
              ) : movements.length === 0 ? (
                <p className="workspace-muted">Harakatlar hali yo'q.</p>
              ) : (
                movements.map((movement) => (
                  <div className="task-card" key={movement.id}>
                    <div className="status-row">
                      <span>{movement.inventoryItem.name} - {getStockMovementLabel(movement.movementType)}</span>
                      <strong>{num(movement.quantity)}</strong>
                    </div>
                    <div className="detail-list">
                      <div><span>Filial</span><strong>{movement.branch.name}</strong></div>
                      <div>
                        <span>Yozilgan vaqt</span>
                        <strong>{new Date(movement.createdAt).toLocaleString('uz-UZ')}</strong>
                      </div>
                    </div>
                    {movement.note ? <p className="workspace-muted">{movement.note}</p> : null}
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      )}
    </WorkspaceLayout>
  )
}

export default InventoryPage
