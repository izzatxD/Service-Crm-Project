# Demo Role QA

Bu checklist demo loginlar bilan role-by-role tekshiruv qilish uchun.

## 1. Admin

- Login: `demo+admin@crm.local`
- Parol: `Demo12345!`
- Kutiladigan default sahifa: `/dashboard`
- Tekshiring:
  - `Dashboard` ochilsin
  - `Orders` sahifasida yangi zakaz ochish tugmasi ko'rinsin
  - `OrderDetail` ichida status, task, assignment, approval, payment bloklari faol bo'lsin
  - `Payments` sahifasida ham qarzdorlar, ham chiqimlar ko'rinsin
  - `Inventory` sahifasida mahsulot va movement yaratish formasi ko'rinsin

## 2. Manager

- Login: `demo+manager@crm.local`
- Parol: `Demo12345!`
- Kutiladigan default sahifa: `/dashboard`
- Tekshiring:
  - `Dashboard` ochilsin
  - `Orders` sahifasida yangi zakaz ochish tugmasi ko'rinsin
  - `OrderDetail` ichida assignment va approval formasi ko'rinsin
  - `Payment` yozish tugmasi ko'rinmasin
  - `Inventory` sahifasi faqat ko'rish rejimida ochilsin

## 3. Worker

- Login: `demo+worker@crm.local`
- Parol: `Demo12345!`
- Kutiladigan default sahifa: `/orders`
- Tekshiring:
  - login bo'lgach `Orders` ochilsin
  - `Dashboard` ga avtomatik yubormasin
  - `OrderDetail` ichida faqat o'ziga biriktirilgan task bo'lsa status tugmalari ko'rinsin
  - status, assignment, approval, payment yaratish formasi ko'rinmasin
  - `Inventory` sahifasi ochilsin, lekin create/movement formasi yopiq bo'lsin

## 4. Cashier

- Login: `demo+cashier@crm.local`
- Parol: `Demo12345!`
- Kutiladigan default sahifa: `/dashboard`
- Tekshiring:
  - `Dashboard` ochilsin
  - `Payments` sahifasida qarzdorlar bo'limi ko'rinsin
  - payment create formasi ishlasin
  - expense bo'limi ko'rinmasin
  - `Inventory` sahifasiga ruxsat bo'lmasin

## 5. Viewer

- Login: `demo+viewer@crm.local`
- Parol: `Demo12345!`
- Kutiladigan default sahifa: `/dashboard`
- Tekshiring:
  - `Dashboard` ochilsin
  - `Orders`, `Payments`, `Inventory` sahifalari read-only ishlasin
  - create, update, assign, approve, payment create tugmalari ko'rinmasin
  - route guardlar noto'g'ri sahifaga kiritmasin

## Yakuniy Tekshiruv

- Staff rolelar loginida oddiy `login + password` ishlasin
- Har bir role login bo'lgach noto'g'ri default sahifaga tushmasin
- Ruxsatsiz sahifaga URL bilan kirilganda tizim foydalanuvchini mos sahifaga qaytarsin
- Bir xil organization va branch ichida dashboard, orders, payments raqamlari bir-biriga zid chiqmasin
