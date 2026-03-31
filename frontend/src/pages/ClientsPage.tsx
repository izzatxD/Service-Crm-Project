import { useMemo, useState } from 'react'

import { useAuth } from '../auth/AuthContext'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { useClients } from '../hooks/useClients'
import { useOrders } from '../hooks/useOrders'
import { useWorkspaceSection } from '../hooks/useWorkspaceSection'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'

const CLIENT_SECTIONS = ['summary', 'list'] as const

function money(value: number) {
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(value) + " so'm"
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function ClientsPage() {
  const { auth } = useAuth()
  const token = auth?.accessToken ?? ''
  const { organizationId } = useWorkspaceSelection()
  const [search, setSearch] = useState('')

  const { data: clients = [] } = useClients(token, organizationId)
  const { data: orders = [] } = useOrders(token, organizationId)

  const enrichedClients = useMemo(() => {
    return clients.map((client) => {
      const clientOrders = orders.filter(
        (order) => order.client.fullName === client.fullName && order.client.phone === client.phone,
      )
      const totalDebt = clientOrders.reduce(
        (sum, order) => sum + Number(order.financial?.balanceDueAmount ?? 0),
        0,
      )
      const latestOrderAt = clientOrders[0]?.openedAt ?? client.createdAt

      return {
        ...client,
        orderCount: clientOrders.length,
        totalDebt,
        latestOrderAt,
      }
    })
  }, [clients, orders])

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return enrichedClients

    return enrichedClients.filter((client) =>
      [
        client.fullName,
        client.phone,
        client.note,
        ...client.assets.map((asset) => asset.displayName),
        ...client.assets.map((asset) => asset.vehicleProfile?.plateNumber ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [enrichedClients, search])

  const totalDebt = useMemo(
    () => filteredClients.reduce((sum, client) => sum + client.totalDebt, 0),
    [filteredClients],
  )

  const clientsWithDebt = filteredClients.filter((client) => client.totalDebt > 0).length
  const { activeSection } = useWorkspaceSection(CLIENT_SECTIONS, 'summary')

  return (
    <WorkspaceLayout>
      <div className="bot-topbar">
        <div className="bot-topbar-left">
          <div className="bot-topbar-title">Mijozlar</div>
          <div className="bot-topbar-subtitle">Mijoz bazasi va servis tarixi</div>
        </div>
      </div>

      <section className="workspace-toolbar panel">
        <label className="field">
          <span>Qidiruv</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ism, telefon, mashina yoki davlat raqami"
          />
        </label>
      </section>

      {activeSection === 'summary' ? (
        <section className="workspace-summary-grid" id="summary">
          <article className="workspace-summary-card">
            <span>Mijozlar</span>
            <strong>{filteredClients.length}</strong>
            <p>Tanlangan firma bo'yicha</p>
          </article>
          <article className="workspace-summary-card">
            <span>Qarzdorlar</span>
            <strong>{clientsWithDebt}</strong>
            <p>Qarzi bor mijozlar</p>
          </article>
          <article className="workspace-summary-card">
            <span>Jami qarz</span>
            <strong>{money(totalDebt)}</strong>
            <p>Mijozlar kesimidagi qoldiq</p>
          </article>
        </section>
      ) : (
        <section className="panel" id="list">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Mijozlar ro'yxati</p>
              <h3>Har bir mijoz bo'yicha foydali ko'rinish</h3>
            </div>
          </div>

          {filteredClients.length === 0 ? (
            <div className="workspace-empty-state">
              <strong>Mijoz topilmadi</strong>
              <p>Tanlangan firma yoki qidiruv bo'yicha natija yo'q.</p>
            </div>
          ) : (
            <div className="clients-grid">
              {filteredClients.map((client) => (
                <article key={client.id} className="client-card">
                  <div className="client-card-head">
                    <div className="client-avatar">{client.fullName.charAt(0).toUpperCase()}</div>
                    <div className="client-copy">
                      <strong>{client.fullName}</strong>
                      <span>{client.phone || 'Telefon kiritilmagan'}</span>
                    </div>
                    {client.totalDebt > 0 && (
                      <div className="client-debt-badge">{money(client.totalDebt)}</div>
                    )}
                  </div>

                  <div className="client-meta-row">
                    <div className="client-meta-chip">
                      <span>Asset</span>
                      <strong>{client.assets.length}</strong>
                    </div>
                    <div className="client-meta-chip">
                      <span>Order</span>
                      <strong>{client.orderCount}</strong>
                    </div>
                    <div className="client-meta-chip">
                      <span>So'nggi</span>
                      <strong>{formatDate(client.latestOrderAt)}</strong>
                    </div>
                  </div>

                  <div className="client-asset-stack">
                    {client.assets.length > 0 ? (
                      client.assets.slice(0, 3).map((asset) => (
                        <div key={asset.id} className="client-asset-item">
                          <strong>{asset.displayName}</strong>
                          <span>{asset.vehicleProfile?.plateNumber || "Raqam yo'q"}</span>
                        </div>
                      ))
                    ) : (
                      <div className="client-asset-item is-muted">
                        <strong>Asset biriktirilmagan</strong>
                        <span>Mijoz hali servis obyektisiz</span>
                      </div>
                    )}
                  </div>

                  {client.note ? <p className="client-note">{client.note}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </WorkspaceLayout>
  )
}

export default ClientsPage
