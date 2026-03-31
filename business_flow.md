# Business Flow

Bu hujjat servis biznesidagi asosiy ish jarayonini sodda va amaliy ko‘rinishda tushuntiradi. Hozirgi asosiy niche auto service bo‘lsa ham, flow universal service modelga mos yozilgan.

## Asosiy maqsad

Tizim quyidagilarni boshqaradi:

- mijozni qabul qilish
- servis obyektini ro‘yxatdan o‘tkazish
- order yaratish
- ishlarni tasklarga bo‘lish
- ustalarga biriktirish
- ombordan kerakli parts/materiallarni kuzatish
- qo‘shimcha charge va xarajatlarni kiritish
- orderni tasdiqlash, to‘lovni olish va topshirishni yakunlash

## Asosiy rollar

- `admin`
  - hamma narsani ko‘radi
  - staff va umumiy nazorat bilan ishlaydi

- `manager`
  - mijozni qabul qiladi
  - order ochadi
  - tasklar yaratadi
  - orderni ustaga biriktiradi
  - estimate beradi
  - yakunda orderni tasdiqlaydi

- `worker`
  - o‘ziga biriktirilgan tasklarni bajaradi
  - kerak bo‘lsa parts ishlatadi
  - qo‘shimcha ish yoki qo‘shimcha charge zaruratini bildiradi
  - taskni tugatadi yoki boshqa ustaga/hizmatga o‘tkazadi

- `cashier`
  - to‘lovni qabul qiladi
  - payment yozuvini kiritadi

- `viewer`
  - faqat ko‘radi

## Umumiy flow

### 1. Mijozni qabul qilish

- mijoz servisga keladi
- manager muammoni eshitadi
- mijoz oldin bazada bormi, tekshiradi
- bo‘lmasa yangi `client` yaratiladi

### 2. Assetni aniqlash

- manager servis qilinadigan obyektni topadi yoki yaratadi
- auto service bo‘lsa:
  - `assets` da umumiy record yaratiladi
  - `vehicle_profiles` da mashina tafsilotlari saqlanadi

### 3. Dastlabki baholash

- manager mijoz muammosini yozadi
- taxminiy ishlar ro‘yxatini tuzadi
- taxminiy narxni aytadi
- mijoz rozi bo‘lsa order ochiladi

### 4. Order yaratish

- `orders` da yangi order yaratiladi
- order:
  - organization
  - branch
  - client
  - asset
  - manager
  bilan bog‘lanadi

### 5. Tasklarga bo‘lish

- manager order ichida alohida ishlarni yaratadi
- har bir ish `order_tasks` ga yoziladi

Misollar:
- diagnostika
- moy almashtirish
- tormozni tekshirish
- elektr ishlari

### 6. Parts va materiallarni rejalash

- manager yoki worker har bir task uchun kerak bo‘ladigan parts/materiallarni belgilaydi
- buning uchun `planned_parts` ishlatiladi

Bu bosqichda:
- omborda bor narsalar ham yozilishi mumkin
- hali omborda yo‘q narsalar ham yozilishi mumkin

### 7. Omborni tekshirish

- system yoki manager `inventory_stocks` orqali qaysi part borligini ko‘radi
- agar part bor bo‘lsa:
  - uni reserve qilish yoki keyin usage qilish mumkin
- agar part yo‘q bo‘lsa:
  - task `waiting_parts` holatiga o‘tishi mumkin

### 8. Ustaga biriktirish

- manager orderni yoki taskni ustaga beradi
- bu jarayon `order_assignments` da tarix bo‘lib saqlanadi

Bu yerda quyidagilar ko‘rinadi:
- kim topshirdi
- kimga topshirildi
- qachon topshirildi
- qachon qabul qilindi

### 9. Ishni bajarish

- worker taskni qabul qiladi
- ishni boshlaydi
- kerak bo‘lsa ombordan part oladi
- haqiqatan ishlatilgan parts `order_task_parts` ga yoziladi
- stock harakati `stock_movements` da aks etadi

### 10. Qo‘shimcha ish yoki qo‘shimcha charge

- agar ish davomida yangi muammo chiqsa:
  - yangi task qo‘shilishi mumkin

- agar klientga qo‘shimcha summa yozilishi kerak bo‘lsa:
  - `order_extra_charges` ga yoziladi

Muhim farq:
- `order_extra_charges` = klientga yoziladigan qo‘shimcha summa
- `expenses` = biznesning ichki xarajati

### 11. Boshqa ustaga yoki boshqa service bosqichiga o‘tkazish

- agar ish keyingi yo‘nalishga o‘tsa:
  - yangi `order_assignments` yozuvi yaratiladi

Masalan:
- diagnostikadan elektr ustaga
- elektr ustadan motor ustaga
- motor ustadan final tekshiruvga

### 12. Statuslarni yuritish

- orderning umumiy holati `orders.status` da turadi
- tarix esa `order_status_history` da saqlanadi

Masalan:
- `new`
- `approved`
- `in_progress`
- `waiting_parts`
- `completed`
- `delivered`

Tasklarning o‘z statusi esa `order_tasks.status` da yuradi.

### 13. Ishni tugatish

- worker o‘z tasklarini tugatadi
- order tayyor bo‘lsa umumiy order `completed` holatiga yaqinlashadi
- agar manager tasdig‘i kerak bo‘lsa approval ochiladi

### 14. Manager tasdig‘i

- yakuniy tekshiruv yoki release approval `order_approvals` orqali yuradi
- manager:
  - approve qilishi mumkin
  - reject qilib qayta ishga yuborishi mumkin

### 15. Mijozga xabar berish

- order tayyor bo‘lganda mijozga xabar yuborilishi mumkin
- hozircha bu process biznes flow’da bor
- keyin alohida notification moduli qo‘shilishi mumkin

### 16. To‘lov

- mijoz keladi
- cashier yoki manager payment qabul qiladi
- `payments` jadvaliga yoziladi

To‘lov:
- to‘liq bo‘lishi mumkin
- bo‘lib-bo‘lib bo‘lishi mumkin

### 17. Orderni yopish va topshirish

- payment olingach yoki kerakli qoidaga ko‘ra order yakunlanadi
- asset mijozga topshiriladi
- order `delivered` statusiga o‘tadi

## Mijoz ko‘ra oladigan jarayon

Kelajakda mijoz quyidagilarni ko‘ra olishi mumkin:

- order qabul qilinganini
- qaysi bosqichda turganini
- qaysi ustaga biriktirilganini
- qaysi parts ishlatilganini
- qo‘shimcha summa qo‘shilganini
- order tayyor bo‘lganini

## Universal service uchun mosligi

Bu flow faqat auto service uchun emas.

Bir xil mantiq quyidagilarga ham mos:

- phone repair
- computer repair
- appliance repair
- boshqa servis markazlari

Faqat asset profili o‘zgaradi:

- auto service: `vehicle_profiles`
- phone repair: keyin `device_profiles`
- computer repair: keyin `computer_profiles`
- appliance repair: keyin `appliance_profiles`

## Qisqa xulosa

Bu tizimning yuragi:

- `clients`
- `assets`
- `orders`
- `order_tasks`
- `planned_parts`
- `order_task_parts`
- `order_assignments`
- `order_status_history`
- `order_approvals`
- `payments`

Ya’ni bu systemning asosiy g‘oyasi:

`mijoz -> asset -> order -> tasklar -> parts -> approval -> payment -> topshirish`
