import "dotenv/config";
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

// دالة الاتصال بـ OpenRouter API مع قائمة موسعة من الموديلات المجانية الاحتياطية
async function callOpenRouterAPI(messages, temperature = 0.2) {
  // قائمة شاملة من الموديلات المجانية لضمان الاستمرارية وعدم التوقف
  const rawModels = [
    process.env.OPENROUTER_MODEL?.trim(),
    "meta-llama/llama-3.2-11b-vision-instruct:free",
    "qwen/qwen-2-vl-7b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-2.0-pro-exp-02-05:free",
    "google/gemini-2.0-flash-thinking-exp:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen-2.5-coder-32b-instruct:free",
    "mistralai/mistral-small-24b-instruct-2501:free",
    "nvidia/llama-3.1-nemotron-70b-instruct:free"
  ];

  // تصفية القيم الفارغة وحذف المكرر
  const models = [...new Set(rawModels.filter(Boolean))];

  let lastError = null;

  for (const model of models) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY.trim()}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://railway.app",
          "X-Title": "StudyMate AI"
        },
        body: JSON.stringify({
          model: model,
          messages,
          temperature,
          max_tokens: 4000
        })
      });

      const data = await response.json();
      
      if (response.ok && data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }

      lastError = data?.error?.message || `HTTP ${response.status} on model ${model}`;
      console.warn(`[OpenRouter Fallback] فشل الموديل ${model}: ${lastError}. تجربة الموديل التالي...`);
    } catch (e) {
      lastError = e.message;
      console.warn(`[OpenRouter Fallback] خطأ شبكة مع ${model}: ${lastError}. تجربة الموديل التالي...`);
    }
  }

  throw new Error(`فشلت جميع الموديلات المتاحة. آخر خطأ: ${lastError}`);
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

    const prompt = `استخرج كل النصوص والعناوين والأسئلة الموجودة في هذه الصورة باللغة العربية بوضوح.`;

    try {
      const content = await callOpenRouterAPI([
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mime};base64,${file.buffer.toString("base64")}` } }
          ]
        }
      ], 0.1);

      let extractedText = content || "";
      let title = `صفحة ${i + 1}`;

      try {
        const parsed = JSON.parse(cleanJson(content));
        if (parsed.text) extractedText = parsed.text;
        if (parsed.title) title = parsed.title;
      } catch {
        // نص عادي
      }

      const hasContent = Boolean(extractedText && extractedText.trim().length > 0);

      pages.push({
        page: i + 1,
        status: hasContent ? "ok" : "failed",
        title: title,
        confidence: hasContent ? 90 : 0,
        text: hasContent ? extractedText : "",
        reason: hasContent ? null : "لم يتم استخراج أي نص من الصورة."
      });
    } catch (e) {
      console.error(`ERROR ON PAGE ${i + 1}:`, e.message);
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

المصدر:
${sourceText}`;

  try {
    const content = await callOpenRouterAPI([{ role: "user", content: prompt }], 0.25);
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
  const targetTypes = remaining > 0 ? "وزّع الباقي بين أكمل، صح/خطأ، سؤال قصير، ومقالي عند ملاءمة المادة." : "";

  const prompt = `أنشئ بنك أسئلة للثانوية العامة اعتماداً على المصدر التالي فقط.
المادة: ${subject || "غير محددة"}
العدد المطلوب: ${n}
الصعوبة: ${difficulty}
عدد الاختيار من متعدد: ${mcq}، والباقي: ${targetTypes}

أخرج JSON فقط:
{"questions":[
 {"type":"mcq","question":"...","options":["أ","ب","ج","د"],"answer":"أ","explanation":"...","topic":"..."},
 {"type":"fill","question":"...","answer":"...","explanation":"...","topic":"..."},
 {"type":"true_false","question":"...","answer":true,"explanation":"...","topic":"..."},
 {"type":"short","question":"...","answer":"...","explanation":"...","topic":"..."},
 {"type":"essay","question":"...","answer":"نقاط التصحيح المتوقعة...","explanation":"...","topic":"..."}
]}

المصدر:
${sourceText}`;

  try {
    const content = await callOpenRouterAPI([{ role: "user", content: prompt }], 0.35);
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

// استقبال البورت تلقائياً من بيئة تشغيل Railway أو استخدام 8080 افتراضياً
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`StudyMate AI running on port ${port}`);
});
