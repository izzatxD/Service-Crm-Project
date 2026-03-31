type EmptyStateProps = {
  icon?: string
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon = '[]', title, description, action }: EmptyStateProps) {
  return (
    <div className="workspace-empty-state empty-state-card">
      <div className="empty-state-card-icon">{icon}</div>
      <h3 className="empty-state-card-title">{title}</h3>
      {description ? <p className="empty-state-card-description">{description}</p> : null}
      {action ? (
        <button className="primary-btn empty-state-card-action" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  )
}

export default EmptyState
