Import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 60, fileSize: 12 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: "4mb" }));

function requireKey(res) {
  if (!process.env.OPENROUTER_API_KEY) {
    res.status(500).json({ error: "API Key غير موجود في متغيرات البيئة." });
    return false;
  }
  return true;
}

function cleanJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const first = Math.min(...[candidate.indexOf("{"), candidate.indexOf("[")].filter(x => x >= 0));
  if (Number.isFinite(first)) return candidate.slice(first);
  return candidate;
}

// تعديل الاتصال ليكون بـ Groq API مباشرة
async function callGroqAPI(messages, temperature = 0.2, isVision = false) {
  // اختيار الموديل المناسب بناءً على هل الطلب صورة أم نص
  const model = isVision 
    ? "llama-3.2-11b-vision-preview" 
    : "llama-3.3-70b-versatile";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages,
      temperature,
      max_tokens: 4000
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const msg = data?.error?.message || `Groq API error ${response.status}`;
    throw new Error(msg);
  }
  return data?.choices?.[0]?.message?.content || "";
}

app.post("/api/analyze-images", upload.array("pages", 60), async (req, res) => {
  if (!requireKey(res)) return;
  if (!req.files?.length) return res.status(400).json({ error: "لم يتم إرسال صور." });

  const pages = [];
  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    const mime = file.mimetype || "image/jpeg";
    if (!mime.startsWith("image/")) {
      pages.push({ page: i + 1, status: "failed", title: null, reason: "الملف ليس صورة." });
      continue;
    }

    const prompt = `أنت قارئ صفحات كتب دراسية. افحص الصفحة رقم ${i + 1}.
أعد JSON فقط بهذا الشكل:
{
 "status":"ok" أو "failed",
 "title":"عنوان الصفحة إن أمكن، وإلا null",
 "confidence":0-100,
 "text":"النص المقروء والمنظم بدقة، أو فارغ عند الفشل",
 "reason":"سبب الفشل بالعربية أو null"
}
قواعد صارمة:
- لا تخمّن الكلمات المطموسة أو غير المقروءة.
- إذا كانت الصورة ضبابية/مقصوصة/منعكسة/محتواها غير مقروء بما يكفي، status=failed.
- لا تضف أي معلومة غير موجودة في الصورة.
- حافظ على القوانين والمصطلحات والأرقام كما تظهر.
- لا تكتب شرحاً؛ المطلوب استخراج الصفحة فقط.`;

    try {
      const content = await callGroqAPI([
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mime};base64,${file.buffer.toString("base64")}` } }
          ]
        }
      ], 0.1, true); // true تعني استخدام موديل الصور

      let parsed;
      try { parsed = JSON.parse(cleanJson(content)); } catch {
        parsed = { status: "failed", title: null, confidence: 0, text: "", reason: "تعذر تحليل استجابة الذكاء الاصطناعي." };
      }
      pages.push({
        page: i + 1,
        status: parsed.status === "ok" ? "ok" : "failed",
        title: parsed.title || null,
        confidence: Number(parsed.confidence || 0),
        text: parsed.status === "ok" ? String(parsed.text || "") : "",
        reason: parsed.status === "ok" ? null : (parsed.reason || "لم يتمكن النظام من فهم الصفحة.")
      });
    } catch (e) {
      pages.push({ page: i + 1, status: "failed", title: null, confidence: 0, text: "", reason: e.message });
    }
  }

  res.json({ pages });
});

app.post("/api/generate-note", async (req, res) => {
  if (!requireKey(res)) return;
  const { subject, lessonTitle, sourceText } = req.body || {};
  if (!sourceText?.trim()) return res.status(400).json({ error: "لا يوجد محتوى صالح لإنشاء المذكرة." });

  const prompt = `أنت مدرس محترف للمرحلة الثانوية. أنشئ مذكرة عربية واضحة اعتماداً على المصدر فقط.
المادة: ${subject || "غير محددة"}
عنوان الدرس: ${lessonTitle || "غير محدد"}

أخرج JSON فقط:
{
 "title":"عنوان مناسب",
 "summary":"ملخص قصير",
 "sections":[
   {"heading":"...", "body":"شرح مبسط...", "bullets":["..."], "formula":"..." }
 ],
 "examples":[
   {"title":"مثال واقعي أو تطبيقي مناسب","body":"...","source":"من المصدر أو مثال توضيحي"}
 ],
 "keyPoints":["..."],
 "reviewQuestions":["..."]
}

قواعد:
- لا تخترع حقائق أو قوانين غير موجودة في المصدر.
- يجوز مثال توضيحي عام فقط إذا كان صحيحاً ومفيداً، واجعله واضحاً أنه مثال توضيحي.
- لا تغير معنى القوانين.
- اشرح ببساطة مع الحفاظ على المصطلحات العلمية.
- لا تستخدم Markdown داخل JSON.
المصدر:
${sourceText}`;

  try {
    const content = await callGroqAPI([{ role: "user", content: prompt }], 0.25, false);
    res.json(JSON.parse(cleanJson(content)));
  } catch (e) {
    res.status(502).json({ error: e.message || "فشل إنشاء المذكرة." });
  }
});

app.post("/api/generate-questions", async (req, res) => {
  if (!requireKey(res)) return;
  const { subject, sourceText, count = 20, difficulty = "mixed" } = req.body || {};
  const n = Math.max(8, Math.min(100, Number(count) || 20));
  if (!sourceText?.trim()) return res.status(400).json({ error: "لا يوجد محتوى صالح لإنشاء الأسئلة." });

  const mcq = Math.min(n, Math.max(8, Math.round(n * 0.4)));
  const remaining = n - mcq;
  const targetTypes = remaining > 0 ? "وزّع الباقي بين أكمل، صح/خطأ، سؤال قصير، ومقالي عند ملاءمة المادة. لا تجبر المقال إذا لم يكن مناسباً." : "";

  const prompt = `أنشئ بنك أسئلة للثانوية العامة اعتماداً على المصدر التالي فقط.
المادة: ${subject || "غير محددة"}
العدد المطلوب: ${n}
الصعوبة: ${difficulty}
يجب أن يكون هناك ${mcq} سؤال اختيار من متعدد على الأقل (وبالضبط ${mcq} إن أمكن)، والباقي: ${targetTypes}

أخرج JSON فقط:
{"questions":[
 {"type":"mcq","question":"...","options":["أ","ب","ج","د"],"answer":"أ","explanation":"...","topic":"..."},
 {"type":"fill","question":"...","answer":"...","explanation":"...","topic":"..."},
 {"type":"true_false","question":"...","answer":true,"explanation":"...","topic":"..."},
 {"type":"short","question":"...","answer":"...","explanation":"...","topic":"..."},
 {"type":"essay","question":"...","answer":"نقاط التصحيح المتوقعة...","explanation":"...","topic":"..."}
]}

قواعد:
- لا تسأل عن معلومة غير موجودة في المصدر.
- الاختيارات يجب أن تكون معقولة، وإجابة واحدة صحيحة بوضوح.
- لا تكرر نفس الفكرة بشكل كسول.
- اكتب بالعربية الواضحة.
- لا تستخدم Markdown داخل JSON.
- إذا لم توجد مادة كافية لنوع معين، استخدم نوعاً آخر مناسباً.
المصدر:
${sourceText}`;

  try {
    const content = await callGroqAPI([{ role: "user", content: prompt }], 0.35, false);
    const parsed = JSON.parse(cleanJson(content));
    res.json({ questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, n) : [] });
  } catch (e) {
    res.status(502).json({ error: e.message || "فشل إنشاء الأسئلة." });
  }
});

app.use(express.static(path.join(__dirname, "..", "dist")));
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`StudyMate AI running on port ${port}`));
