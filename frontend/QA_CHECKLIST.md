# Frontend QA Checklist

## Ishga tushirish

- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:3000/api/health`
- Swagger: `http://127.0.0.1:3000/api/docs`

## Login

- Login sahifasi ochilsin.
- `Dark/Light` toggle ishlasin.
- Login sahifasida faqat `login` va `parol` maydoni bo'lsin.
- Noto'g'ri login bilan xato matni chiqsin.
- To'g'ri login bilan kerakli default sahifaga o'tsin.
- `Meni eslab qol` yoqilgan/o'chirilgan holatda sessiya xulqi to'g'ri bo'lsin.

## Dashboard

- Yuqori kartalar va statistikalar render bo'lsin.
- `Yangilash` tugmasi ishlasin.
- `Top qarzdorlar` bo'limidagi link `Payments`ga olib borsin.
- `Jarayondagi ishlar` kartasi `Orders`ga o'tsin.
- `Tezkor harakatlar` kartalari ishlasin.
- Admin user bo'lsa `Firmalar` va `Jamoa` tablari ishlasin.

## Orders

- `Faol ishlar` va `Topshirilganlar` tablari almashsin.
- `Firma` va `Filial` filtrlari ishlasin.
- `Qabul`, `Jarayonda`, `Tayyor` chip filterlari ishlasin.
- Zakaz kartasini bosganda detail sahifaga o'tsin.
- `+ Yangi zakaz` orqali create form ochilsin.

## Create Order

- Mijoz ismi bo'sh bo'lsa validation chiqsin.
- Filial tanlanmasa saqlash bloklansin.
- Brand chiplar ishlasin.
- Muammo chiplar tanlanib/yechilsin.
- Zakaz saqlangach ro'yxatga qaytsin va yangi item ko'rinsin.

## Order Detail

- Hero, summary va workflow step'lar chiqsin.
- Status o'zgartirish formasi ishlasin.
- Intake note va diagnosis saqlansin.
- Ish qo'shish ishlasin.
- Detal biriktirish ishlasin.
- Assignment yaratish ishlasin.
- Approval yaratish ishlasin.
- To'lov qo'shish ishlasin.
- Status history va payments list to'g'ri ko'rinsin.

## Payments

- `Qarzdorlar` va `Chiqimlar` tablari ishlasin.
- Jami qarz kartasi to'g'ri hisoblansin.
- Qarzdor uchun to'lov formasi ochilsin/yopilsin.
- To'lov saqlangach qarz summasi yangilansin.
- Chiqim davr filtrlari ishlasin.
- Yangi chiqim qo'shish formasi ishlasin.

## Inventory

- Hero va summary bloklari render bo'lsin.
- `Firma`, `Filial`, `Qidiruv` ishlasin.
- Mahsulot qo'shish ishlasin.
- Harakat yozish ishlasin.
- `Qo'shimcha maydonlarni ochish` tugmasi ishlasin.
- Kam qolgan mahsulotlar warning kartasi bilan ko'rinsin.
- So'nggi harakatlar tarixi ko'rinsin.

## Responsive

- Desktopda sidebar va keng panel ko'rinsin.
- Mobile width'da bottom nav ishlasin.
- Formlar kichik ekranda sinib ketmasin.
- Modal va dialoglar ekrandan tashqariga chiqmasin.

## Permission

- `viewer` rolda faqat ko'rish mumkin bo'lsin.
- `cashier` rolda to'lov bo'limlari ishlasin.
- `worker` rolda cheklangan sahifalar yashirilsin.
- `platform admin` rolda admin boshqaruv bloklari chiqsin.

## Yakuniy tekshiruv

- Console error bo'lmasin.
- Network requestlar mantiqiy javob qaytarsin.
- `npm run lint` va `npm run build` yashil bo'lsin.
