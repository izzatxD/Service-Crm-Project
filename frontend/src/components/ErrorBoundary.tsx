import { Component, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const isDev = import.meta.env.DEV

      return (
        <div className="error-boundary-shell">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">⚠️</div>
            <h2 className="error-boundary-title">Kutilmagan xato yuz berdi</h2>
            <p className="error-boundary-text">
              Sahifani yuklashda muammo bo'ldi. Iltimos, qayta urinib ko'ring
              yoki bosh sahifaga qayting.
            </p>

            {isDev && this.state.error && (
              <details className="error-boundary-details">
                <summary>Xato tafsiloti (dev rejimi)</summary>
                <pre className="error-boundary-stack">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="error-boundary-actions">
              <button className="primary-btn" onClick={this.handleRetry}>
                Qayta urinish
              </button>
              <button className="ghost-btn" onClick={this.handleReset}>
                Bosh sahifaga qaytish
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
