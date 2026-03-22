import json
import os
import re
from typing import Any

import requests
import streamlit as st

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"
TEMPERATURE = 0.4

H_GOOD = "【良い点】"
H_FIX = "【文法・表現の修正】"
H_CONTENT = "【内容・構成へのコメント】"
H_GRADE = "【総合評価】"


def normalize_text(text: str) -> str:
    text = text or ""
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"[。、「」『』（）()・,，.．]", "", text)
    return text.lower().strip()


def split_sentences(text: str) -> list[str]:
    lines = text.replace("\r\n", "\n").split("\n")
    chunks: list[str] = []
    for line in lines:
        chunks.extend(re.findall(r"[^。！？!?]+[。！？!?]?", line))
    out = [c.strip() for c in chunks if c.strip()]
    return out or [text.strip()]


def call_groq(messages: list[dict[str, str]], api_key: str, json_mode: bool = False) -> Any:
    payload: dict[str, Any] = {
        "model": MODEL,
        "temperature": TEMPERATURE,
        "messages": messages,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    response = requests.post(
        GROQ_ENDPOINT,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        data=json.dumps(payload),
        timeout=120,
    )
    data = response.json()
    if not response.ok:
        message = data.get("error", {}).get("message", "Groq API error")
        raise RuntimeError(message)

    content = (data.get("choices", [{}])[0].get("message", {}) or {}).get("content", "").strip()
    if not json_mode:
        return content
    try:
        return json.loads(content or "{}")
    except json.JSONDecodeError as exc:
        raise RuntimeError("AI応答(JSON)の解析に失敗しました。") from exc


def rewrite_sentence_by_sentence(composition: str, api_key: str) -> tuple[list[str], list[str], list[str], str]:
    original_sentences = split_sentences(composition)
    payload = json.dumps(original_sentences, ensure_ascii=False, indent=2)
    result = call_groq(
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an experienced Japanese teacher. "
                    "Return JSON only. Revise every sentence naturally while preserving meaning."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Input is a JSON array of sentences in order.\n"
                    "Return JSON schema:\n"
                    "{\n"
                    '  "revised_sentences": ["..."],\n'
                    '  "reasons": ["..."]\n'
                    "}\n"
                    "Rules:\n"
                    "- revised_sentences length must equal input length.\n"
                    "- reasons length must equal input length.\n"
                    "- Review ALL sentences including the latter half.\n"
                    "- reasons should be short Japanese explanations.\n"
                    "- Output JSON only.\n\n"
                    f"input_sentences:\n{payload}"
                ),
            },
        ],
        api_key=api_key,
        json_mode=True,
    )

    revised_sentences = result.get("revised_sentences", [])
    reasons = result.get("reasons", [])

    if not isinstance(revised_sentences, list) or len(revised_sentences) != len(original_sentences):
        raise RuntimeError("全文修正の整合チェックに失敗しました。")

    normalized_revised = [str(s).strip() if str(s).strip() else original_sentences[i] for i, s in enumerate(revised_sentences)]
    normalized_reasons = [
        str(reasons[i]).strip() if i < len(reasons) and str(reasons[i]).strip() else "文法・語順を自然な日本語に調整しました。"
        for i in range(len(original_sentences))
    ]
    revised_composition = "".join(normalized_revised).strip()
    return original_sentences, normalized_revised, normalized_reasons, revised_composition


def build_corrections(original: list[str], revised: list[str], reasons: list[str]) -> list[dict[str, str]]:
    corrections: list[dict[str, str]] = []
    for i in range(len(original)):
        if normalize_text(original[i]) != normalize_text(revised[i]):
            corrections.append(
                {
                    "wrong": original[i],
                    "correct": revised[i],
                    "reason": reasons[i],
                }
            )
    return corrections


def generate_meta_feedback(
    composition: str, revised: str, corrections: list[dict[str, str]], api_key: str
) -> dict[str, Any]:
    correction_summary = json.dumps(corrections[:10], ensure_ascii=False, indent=2)
    return call_groq(
        messages=[
            {
                "role": "system",
                "content": "You are an experienced Japanese teacher. Return JSON only.",
            },
            {
                "role": "user",
                "content": (
                    "Return JSON:\n"
                    "{\n"
                    '  "good_points": ["...", "..."],\n'
                    '  "content_comment": "...",\n'
                    '  "grade": "A|B|C",\n'
                    '  "grade_reason": "..."\n'
                    "}\n"
                    "Rules:\n"
                    "- Japanese output only.\n"
                    "- good_points must be 2-3 items.\n"
                    "- content_comment should evaluate content/organization.\n"
                    "- grade_reason must be one line.\n\n"
                    f"original:\n{composition}\n\n"
                    f"revised:\n{revised}\n\n"
                    f"corrections_used:\n{correction_summary}"
                ),
            },
        ],
        api_key=api_key,
        json_mode=True,
    )


