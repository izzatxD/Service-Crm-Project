export const PERMISSION_CATEGORY_LABELS: Record<string, string> = {
  system: 'Tizim',
  staff: 'Xodimlar',
  inventory: 'Sklad',
  expense: 'Chiqim',
  payment: "To'lov",
  task: 'Vazifa',
  order: 'Zakaz',
  report: 'Hisobot',
}

const PERMISSION_LABELS: Record<string, string> = {
  'system.settings': 'Tizim sozlamalarini boshqarish',
  'staff.manage': 'Xodimlarni boshqarish',
  'staff.read': "Xodimlarni ko'rish",
  'inventory.adjust': "Skladni o'zgartirish",
  'inventory.read': "Skladni ko'rish",
  'expense.create': "Chiqim qo'shish",
  'payment.create': "To'lov qo'shish",
  'payment.read': "To'lovlarni ko'rish",
  'task.update': 'Vazifani yangilash',
  'order.assign': 'Zakazni biriktirish',
  'order.approve': 'Zakazni tasdiqlash',
  'order.update': 'Zakazni tahrirlash',
  'order.read': "Zakazni ko'rish",
  'order.create': "Zakaz qo'shish",
  'report.read': "Hisobotlarni ko'rish",
}

export function getPermissionCategory(code: string) {
  return code.split('.')[0] ?? 'other'
}

export function formatPermissionLabel(code: string) {
  return PERMISSION_LABELS[code] ?? code
}

export function groupPermissionsByCategory<T extends { code: string }>(permissions: T[]) {
  return permissions.reduce<Record<string, T[]>>((accumulator, permission) => {
    const category = getPermissionCategory(permission.code)
    accumulator[category] = [...(accumulator[category] ?? []), permission]
    return accumulator
  }, {})
}
