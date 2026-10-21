# 🚀 التحويل من Google Sheets إلى Neon (PostgreSQL) — CRM v5.4

## الملفات
| الملف | الوظيفة |
|---|---|
| `server.js` | السيرفر الكامل (Node.js + Express + pg) — نفس الـ API بتاع Apps Script |
| `schema.sql` | إنشاء كل الجداول في Neon (يُشغّل مرة واحدة) |
| `package.json` | اعتماديات السيرفر |
| `crm-v5.4-neon.html` | الفرونت إند (نفس النظام، متصل بالسيرفر الجديد) |

---

## الخطوة 1: إنشاء قاعدة بيانات Neon
1. ادخل على https://neon.tech وسجّل حساب (مجاني).
2. Create Project → اختر Region قريب (مثلاً `eu-central-1`).
3. افتح **SQL Editor** والصق محتوى ملف `schema.sql` كله واضغط **Run**.
   - هيتعمل كل الجداول + أول حساب دخول:
     - **اسم المستخدم:** `admin` — **كلمة المرور:** `123456` (مدير فني — غيّرها فوراً من لوحة الموظفين)

## الخطوة 2: تشغيل السيرفر
### على جهازك للتجربة:
```bash
npm install
export DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx.ap-southeast-1.aws.neon.tech/DBNAME?sslmode=require"
node server.js
```
> خد الـ Connection String من Neon: Dashboard → Connect → "Node.js"

### على استضافة (مستحسن للإنتاج — مجاني):
- **Render** أو **Railway**: اعمل Web Service من الريبو، وحط `DATABASE_URL` في Environment Variables، والـ Start Command: `node server.js`.
- بعد النشر هتحصل على رابط زي: `https://crm-api.onrender.com`

## الخطوة 3: ربط التطبيق
1. افتح `crm-v5.4-neon.html` وارفعه على أي استضافة ملفات (Netlify / GitHub Pages / Vercel — حتى Google Sites).
2. من **شاشة الدخول** حط رابط السيرفر في الخانة الجديدة (مثلاً `https://crm-api.onrender.com/api`) — بيتحفظ تلقائياً في المتصفح.
3. سجّل دخول بـ `admin` / `123456`.

---

## 📦 نقل البيانات الحالية من Google Sheets (اختياري)
لو عايز تنقل العملاء والبرامج الموجودين:
1. في Google Sheets: File → Download → **CSV** لكل ورقة (Users, Clients, OmraPrograms, TurkeyPrograms, AdminNotes, Programs, TripRequests).
2. رفعها على Neon أسرع طريقة: من Neon Dashboard → Tables → Import (يدعم CSV)، مع مراعاة أسماء الأعمدة في `schema.sql`:
   - Clients بالترتيب: id, agent_code, agent_name, name, phone, address, members, program_category, program_name, turkey_sub_name, price, status, postpone_date, is_followup, followup_date, followup_day, created_date, fb1, fb2, paid_amount, payment_notes, reviewed_by_followup, last_modified_by_role, program_id, trip_details(JSON), fb3, followup_time, reviewed_by, supervisor_note
   - أو ابعتلي ملفات الـ CSV وهجهزلك ملف SQL جاهز للاستيراد.
3. التواريخ لازم تكون بصيغة `yyyy-MM-dd` والأوقات `HH:mm`.

## ✅ المميزات بعد التحويل
- نفس كل المميزات الحالية بدون أي تغيير في الاستخدام (تسجيل، صلاحيات، نقل جماعي، طلبات التعديل، الأسهم... إلخ).
- أداء أسرع بكثير مع آلاف العملاء (Indexes جاهزة).
- قفل transactions حقيقي (`pg_advisory_lock`) زي Google Lock بالظبط — منع تضارب الحفظ.
- لو حابب تضيف API Key لحماية السيرفر بعدين، قوللي وأضيفه.

## 🔒 ملاحظة أمان
كلمات المرور حالياً متخزنة نص عادي (زي نظام الشيتات بالظبط). لو عايز تشفير bcrypt للكلمات، أقدر أضيفه كتحديث منفصل.