def format_feedback(meta: dict[str, Any], corrections: list[dict[str, str]]) -> str:
    good_points = meta.get("good_points", [])
    content_comment = str(meta.get("content_comment", "")).strip()
    grade = str(meta.get("grade", "B")).strip()
    grade_reason = str(meta.get("grade_reason", "")).strip() or "改善の余地はありますが、内容は伝わっています。"

    if not isinstance(good_points, list) or not good_points:
        good_block = "1. 主題が明確で、伝えたいことが分かります。\n2. 具体例を入れて書けています。"
    else:
        good_block = "\n".join(f"{i+1}. {str(v).strip()}" for i, v in enumerate(good_points[:3]))

    if corrections:
        fix_block = "\n".join(
            f"- 誤: {c['wrong']}\n  正: {c['correct']}\n  理由: {c['reason']}" for c in corrections[:10]
        )
    else:
        fix_block = "- 誤: 助詞・語順に不自然な箇所\n  正: 自然な表現へ調整\n  理由: 読みやすくするため。"

    if grade not in {"A", "B", "C"}:
        grade = "B"

    return (
        f"{H_GOOD}\n"
        f"{good_block}\n\n"
        f"{H_FIX}\n"
        f"{fix_block}\n\n"
        f"{H_CONTENT}\n"
        f"{content_comment or '内容は伝わります。段落構成を整えるとさらに読みやすくなります。'}\n\n"
        f"{H_GRADE}\n"
        f"{grade}：{grade_reason}"
    )


def get_api_key() -> str:
    if "GROQ_API_KEY" in st.secrets:
        return st.secrets["GROQ_API_KEY"]
    return os.getenv("GROQ_API_KEY", "")


st.set_page_config(page_title="日本語作文フィードバック", page_icon="📝", layout="wide")
st.title("日本語作文フィードバック作成ツール（Streamlit）")
st.caption("Groq APIでフィードバックと修正後作文を作成します。")

api_key = get_api_key()
if not api_key:
    st.error("GROQ_API_KEY が見つかりません。Streamlit secrets か環境変数に設定してください。")
    st.stop()

if "feedback_text" not in st.session_state:
    st.session_state.feedback_text = (
        "【良い点】\n1.\n2.\n\n"
        "【文法・表現の修正】\n- 誤:\n  正:\n  理由:\n\n"
        "【内容・構成へのコメント】\n\n"
        "【総合評価】\nA / B / C："
    )
if "revised_text" not in st.session_state:
    st.session_state.revised_text = ""

composition = st.text_area("学生の作文", height=240, placeholder="ここに学生の作文を貼り付けてください。")

if st.button("フィードバック生成", type="primary"):
    if not composition.strip():
        st.warning("作文を入力してください。")
    else:
        with st.spinner("生成中..."):
            try:
                original, revised_sents, reasons, revised_comp = rewrite_sentence_by_sentence(composition, api_key)
                corrections = build_corrections(original, revised_sents, reasons)
                if normalize_text(revised_comp) == normalize_text(composition):
                    revised_comp = call_groq(
                        messages=[
                            {
                                "role": "system",
                                "content": (
                                    "Rewrite Japanese learner composition naturally. "
                                    "You must revise first-half and second-half sentences. Output text only."
                                ),
                            },
                            {"role": "user", "content": composition},
                        ],
                        api_key=api_key,
                        json_mode=False,
                    )
                meta = generate_meta_feedback(composition, revised_comp, corrections, api_key)
                st.session_state.feedback_text = format_feedback(meta, corrections)
                st.session_state.revised_text = revised_comp or composition
                st.success("生成が完了しました。")
            except Exception as exc:
                st.error(f"生成中にエラーが発生しました: {exc}")

col1, col2 = st.columns(2)
with col1:
    st.subheader("修正後の作文（編集可）")
    st.session_state.revised_text = st.text_area(
        "revised_editor",
        value=st.session_state.revised_text,
        height=320,
        label_visibility="collapsed",
    )
    st.download_button(
        "修正後作文をダウンロード(.txt)",
        data=st.session_state.revised_text,
        file_name="revised_composition.txt",
        mime="text/plain",
    )

with col2:
    st.subheader("フィードバック（編集可）")
    st.session_state.feedback_text = st.text_area(
        "feedback_editor",
        value=st.session_state.feedback_text,
        height=320,
        label_visibility="collapsed",
    )
    st.download_button(
        "フィードバックをダウンロード(.txt)",
        data=st.session_state.feedback_text,
        file_name="feedback.txt",
        mime="text/plain",
    )
