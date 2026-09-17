# StudyMate AI

مساعد مذاكرة عربي يحول صور صفحات المنهج إلى محتوى مقروء، مذكرة مبسطة، PDF، وبنك أسئلة.

## التشغيل المحلي

```bash
npm install
cp .env.example .env
npm run dev
```

للاستخدام الكامل محليًا، شغّل في طرفية أخرى:

```bash
npm start
```

> في التطوير، Vite يوفر `/api` proxy إلى السيرفر على 3000.

## متغيرات البيئة

ضعها في `.env` محليًا أو في Secrets على Railway:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` — مثال مجاني قابل للتغيير: `google/gemma-3-27b-it:free`

**لا تضع OPENROUTER_API_KEY في VITE_ ولا ترفعه إلى GitHub.**

## Supabase

نفّذ `supabase/schema.sql` من SQL Editor.

ثم من Authentication > URL Configuration أضف رابط الموقع الذي تستضيف عليه التطبيق.

## Railway

- ارفع المشروع إلى GitHub.
- أنشئ خدمة من المستودع.
- أضف Environment Variables نفسها.
- Build command: `npm run build`
- Start command: `npm start`

السيرفر يخدم مجلد `dist` بعد البناء.

## ملاحظات النسخة الأولى

- قراءة الصفحات وفحص الفشل تتم عبر Vision model في OpenRouter.
- الصفحة التي تفشل لا تدخل في النص المصدر الذي يُستخدم لإنشاء المذكرة والأسئلة.
- 8 أسئلة اختيار من متعدد كحد أدنى في كل واجب.
- النتائج الحالية والـUI cache محفوظة محليًا في المتصفح؛ جداول Supabase موجودة لتوصيل التخزين الدائم في المرحلة التالية.
- PDF الحالي يدعم العربية بشكل أساسي على مستوى المحتوى، لكن دعم خطوط عربية مضمّنة بشكل احترافي يحتاج إضافة ملف خط TTF عربي للمشروع؛ لذلك يفضل إضافة خط عربي مضمّن قبل الاعتماد على PDF للطباعة الرسمية.
