import { useEffect, useRef, useState } from 'react'
import { useToast, type Toast as ToastType } from '../hooks/useToast'

const ICONS: Record<ToastType['type'], string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

function ToastItem({ toast, onDismiss }: { toast: ToastType; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setVisible(true), 16)
    return () => clearTimeout(enterTimer)
  }, [])

  const handleDismiss = () => {
    setLeaving(true)
    timerRef.current = setTimeout(() => onDismiss(toast.id), 280)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const className = [
    'toast-item',
    `toast-${toast.type}`,
    visible && !leaving ? 'toast-enter' : '',
    leaving ? 'toast-leave' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} role="alert" aria-live="polite">
      <span className="toast-icon">{ICONS[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button
        className="toast-close"
        onClick={handleDismiss}
        aria-label="Yopish"
      >
        ×
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="toast-container" aria-label="Bildirishnomalar">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  )
}

export default ToastContainer
