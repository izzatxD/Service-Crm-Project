type StatusBadgeProps = {
  status: string
  size?: 'sm' | 'md'
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  // Order statuses
  new:            { label: 'Yangi',         color: '#6b7280' },
  approved:       { label: 'Tasdiqlangan',  color: '#2563eb' },
  in_progress:    { label: 'Jarayonda',     color: '#d97706' },
  waiting_parts:  { label: 'Parts kutilmoqda', color: '#9333ea' },
  completed:      { label: 'Bajarildi',     color: '#16a34a' },
  delivered:      { label: 'Topshirildi',   color: '#059669' },
  cancelled:      { label: 'Bekor qilindi', color: '#dc2626' },
  on_hold:        { label: 'Kutishda',      color: '#78716c' },

  // Task statuses
  pending:        { label: 'Kutilmoqda',    color: '#6b7280' },
  accepted:       { label: 'Qabul qilindi', color: '#2563eb' },
  in_work:        { label: 'Ishda',         color: '#d97706' },
  done:           { label: 'Tugadi',        color: '#16a34a' },
  rejected:       { label: 'Rad etildi',    color: '#dc2626' },

  // Payment / approval
  paid:           { label: "To'langan",    color: '#16a34a' },
  partial:        { label: 'Qisman',        color: '#d97706' },
  unpaid:         { label: "To'lanmagan",  color: '#dc2626' },

  // Priority
  low:            { label: 'Past',          color: '#6b7280' },
  normal:         { label: 'Oddiy',         color: '#2563eb' },
  high:           { label: 'Yuqori',        color: '#d97706' },
  urgent:         { label: 'Shoshilinch',   color: '#dc2626' },
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: '#6b7280' }

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: size === 'sm' ? '3px 8px' : '5px 11px',
    borderRadius: '999px',
    fontSize: size === 'sm' ? '0.72rem' : '0.8rem',
    fontWeight: 600,
    letterSpacing: '0.01em',
    color: config.color,
    background: `${config.color}18`,
    border: `1px solid ${config.color}28`,
    whiteSpace: 'nowrap' as const,
  }

  const dotStyle: React.CSSProperties = {
    width: size === 'sm' ? 5 : 6,
    height: size === 'sm' ? 5 : 6,
    borderRadius: '50%',
    background: config.color,
    flexShrink: 0,
  }

  return (
    <span style={style}>
      <span style={dotStyle} />
      {config.label}
    </span>
  )
}

export default StatusBadge
