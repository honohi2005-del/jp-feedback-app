# 日本語作文フィードバックアプリ（Groq API）

React + Tailwind CSS で作成した、教師向けの日本語作文フィードバック作成アプリです。  
学生の作文を入力し、Groq API（`llama-3.3-70b-versatile`）で下書きフィードバックを生成し、編集してコピーまたは書き出しできます。

## 機能

- 学生作文の貼り付け入力
- 固定テンプレートに沿ったAIフィードバック生成
- 生成結果のインライン編集
- クリップボードコピー
- `.txt` 書き出し

## セットアップ

1. 依存関係をインストール

```bash
npm install
```

2. 環境変数を設定

```bash
cp .env.example .env
```

`.env` の `GROQ_API_KEY` に Groq API キーを設定してください。

3. API サーバーを起動

```bash
npm run server
```

4. 別ターミナルでフロントを起動

```bash
npm run dev
```

Vite 開発サーバーは `/api` を `http://localhost:8787` にプロキシします。

または、同時起動:

```bash
npm run dev:all
```

## 使用モデルと生成設定

- Endpoint: `https://api.groq.com/openai/v1/chat/completions`
- Model: `llama-3.3-70b-versatile`
- Temperature: `0.4`

## 出力テンプレート

生成結果は次の構造を想定しています。

- 【良い点】 2–3 specific positive observations
- 【文法・表現の修正】 list each error with correction and brief explanation
- 【内容・構成へのコメント】 overall comment on content and organization
- 【総合評価】 A / B / C with one-line reason
