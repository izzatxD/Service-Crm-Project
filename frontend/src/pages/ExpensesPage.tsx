import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Expenses tab is now inside PaymentsPage (Moliya) as the CHIQIMLAR tab.
// This component simply redirects there.
function ExpensesPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/payments', { replace: true })
  }, [navigate])

  return null
}

export default ExpensesPage
