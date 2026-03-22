import { useState } from "react";

const t = {
  title: "\u65e5\u672c\u8a9e\u4f5c\u6587\u30d5\u30a3\u30fc\u30c9\u30d0\u30c3\u30af\u4f5c\u6210\u30c4\u30fc\u30eb",
  subtitle:
    "\u6307\u6458\u3068\u4fee\u6b63\u5f8c\u4f5c\u6587\u306e\u6574\u5408\u3092\u53d6\u308a\u306a\u304c\u3089\u3001\u6559\u5e2b\u30b3\u30e1\u30f3\u30c8\u3092\u4f5c\u6210\u3067\u304d\u307e\u3059\u3002",
  inputLabel: "\u5b66\u751f\u306e\u4f5c\u6587",
  inputPlaceholder:
    "\u3053\u3053\u306b\u5b66\u751f\u306e\u65e5\u672c\u8a9e\u4f5c\u6587\u3092\u8cbc\u308a\u4ed8\u3051\u3066\u304f\u3060\u3055\u3044\u3002",
  generate: "\u30d5\u30a3\u30fc\u30c9\u30d0\u30c3\u30af\u751f\u6210",
  generating: "\u751f\u6210\u4e2d...",
  revisedLabel: "\u4fee\u6b63\u5f8c\u306e\u4f5c\u6587\uff08\u7de8\u96c6\u53ef\uff09",
  revisedPlaceholder:
    "\u3053\u3053\u306b\u4fee\u6b63\u5f8c\u306e\u4f5c\u6587\u304c\u8868\u793a\u3055\u308c\u307e\u3059\u3002",
  revisedCopy: "\u4fee\u6b63\u5f8c\u4f5c\u6587\u3092\u30b3\u30d4\u30fc",
  revisedCopied: "\u4fee\u6b63\u5f8c\u4f5c\u6587\u3092\u30b3\u30d4\u30fc\u6e08\u307f",
  feedbackLabel: "\u30d5\u30a3\u30fc\u30c9\u30d0\u30c3\u30af\uff08\u7de8\u96c6\u53ef\uff09",
  feedbackCopy: "\u30d5\u30a3\u30fc\u30c9\u30d0\u30c3\u30af\u3092\u30b3\u30d4\u30fc",
  feedbackCopied: "\u30d5\u30a3\u30fc\u30c9\u30d0\u30c3\u30af\u3092\u30b3\u30d4\u30fc\u6e08\u307f",
  feedbackExport: "\u30d5\u30a3\u30fc\u30c9\u30d0\u30c3\u30af\u3092\u66f8\u304d\u51fa\u3057"
};

const TEMPLATE = `\u3010\u826f\u3044\u70b9\u3011
1.
2.

\u3010\u6587\u6cd5\u30fb\u8868\u73fe\u306e\u4fee\u6b63\u3011
- \u8aa4:
  \u6b63:
  \u7406\u7531:

\u3010\u5185\u5bb9\u30fb\u69cb\u6210\u3078\u306e\u30b3\u30e1\u30f3\u30c8\u3011

\u3010\u7dcf\u5408\u8a55\u4fa1\u3011
A / B / C:`;

export default function App() {
  const [composition, setComposition] = useState("");
  const [feedback, setFeedback] = useState(TEMPLATE);
  const [revisedComposition, setRevisedComposition] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [copiedRevised, setCopiedRevised] = useState(false);

  const onGenerate = async () => {
    if (!composition.trim()) {
      setError("\u4f5c\u6587\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      return;
    }
    setLoading(true);
    setError("");
    setCopiedFeedback(false);
    setCopiedRevised(false);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composition })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generation failed.");
      setFeedback(data.feedback || TEMPLATE);
      setRevisedComposition(data.revisedComposition || composition);
    } catch (e) {
      setError(e.message || "Error.");
      setRevisedComposition(composition);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text, setFlag) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 1500);
    } catch {
      setError("\u30b3\u30d4\u30fc\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002");
    }
  };

  const exportFeedback = () => {
    const file = new Blob([feedback], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feedback.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-6xl rounded-2xl border border-amber-200 bg-white/95 p-6 shadow-xl md:p-8">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{t.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{t.subtitle}</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="composition">
              {t.inputLabel}
            </label>
            <textarea
              id="composition"
              value={composition}
              onChange={(e) => setComposition(e.target.value)}
              placeholder={t.inputPlaceholder}
              className="h-[320px] w-full rounded-xl border border-slate-300 bg-white p-4 text-sm leading-7 text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
            <button
              type="button"
              onClick={onGenerate}
              disabled={loading}
              className="mt-3 inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t.generating : t.generate}
            </button>
          </section>

          <section>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="revised">
              {t.revisedLabel}
            </label>
            <textarea
              id="revised"
              value={revisedComposition}
              onChange={(e) => setRevisedComposition(e.target.value)}
              placeholder={t.revisedPlaceholder}
              className="h-[320px] w-full rounded-xl border border-slate-300 bg-white p-4 text-sm leading-7 text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
            <button
              type="button"
              onClick={() => copy(revisedComposition, setCopiedRevised)}
              className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {copiedRevised ? t.revisedCopied : t.revisedCopy}
            </button>
          </section>
        </div>

        <section className="mt-6">
          <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="feedback">
            {t.feedbackLabel}
          </label>
          <textarea
            id="feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="h-[360px] w-full rounded-xl border border-slate-300 bg-white p-4 text-sm leading-7 text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy(feedback, setCopiedFeedback)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              {copiedFeedback ? t.feedbackCopied : t.feedbackCopy}
            </button>
            <button
              type="button"
              onClick={exportFeedback}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {t.feedbackExport}
            </button>
          </div>
        </section>

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>
    </main>
  );
}
