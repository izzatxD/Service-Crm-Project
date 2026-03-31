type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullPage?: boolean
}

export function LoadingSpinner({ size = 'md', text, fullPage = false }: LoadingSpinnerProps) {
  const sizes = { sm: 20, md: 36, lg: 56 }
  const px = sizes[size]
  const strokeWidth = size === 'sm' ? 2.5 : 3

  const spinner = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 40 40"
      fill="none"
      aria-label="Yuklanmoqda"
      className="loading-spinner-svg"
    >
      <circle cx="20" cy="20" r="16" stroke="var(--border-2)" strokeWidth={strokeWidth} />
      <circle
        cx="20"
        cy="20"
        r="16"
        stroke="var(--accent)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="60 40"
        strokeDashoffset="0"
      />
    </svg>
  )

  if (fullPage) {
    return (
      <div className="loading-spinner-fullpage">
        {spinner}
        {text ? <p className="loading-spinner-text">{text}</p> : null}
      </div>
    )
  }

  if (text) {
    return (
      <div className="loading-spinner-inline">
        {spinner}
        <span className="loading-spinner-text">{text}</span>
      </div>
    )
  }

  return spinner
}

export default LoadingSpinner
