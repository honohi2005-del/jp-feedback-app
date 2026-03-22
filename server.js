import "dotenv/config";
import express from "express";

const app = express();
const PORT = process.env.PORT || 8787;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.use(express.json({ limit: "1mb" }));

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON format." });
  }
  return next(error);
});

const H_GOOD = "\u3010\u826f\u3044\u70b9\u3011";
const H_FIX = "\u3010\u6587\u6cd5\u30fb\u8868\u73fe\u306e\u4fee\u6b63\u3011";
const H_CONTENT = "\u3010\u5185\u5bb9\u30fb\u69cb\u6210\u3078\u306e\u30b3\u30e1\u30f3\u30c8\u3011";
const H_GRADE = "\u3010\u7dcf\u5408\u8a55\u4fa1\u3011";

const normalizeText = (text) =>
  (text || "")
    .replace(/\s+/g, "")
    .replace(/[\u3002\u3001\u300c\u300d\u300e\u300f\uff08\uff09()・,，.．]/g, "")
    .toLowerCase()
    .trim();

const sameText = (a, b) => normalizeText(a) === normalizeText(b);

const splitSentences = (text) => {
  const chunks = (text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((line) => line.match(/[^。！？!?]+[。！？!?]?/g) || []);
  const out = chunks.map((s) => s.trim()).filter(Boolean);
  return out.length > 0 ? out : [text.trim()];
};

function formatFeedback(meta, corrections) {
  const goodPoints = Array.isArray(meta?.good_points) ? meta.good_points.slice(0, 3) : [];
  const contentComment = String(meta?.content_comment || "").trim();
  const grade = ["A", "B", "C"].includes(String(meta?.grade || "").trim())
    ? String(meta.grade).trim()
    : "B";
  const gradeReason =
    String(meta?.grade_reason || "").trim() || "改善の余地はありますが、内容は伝わっています。";

  const goodBlock =
    goodPoints.length > 0
      ? goodPoints.map((p, i) => `${i + 1}. ${String(p).trim()}`).join("\n")
      : "1. 主題が明確です。\n2. 体験が具体的に書けています。";

  const fixBlock =
    corrections.length > 0
      ? corrections
          .map(
            (c) =>
              `- 誤: ${String(c.wrong).trim()}\n  正: ${String(c.correct).trim()}\n  理由: ${String(
                c.reason || "自然な日本語にするため。"
              ).trim()}`
          )
          .join("\n")
      : "- 誤: 表現が不自然な箇所\n  正: 自然な表現へ調整\n  理由: 読みやすくするため。";

  return `${H_GOOD}
${goodBlock}

${H_FIX}
${fixBlock}

${H_CONTENT}
${contentComment || "内容は伝わります。後半の文同士のつながりを整えると、さらに読みやすくなります。"}

${H_GRADE}
${grade}: ${gradeReason}`;
}

async function callGroq({ messages, json = false }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.error?.message || "Groq API error.");
    err.status = response.status;
    throw err;
  }

  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!json) return content;
  try {
    return JSON.parse(content || "{}");
  } catch {
    const err = new Error("Failed to parse structured model output.");
    err.status = 502;
    throw err;
  }
}

async function rewriteSentenceBySentence(original) {
  const sentences = splitSentences(original);
  const payload = JSON.stringify(sentences, null, 2);

  const result = await callGroq({
    json: true,
    messages: [
      {
        role: "system",
        content:
          "You are a Japanese language teacher. Return JSON only. Rewrite every sentence naturally while keeping meaning."
      },
      {
        role: "user",
        content: `Input is a JSON array of sentences in order.
Return this JSON schema:
{
  "revised_sentences": ["..."],
  "reasons": ["..."]
}
Rules:
- revised_sentences must have exactly the same number of items as input.
- Each revised_sentences[i] must correspond to input[i], preserving meaning.
- Review all sentences, including later sentences.
- reasons must also have same length and explain each revision in Japanese briefly.
- Output JSON only.

input_sentences:
${payload}`
      }
    ]
  });

  const revised = Array.isArray(result?.revised_sentences) ? result.revised_sentences : [];
  const reasons = Array.isArray(result?.reasons) ? result.reasons : [];
  if (revised.length !== sentences.length) {
    const err = new Error("Sentence rewrite alignment failed.");
    err.status = 502;
    throw err;
  }

  const normalizedRevised = revised.map((s, i) => {
    const text = String(s || "").trim();
    return text || sentences[i];
  });
  const normalizedReasons = sentences.map((_, i) =>
    String(reasons[i] || "文法・語順を自然な日本語に調整しました。").trim()
  );

  const revisedComposition = normalizedRevised.join("");
  return { originalSentences: sentences, revisedSentences: normalizedRevised, reasons: normalizedReasons, revisedComposition };
}

function buildCorrectionsFromSentenceDiff({ originalSentences, revisedSentences, reasons }) {
  const corrections = [];
  for (let i = 0; i < originalSentences.length; i += 1) {
    const wrong = originalSentences[i];
    const correct = revisedSentences[i];
    if (!sameText(wrong, correct)) {
      corrections.push({ wrong, correct, reason: reasons[i] });
    }
  }
  return corrections;
}

async function generateMetaFeedback(original, revised, corrections) {
  const correctionSummary = corrections.slice(0, 8).map((c) => ({
    wrong: c.wrong,
    correct: c.correct,
    reason: c.reason
  }));

  return callGroq({
    json: true,
    messages: [
      {
        role: "system",
        content:
          "You are a Japanese writing teacher. Return JSON only with concise learner-friendly comments."
      },
      {
        role: "user",
        content: `Return:
{
  "good_points": ["...", "..."],
  "content_comment": "...",
  "grade": "A|B|C",
  "grade_reason": "..."
}
Rules:
- good_points: 2 or 3 items in Japanese.
- content_comment: 1-2 sentences in Japanese.
- grade_reason: one line in Japanese.

original:
${original}

revised:
${revised}

corrections_used:
${JSON.stringify(correctionSummary, null, 2)}`
      }
    ]
  });
}

app.post("/api/feedback", async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is not set." });
    }

    const composition = String(req.body?.composition || "").trim();
    if (!composition) {
      return res.status(400).json({ error: "Composition is empty." });
    }

    const rewritten = await rewriteSentenceBySentence(composition);
    let revisedComposition = rewritten.revisedComposition;

    if (sameText(revisedComposition, composition)) {
      revisedComposition = await callGroq({
        messages: [
          {
            role: "system",
            content:
              "Rewrite Japanese learner text naturally. Keep meaning. You must revise both first half and second half. Output only revised composition."
          },
          { role: "user", content: composition }
        ]
      });
    }

    if (!revisedComposition || sameText(revisedComposition, composition)) {
      revisedComposition = composition;
    }

    const corrections = buildCorrectionsFromSentenceDiff(rewritten);
    const meta = await generateMetaFeedback(composition, revisedComposition, corrections);
    const feedback = formatFeedback(meta, corrections.slice(0, 10));

    if (
      !feedback.includes(H_GOOD) ||
      !feedback.includes(H_FIX) ||
      !feedback.includes(H_CONTENT) ||
      !feedback.includes(H_GRADE)
    ) {
      return res.status(502).json({ error: "Feedback template validation failed." });
    }

    return res.json({ feedback, revisedComposition });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error?.message || "Server error."
    });
  }
});

app.listen(PORT, () => {
  console.log(`API server is running on http://localhost:${PORT}`);
});
