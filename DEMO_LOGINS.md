# Demo Logins

Bu fayl loyiha ichidagi demo akkauntlar bilan tez test qilish uchun.

## Umumiy Parollar

- Demo rolelar: `Demo12345!`

## Platform Admin

- Default seed login yo'q
- Default yo'nalish: platform boshqaruv oqimi
- Izoh: platform admin akkaunti qo'lda yaratiladi yoki `backend/.env` ichida platform seed alohida yoqilganda paydo bo'ladi

## Demo Rolelar

Staff demo akkauntlar ham oddiy `login + password` bilan kiradi.

| Role | Login | Default sahifa | Asosiy imkoniyat |
| --- | --- | --- | --- |
| admin | `demo+admin@crm.local` | `/dashboard` | to'liq ichki boshqaruv |
| manager | `demo+manager@crm.local` | `/dashboard` | zakaz, biriktirish, tasdiq |
| worker | `demo+worker@crm.local` | `/orders` | task yuritish va inventory ko'rish |
| cashier | `demo+cashier@crm.local` | `/dashboard` | to'lovlar va dashboard |
| viewer | `demo+viewer@crm.local` | `/dashboard` | faqat ko'rish rejimi |

## Role Bo'yicha Qisqa Tekshiruv

- `demo+admin@crm.local`
  `orders`, `payments`, `inventory`, `dashboard`, `team` oqimlarini to'liq tekshirish uchun
- `demo+manager@crm.local`
  order workflow, assignment va approval logikasini tekshirish uchun
- `demo+worker@crm.local`
  `OrderDetail` ichida task status yangilash va o'ziga biriktirilgan ishlarni tekshirish uchun
- `demo+cashier@crm.local`
  qarzdorlar, payment create va dashboard tushum bloklarini tekshirish uchun
- `demo+viewer@crm.local`
  faqat read-only oqimlar va route guardlarni tekshirish uchun

## Eslatma

- Default route frontenddagi permission logikasi bo'yicha aniqlanadi.
- `worker` roli `report.read` olmagani uchun `/dashboard` emas, `/orders` ga tushadi.
- Demo ma'lumotlar `backend/.env` ichida yoqilgan `SEED_DEMO_ENABLED=true` orqali yaratilgan.
- Platform admin uchun universal default email/parol yo'q. Agar seed ishlatilsa, `SEED_PLATFORM_ENABLED=true` va `SEED_PLATFORM_*` qiymatlari bilan boshqariladi.
