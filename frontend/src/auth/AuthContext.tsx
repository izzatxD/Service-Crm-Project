/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import {
  getMeRequest,
  loginRequest,
  type LoginResponse,
  type MeResponse,
} from '../lib/api'

type AuthState = {
  accessToken: string
  session: LoginResponse
  me: MeResponse | null
}

type AuthContextValue = {
  auth: AuthState | null
  isBootstrapping: boolean
  login: (loginIdentifier: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
}

const AUTH_STORAGE_KEY = 'cariva_auth'
const AUTH_STORAGE_MODE_KEY = 'cariva_auth_storage_mode'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readStoredAuth(): { auth: AuthState | null; storage: Storage } {
  const storageMode = window.localStorage.getItem(AUTH_STORAGE_MODE_KEY)
  const storage =
    storageMode === 'session' ? window.sessionStorage : window.localStorage
  const rawValue = storage.getItem(AUTH_STORAGE_KEY)
  if (!rawValue) {
    return { auth: null, storage }
  }

  try {
    return { auth: JSON.parse(rawValue) as AuthState, storage }
  } catch {
    storage.removeItem(AUTH_STORAGE_KEY)
    window.localStorage.removeItem(AUTH_STORAGE_MODE_KEY)
    return { auth: null, storage: window.localStorage }
  }
}

function persistAuth(auth: AuthState, rememberMe: boolean) {
  const storage = rememberMe ? window.localStorage : window.sessionStorage
  const otherStorage = rememberMe ? window.sessionStorage : window.localStorage

  otherStorage.removeItem(AUTH_STORAGE_KEY)
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
  window.localStorage.setItem(
    AUTH_STORAGE_MODE_KEY,
    rememberMe ? 'local' : 'session',
  )
}

function clearPersistedAuth() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
  window.localStorage.removeItem(AUTH_STORAGE_MODE_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ auth, isBootstrapping }, setAuthState] = useState(() => {
    const { auth: storedAuth } = readStoredAuth()
    return {
      auth: storedAuth,
      isBootstrapping: storedAuth !== null,
    }
  })

  useEffect(() => {
    const { auth: storedAuth, storage } = readStoredAuth()

    if (!storedAuth) {
      return
    }

    getMeRequest(storedAuth.accessToken)
      .then((me) => {
        const nextAuth = { ...storedAuth, me }
        setAuthState({ auth: nextAuth, isBootstrapping: false })
        storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth))
      })
      .catch(() => {
        clearPersistedAuth()
        setAuthState({ auth: null, isBootstrapping: false })
      })
  }, [])

  async function login(
    loginIdentifier: string,
    password: string,
    rememberMe = true,
  ) {
    const session = await loginRequest(loginIdentifier, password)
    const me = await getMeRequest(session.accessToken)
    const nextAuth = {
      accessToken: session.accessToken,
      session,
      me,
    }

    setAuthState({ auth: nextAuth, isBootstrapping: false })
    persistAuth(nextAuth, rememberMe)
  }

  function logout() {
    clearPersistedAuth()
    setAuthState({ auth: null, isBootstrapping: false })
  }

  return (
    <AuthContext.Provider value={{ auth, isBootstrapping, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }

  return context
}
