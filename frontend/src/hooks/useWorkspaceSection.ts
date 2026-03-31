import { useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export function useWorkspaceSection<T extends string>(
  sections: readonly T[],
  defaultSection: T,
) {
  const location = useLocation()
  const navigate = useNavigate()

  const activeSection = useMemo(() => {
    const hash = location.hash.replace('#', '') as T
    return sections.includes(hash) ? hash : defaultSection
  }, [defaultSection, location.hash, sections])

  useEffect(() => {
    const hash = location.hash.replace('#', '') as T
    if (sections.includes(hash)) {
      return
    }

    navigate(`${location.pathname}${location.search}#${defaultSection}`, {
      replace: true,
    })
  }, [defaultSection, location.hash, location.pathname, location.search, navigate, sections])

  const setActiveSection = useCallback((section: T, replace = false) => {
    navigate(`${location.pathname}${location.search}#${section}`, { replace })
  }, [location.pathname, location.search, navigate])

  return {
    activeSection,
    setActiveSection,
  }
}
