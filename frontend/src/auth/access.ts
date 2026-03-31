import type { LoginResponse } from '../lib/api'

export type AuthLike = {
  session: LoginResponse
}

export function hasPermission(
  auth: AuthLike | null,
  permissionCode: string,
): boolean {
  if (!auth) return false
  if (auth.session.isPlatformAdmin) return true

  return auth.session.permissionCodes.includes(permissionCode)
}

export function hasAnyPermission(
  auth: AuthLike | null,
  permissionCodes: string[],
): boolean {
  if (!permissionCodes.length) return true
  return permissionCodes.some((permissionCode) =>
    hasPermission(auth, permissionCode),
  )
}

export function canAccessDashboard(auth: AuthLike | null) {
  return hasPermission(auth, 'report.read')
}

export function canAccessOrders(auth: AuthLike | null) {
  return hasPermission(auth, 'order.read')
}

export function canAccessReception(auth: AuthLike | null) {
  return hasPermission(auth, 'order.create')
}

export function canAccessClients(auth: AuthLike | null) {
  return hasPermission(auth, 'order.read')
}

export function canAccessNotifications(auth: AuthLike | null) {
  return hasPermission(auth, 'order.read')
}

export function canAccessStaff(auth: AuthLike | null) {
  return hasPermission(auth, 'staff.read') || hasPermission(auth, 'staff.manage')
}

export function canAccessInventory(auth: AuthLike | null) {
  return hasPermission(auth, 'inventory.read')
}

export function canAccessMyTasks(auth: AuthLike | null) {
  return hasPermission(auth, 'task.update')
}

export function canAccessPayments(auth: AuthLike | null) {
  return hasAnyPermission(auth, ['payment.read', 'payment.create'])
}

export function canAccessExpenses(auth: AuthLike | null) {
  return hasPermission(auth, 'expense.create')
}

export function canAccessSettings(auth: AuthLike | null) {
  return hasPermission(auth, 'system.settings') || hasPermission(auth, 'staff.manage')
}

export function canManagePlatform(auth: AuthLike | null) {
  return Boolean(auth?.session.isPlatformAdmin)
}

export function getDefaultAuthenticatedRoute(auth: AuthLike | null) {
  if (canAccessDashboard(auth)) return '/dashboard'
  if (canAccessReception(auth)) return '/reception'
  if (canAccessOrders(auth)) return '/orders'
  if (canAccessMyTasks(auth)) return '/my-tasks'
  if (canAccessNotifications(auth)) return '/notifications'
  if (canAccessClients(auth)) return '/clients'
  if (canAccessStaff(auth)) return '/staff'
  if (canAccessSettings(auth)) return '/settings'
  if (canAccessInventory(auth)) return '/inventory'
  if (canAccessPayments(auth)) return '/payments'
  if (canAccessExpenses(auth)) return '/expenses'

  return '/login'
}

export function getPrimaryAccessLabel(auth: AuthLike | null) {
  if (!auth) return 'Guest'
  if (auth.session.isPlatformAdmin) return 'Super admin'

  const codes = auth.session.permissionCodes
  if (codes.includes('system.settings')) return 'Owner admin'
  if (codes.includes('order.approve')) return 'Manager'
  if (codes.includes('payment.create') && !codes.includes('inventory.adjust')) {
    return 'Cashier'
  }
  if (codes.includes('task.update')) return 'Worker'

  return 'Staff'
}

export function getRoleGuidance(auth: AuthLike | null) {
  const accessLabel = getPrimaryAccessLabel(auth)

  switch (accessLabel) {
    case 'Super admin':
      return {
        title: 'Platform nazorati sizda',
        description:
          "Organization ochish, branch ulash va yangi owner yoki staff accountlarni tayyorlash bosqichidasiz.",
        highlights: [
          'Yangi business oching',
          "Branch va owner accountlarni tayyorlang",
          'Platformadagi umumiy holatni kuzating',
        ],
      }
    case 'Owner admin':
      return {
        title: 'Biznes ichki nazorati sizda',
        description:
          "Zakaz, to'lov, sklad va jamoa bilan to'liqroq ishlashingiz mumkin.",
        highlights: [
          "Zakaz oqimini boshqaring",
          "To'lov va skladni kuzating",
          'Jamoani nazorat qiling',
        ],
      }
    case 'Manager':
      return {
        title: 'Kunlik ishlar sizga biriktirilgan',
        description:
          "Zakazlar, ustalar taqsimoti va jarayondagi ishlar sizning asosiy maydoningiz.",
        highlights: [
          'Yangi zakazlarni boshqaring',
          'Ustalarga ish taqsimlang',
          "To'lov va sklad holatini kuzating",
        ],
      }
    case 'Cashier':
      return {
        title: "To'lovlar oqimi sizning ish maydoningiz",
        description:
          "Asosiy vazifa zakaz bo'yicha tushumlarni to'g'ri yozish va to'lov tarixini nazorat qilish.",
        highlights: [
          "To'lov tarixini tekshiring",
          "Yangi to'lovlarni kiriting",
          "Zakaz bo'yicha qolgan summani kuzating",
        ],
      }
    case 'Worker':
      return {
        title: 'Ijro va texnik kuzatuv paneli',
        description:
          "Siz uchun eng muhim joylar zakaz tafsiloti va sklad ko'rinishi bo'ladi.",
        highlights: [
          "Biriktirilgan zakazlarni ko'ring",
          'Ish holatlarini kuzating',
          "Kerakli detal borligini tekshiring",
        ],
      }
    default:
      return {
        title: 'Ish maydoni tayyor',
        description:
          "Rolingizga mos bo'limlar chap tomonda ko'rinadi. Ishni o'sha joydan davom ettirasiz.",
        highlights: [
          "Mos bo'limni oching",
          "Ma'lumotlarni kuzating",
          'Kerakli joyda jamoa bilan ishlang',
        ],
      }
  }
}
