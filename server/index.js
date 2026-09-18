import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY?.trim();
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.0-flash-exp:free";

// 1. حل مشكلة Cannot GET /
app.get('/', (req, res) => {
  res.status(200).send('<h1>StudyMate AI Backend is Live! 🚀</h1><p>OCR API Endpoint: <code>POST /api/ocr</code></p>');
});

function cleanJson(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("JSON Parsing Error:", e, "Raw text:", text);
    throw new Error("فشل في تنسيق الاستجابة إلى JSON صالح.");
  }
}

async function callVisionAPI(messages) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("لم يتم العثور على OPENROUTER_API_KEY في متغيرات البيئة.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://railway.app",
      "X-Title": "StudyMate AI"
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: messages,
      temperature: 0.1,
      max_tokens: 4000
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "فشل الاتصال بـ OpenRouter API.");
  }

  return data?.choices?.[0]?.message?.content || "";
}

app.post('/api/ocr', async (req, res) => {
  try {
    const { imageBase64, prompt } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ status: 'failed', error: 'لم يتم إرسال الصورة.' });
    }

    const formattedImage = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:image/jpeg;base64,${imageBase64}`;

    const systemPrompt = prompt || `قم باستخراج كافة النصوص الأكاديمية العربية والأشكال من هذه الصورة بدقة عالية ورتبها في صيغة JSON تحتوي على الأقسام والأسئلة.`;

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: systemPrompt },
          { type: "image_url", image_url: { url: formattedImage } }
        ]
      }
    ];

    const rawResponse = await callVisionAPI(messages);
    const parsedData = cleanJson(rawResponse);

    return res.json({ status: 'ok', data: parsedData });

  } catch (error) {
    console.error("OCR Route Error:", error.message);
    return res.status(500).json({ status: 'failed', error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
