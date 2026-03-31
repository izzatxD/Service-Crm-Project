# Role Permissions

Bu hujjat tizimdagi asosiy rollar bo‘yicha kim nima qila olishini sodda va amaliy ko‘rinishda belgilaydi.

## Asosiy maqsad

Bu yerda quyidagilar aniqlanadi:

- qaysi rol nima ko‘ra oladi
- qaysi rol nima yarata oladi
- qaysi rol nima tahrir qila oladi
- qaysi rol nima tasdiqlaydi

Bu hujjat backend permission logikasi va frontend ekran huquqlarini belgilash uchun asos bo‘ladi.

## Rollar

- `admin`
- `manager`
- `worker`
- `cashier`
- `viewer`

## Platform darajasi

- `super_admin`

Bu rol organization ichidagi oddiy rollardan alohida turadi.

`super_admin` degani:

- product egasi yoki creator
- barcha organizationlarni ko‘ra oladi
- yangi organization ochib bera oladi
- auth va login bilan bog‘liq muammolarni boshqara oladi
- kerak bo‘lsa support uchun userlarga yordam bera oladi

Muhim:

- `super_admin` bu organization ichidagi `admin` bilan bir xil emas
- organization `admin` faqat o‘z firmasini boshqaradi
- `super_admin` esa butun platformani boshqaradi

## 1. Admin

`admin` bu eng yuqori nazorat rolidir.

### Ko‘ra oladi

- barcha clients
- barcha assets
- barcha orders
- barcha tasks
- barcha planned parts
- barcha actual parts
- barcha payments
- barcha expenses
- barcha approvals
- barcha assignment tarixlari
- barcha audit loglar
- barcha branch va staff ma’lumotlari

### Yaratadi / tahrirlaydi

- organizations settings
- branches
- users
- staff members
- service categories
- services
- inventory items
- expense categories

### Qo‘shimcha huquqlar

- har qanday orderni ko‘rish
- kerak bo‘lsa statusni o‘zgartirish
- reporting va dashboard ko‘rish
- umumiy nazorat qilish

## 2. Manager

`manager` mijoz bilan ishlaydigan va order oqimini boshqaradigan rol.

### Ko‘ra oladi

- clients
- assets
- vehicle profiles
- orders
- order tasks
- planned parts
- actual parts
- order assignments
- order approvals
- inventory qoldig‘i
- payment holati

### Yaratadi

- client
- asset
- vehicle profile
- order
- order tasks
- planned parts
- order assignments
- order approvals so‘rovi
- order extra charges

### Tahrirlaydi

- o‘zi ochgan yoki ruxsat berilgan orderlar
- order ichidagi tasks
- planned parts
- order assignments
- order status
- order extra charges

### Tasdiqlaydi

- order yakuniy approval
- qo‘shimcha ish yoki qo‘shimcha charge bo‘yicha klient bilan kelishuvdan keyin tasdiq

### Qila olmaydi

- staff yaratmaydi
- system settings o‘zgartirmaydi
- audit logni tahrir qilmaydi

## 3. Worker

`worker` bu ishni bajaradigan usta yoki technician.

### Ko‘ra oladi

- o‘ziga biriktirilgan orderlar
- o‘ziga biriktirilgan tasklar
- taskga tegishli planned parts
- taskga tegishli actual parts
- kerakli inventory mavjudligini

### Qiladi

- taskni qabul qiladi
- task statusini o‘zgartiradi
- ishni boshlaydi
- ishni tugatadi
- actual ishlatilgan partsni kiritadi
- kerak bo‘lsa qo‘shimcha task kerakligini bildiradi
- orderni keyingi ustaga yoki service bosqichiga o‘tkazish zaruratini bildiradi

### Cheklovlar

- odatda yangi client yaratmaydi
- order ochmaydi
- payment qabul qilmaydi
- expense category yaratmaydi
- staff va settings bilan ishlamaydi

## 4. Cashier

`cashier` to‘lov bilan ishlaydigan rol.

### Ko‘ra oladi

- payment kutayotgan orders
- order financials
- client basic info
- payment history

### Qiladi

- payment qabul qiladi
- payment record yaratadi
- qisman yoki to‘liq to‘lovni kiritadi

### Cheklovlar

- task yaratmaydi
- order workflow’ni boshqarmaydi
- inventory ni tahrir qilmaydi
- staff boshqarmaydi

## 5. Viewer

`viewer` bu faqat kuzatuvchi rol.

### Ko‘ra oladi

- dashboard
- orders list
- order detail
- clients
- assets
- basic reports

### Qila olmaydi

- create
- update
- delete
- approve
- payment qabul qilish

## Muhim permission qoidalari

### Client va asset

- `admin`, `manager` create qila oladi
- `worker` odatda create qilmaydi
- `viewer` faqat ko‘radi

### Order yaratish

- `manager` yaratadi
- `admin` ham yaratishi mumkin
- `worker`, `cashier`, `viewer` yaratmaydi

### Tasklar bilan ishlash

- `manager` task yaratadi va biriktiradi
- `worker` o‘z taskini bajaradi
- `admin` hammasini ko‘ra oladi

### Planned parts

- `manager` create qiladi
- `worker` ko‘radi va kerak bo‘lsa yangilash taklifi beradi
- `admin` nazorat qiladi

### Actual parts

- `worker` kiritadi
- `manager` ko‘radi va tekshiradi
- `admin` nazorat qiladi

### Inventory

- `admin` to‘liq nazorat
- `manager` qoldiqni ko‘radi
- `worker` kerakli darajada ko‘radi
- `cashier` odatda tahrir qilmaydi

### Approvals

- `manager` approve qiladi
- `admin` ham approve qilishi mumkin
- `worker` approve qilmaydi

### Payments

- `cashier` create qiladi
- `manager` ba’zi bizneslarda create qilishi mumkin
- `worker` create qilmaydi
- `viewer` faqat ko‘radi

## MVP uchun amaliy tavsiya

Agar productni tezroq boshlamoqchi bo‘lsangiz, birinchi bosqichda quyidagi permission modeli yetadi:

- `admin`
  - full access

- `manager`
  - clients, assets, orders, tasks, planned parts, assignments, extra charges, approvals

- `worker`
  - assigned tasks, actual parts, task status update

- `cashier`
  - payments only

- `viewer`
  - read only

## Keyin kuchaytirish mumkin bo‘lgan joylar

Keyinroq permission tizimi yanada chuqurlashishi mumkin:

- branch-level permissions
- faqat o‘z branchidagi orderlarni ko‘rish
- faqat o‘ziga biriktirilgan tasklarni ko‘rish
- finance ko‘rish huquqini alohida ajratish
- inventory write permission’ni alohida ajratish
- approval huquqini role emas, permission orqali boshqarish

## Qisqa xulosa

Hozirgi tizim uchun eng muhim rollar:

- `admin`
- `manager`
- `worker`

Qo‘shimcha lekin foydali rollar:

- `cashier`
- `viewer`

Bu hujjatning asosiy g‘oyasi:

`manager boshqaradi, worker bajaradi, cashier to‘lov oladi, admin nazorat qiladi`
