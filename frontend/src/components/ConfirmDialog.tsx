import { useEffect, useRef } from 'react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Tasdiqlash',
  cancelLabel = 'Bekor qilish',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handler = (event: Event) => {
      event.preventDefault()
      onCancel()
    }
    dialog.addEventListener('cancel', handler)
    return () => dialog.removeEventListener('cancel', handler)
  }, [onCancel])

  if (!open) return null

  return (
    <dialog ref={dialogRef} className="confirm-dialog">
      <div className="confirm-dialog-body">
        <h3 className="confirm-dialog-title">{title}</h3>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button className="ghost-btn confirm-dialog-button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`primary-btn confirm-dialog-button${variant === 'danger' ? ' is-danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export default ConfirmDialog
