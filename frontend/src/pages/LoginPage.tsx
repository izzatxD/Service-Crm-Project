import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { getDefaultAuthenticatedRoute } from '../auth/access'
import { useTheme } from '../theme/ThemeProvider'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { auth, login } = useAuth()
  const { mode, toggleMode } = useTheme()
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (auth) {
    return <Navigate to={getDefaultAuthenticatedRoute(auth)} replace />
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      await login(loginIdentifier, password, rememberMe)
      const redirectTo =
        typeof location.state === 'object' &&
        location.state &&
        'from' in location.state &&
        typeof location.state.from === 'string'
          ? location.state.from
          : '/'

      navigate(redirectTo, { replace: true })
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Tizimga kirib bo'lmadi.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="auth-theme-row">
          <button className="auth-theme-toggle" onClick={toggleMode} type="button">
            <span>{mode === 'dark' ? 'Kunduzgi' : 'Tungi'}</span>
            <strong>{mode === 'dark' ? 'Light' : 'Dark'}</strong>
          </button>
        </div>

        <div className="auth-brand">
          <div className="auth-logo">A</div>
          <p className="eyebrow auth-eyebrow">AvtoUSTA CRM</p>
          <h2 className="auth-title">Tizimga kirish</h2>
          <p className="auth-muted auth-brand-note">
            Barcha akkauntlar uchun faqat login va parol kiriting
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Login</span>
            <input
              type="text"
              placeholder="login yoki email"
              value={loginIdentifier}
              onChange={(event) => setLoginIdentifier(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>

          <label className="field">
            <span>Parol</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Parolingizni kiriting"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                title={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
              >
                {showPassword ? 'Yopish' : "Ko'rish"}
              </button>
            </div>
          </label>

          <div className="auth-row">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Meni eslab qol</span>
            </label>
            <span className="auth-inline-note">Login va parol admin tomonidan beriladi</span>
          </div>

          {error ? <div className="auth-error">{error}</div> : null}

          <button type="submit" className="primary-btn auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Kirilmoqda...' : 'Kirish'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Akkaunt bo&apos;lmasa, super admin sizga kirish ochib beradi.</span>
        </div>

        <div className="bot-footer-tag auth-footer-tag">@carService_Crm_bot</div>
      </section>
    </div>
  )
}

export default LoginPage
