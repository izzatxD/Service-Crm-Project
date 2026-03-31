export function getOrderStatusLabel(status: string) {
  switch (status) {
    case 'new':
      return 'Yangi'
    case 'pending_diagnosis':
      return 'Diagnoz kutilmoqda'
    case 'estimated':
      return 'Smeta tayyor'
    case 'approved':
      return 'Tasdiqlangan'
    case 'in_progress':
      return 'Jarayonda'
    case 'waiting_parts':
      return 'Detal kutilmoqda'
    case 'completed':
      return 'Tugagan'
    case 'delivered':
      return 'Topshirildi'
    case 'cancelled':
      return 'Bekor qilingan'
    default:
      return status
  }
}

export function getOrderStageLabel(status: string) {
  switch (status) {
    case 'new':
    case 'pending_diagnosis':
      return '1-qadam: Qabul'
    case 'estimated':
    case 'approved':
      return '2-qadam: Smeta'
    case 'in_progress':
    case 'waiting_parts':
      return '3-qadam: Jarayon'
    case 'completed':
    case 'delivered':
      return '4-qadam: Yakun'
    case 'cancelled':
      return 'Bekor qilingan'
    default:
      return 'Jarayon'
  }
}

export function getOrderNextStepLabel(status: string) {
  switch (status) {
    case 'new':
      return "Diagnoz va qabul eslatmasini to'ldirish"
    case 'pending_diagnosis':
      return "Ishlar va taxminiy narxni kiritish"
    case 'estimated':
      return "Narxni kelishib, tasdiq olish"
    case 'approved':
      return "Ustaga berib ishni boshlash"
    case 'in_progress':
      return "Detallar va bajarilgan ishlarni kuzatish"
    case 'waiting_parts':
      return "Kerakli detalni topib, ishni davom ettirish"
    case 'completed':
      return "To'lovni yopib, mashinani topshirish"
    case 'delivered':
      return "Zakaz yopilgan"
    case 'cancelled':
      return "Bekor qilingan zakazni arxivda qoldirish"
    default:
      return "Zakaz tafsilotini ochib keyingi qadamni tekshirish"
  }
}

export function getAssignmentStatusLabel(status: string) {
  switch (status) {
    case 'assigned':
      return 'Biriktirilgan'
    case 'pending':
      return 'Kutilmoqda'
    case 'accepted':
      return 'Qabul qilingan'
    case 'in_progress':
      return 'Jarayonda'
    case 'completed':
      return 'Tugagan'
    case 'cancelled':
      return 'Bekor qilingan'
    default:
      return status
  }
}

export function getApprovalStatusLabel(status: string) {
  switch (status) {
    case 'pending':
      return 'Kutilmoqda'
    case 'approved':
      return 'Tasdiqlangan'
    case 'rejected':
      return 'Rad etilgan'
    case 'cancelled':
      return 'Bekor qilingan'
    default:
      return status
  }
}

export function getBusinessTypeLabel(code: string) {
  switch (code) {
    case 'auto_service':
      return 'Avto servis'
    case 'service_center':
      return 'Servis markazi'
    case 'retail':
      return 'Savdo'
    default:
      return code
  }
}

export function getInventoryItemTypeLabel(code: string) {
  switch (code) {
    case 'part':
      return 'Detal'
    case 'consumable':
      return 'Sarflanadigan'
    case 'other':
      return 'Boshqa'
    default:
      return code
  }
}

export function getPaymentMethodLabel(code: string) {
  switch (code) {
    case 'cash':
      return 'Naqd'
    case 'card':
      return 'Karta'
    case 'bank_transfer':
      return "Bank o'tkazmasi"
    case 'online':
      return 'Onlayn'
    case 'other':
      return 'Boshqa'
    default:
      return code
  }
}

export function getApprovalTypeLabel(code: string) {
  switch (code) {
    case 'estimate':
      return 'Smeta tasdig\'i'
    case 'work_start':
      return 'Ishni boshlash'
    case 'parts_purchase':
      return 'Detal xaridi'
    case 'delivery':
      return 'Topshirish'
    case 'discount':
      return 'Chegirma tasdig\'i'
    case 'completion':
      return 'Yakuniy tasdiq'
    case 'payment_exception':
      return "To'lov istisnosi"
    default:
      return code
  }
}

export function getStockMovementLabel(code: string) {
  switch (code) {
    case 'purchase':
      return 'Kirim'
    case 'usage':
      return 'Ishlatildi'
    case 'adjustment':
      return 'Tuzatish'
    case 'opening_balance':
      return "Boshlang'ich qoldiq"
    case 'correction':
      return "Qo'lda tuzatish"
    case 'transfer_in':
      return 'Transfer kirimi'
    case 'transfer_out':
      return 'Transfer chiqimi'
    case 'return_in':
      return 'Qaytgan mahsulot'
    case 'return_out':
      return 'Qaytarib berildi'
    default:
      return code
  }
}
