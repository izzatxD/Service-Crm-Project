import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

type PageHeaderProps = {
  title: string
  subtitle?: string
  backHref?: string
  actions?: ReactNode
  badge?: ReactNode
}

export function PageHeader({ title, subtitle, backHref, actions, badge }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="page-header">
      <div className="page-header-main">
        {backHref ? (
          <button
            className="ghost-btn page-header-back"
            onClick={() => navigate(backHref)}
            aria-label="Orqaga"
          >
            &lt;
          </button>
        ) : null}

        <div className="page-header-copy">
          <div className="page-header-title-row">
            <h1 className="page-header-title">{title}</h1>
            {badge}
          </div>
          {subtitle ? <p className="page-header-subtitle">{subtitle}</p> : null}
        </div>
      </div>

      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  )
}

export default PageHeader
