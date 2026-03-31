export function formatMoney(value: string | number, suffix = " so'm") {
  return (
    new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(
      Number(value),
    ) + suffix
  )
}

export function formatMoneyUzs(value: string | number) {
  return `${new Intl.NumberFormat('uz-UZ', {
    maximumFractionDigits: 0,
  }).format(Number(value))} UZS`
}

export function formatDateTime(dateStr?: string | null) {
  if (!dateStr) {
    return '-'
  }

  try {
    const date = new Date(dateStr)
    return (
      date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) +
      ' ' +
      date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      })
    )
  } catch {
    return dateStr
  }
}

export function formatDateTimeUz(dateStr?: string | null) {
  if (!dateStr) {
    return '-'
  }

  try {
    return new Date(dateStr).toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}
