import { useState, type SyntheticEvent } from 'react'
import { formatMoneyUzs } from '../lib/format'

type OrderCheckoutModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (cashAmount: number, cardAmount: number) => Promise<void>
  balanceDueAmount: number
  totalAmount?: number
  availableMethods?: string[]  // ['cash', 'card', ...]
}

export function OrderCheckoutModal({
  isOpen,
  onClose,
  onConfirm,
  balanceDueAmount,
  totalAmount = balanceDueAmount,
  availableMethods,
}: OrderCheckoutModalProps) {
  const [cash, setCash] = useState<string>('')
  const [card, setCard] = useState<string>('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const hasCash = !availableMethods || availableMethods.includes('cash')
  const hasCard = !availableMethods || availableMethods.includes('card')
  const noMethods = availableMethods && availableMethods.length === 0

  const cashAmount = hasCash ? (parseFloat(cash.replace(/,/g, '')) || 0) : 0
  const cardAmount = hasCard ? (parseFloat(card.replace(/,/g, '')) || 0) : 0
  const remainingDebt = Math.max(0, balanceDueAmount - cashAmount - cardAmount)

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onConfirm(cashAmount, cardAmount)
      setCash('')
      setCard('')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h2>Zakazni yakunlash va To'lov</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            disabled={loading}
          >
            &#x2715;
          </button>
        </div>

        <form className="workspace-form-stack" onSubmit={handleSubmit}>
          <div className="workspace-summary-grid" style={{ marginBottom: '1rem', gridTemplateColumns: '1fr 1fr' }}>
            <div className="workspace-summary-card" style={{ padding: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem' }}>Jami qoldiq summa</span>
              <strong style={{ fontSize: '1.2rem', margin: '0.25rem 0' }}>{formatMoneyUzs(balanceDueAmount)}</strong>
            </div>
            <div className="workspace-summary-card" style={{ padding: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem' }}>Jami order narxi</span>
              <strong style={{ fontSize: '1.2rem', margin: '0.25rem 0' }}>{formatMoneyUzs(totalAmount)}</strong>
            </div>
          </div>

          {noMethods && (
            <div className="workspace-alert is-warning" style={{ marginBottom: '0.75rem' }}>
              ⚠️ <strong>To'lov usullari sozlanmagan.</strong> Zakaz qarzga yoziladi. Sozlamalar bo'limida "cash" yoki "card" to'lov usulini yoqing.
            </div>
          )}

          {hasCash ? (
            <label className="field">
              <span>💵 Naqd pul (UZS)</span>
              <input
                type="number"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                placeholder="0"
                disabled={loading}
                min={0}
              />
            </label>
          ) : availableMethods && (
            <div style={{ padding: '0.6rem 0.75rem', borderRadius: '6px', background: 'var(--bg-tertiary)', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
              💵 Naqd pul — sozlanmagan (Settings → To'lov usullari)
            </div>
          )}

          {hasCard ? (
            <label className="field">
              <span>💳 Plastik karta (UZS)</span>
              <input
                type="number"
                value={card}
                onChange={(e) => setCard(e.target.value)}
                placeholder="0"
                disabled={loading}
                min={0}
              />
            </label>
          ) : availableMethods && (
            <div style={{ padding: '0.6rem 0.75rem', borderRadius: '6px', background: 'var(--bg-tertiary)', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
              💳 Plastik karta — sozlanmagan (Settings → To'lov usullari)
            </div>
          )}

          <div className={`workspace-alert ${remainingDebt > 0 ? 'is-warning' : 'is-success'}`} style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
            {remainingDebt > 0 ? (
              <><strong>Qarzga o'tadigan summa:</strong> {formatMoneyUzs(remainingDebt)}</>
            ) : (
              <><strong>✓ To'liq to'landi!</strong> Qarz qolmaydi.</>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={onClose}
              disabled={loading}
            >
              Bekor qilish
            </button>
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? "Saqlanmoqda..." : "Tasdiqlash va Yakunlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
