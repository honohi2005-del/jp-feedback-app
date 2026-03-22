# Streamlit Cloud デプロイ手順

1. このフォルダを GitHub リポジトリに push します。  
`streamlit_app.py` と `requirements.txt` がルートにあることを確認してください。

2. [streamlit.io/cloud](https://streamlit.io/cloud) でログインし、`New app` を選択します。

3. Repository / Branch を選び、Main file path を `streamlit_app.py` に設定してデプロイします。

4. App settings の `Secrets` に以下を追加します。

```toml
GROQ_API_KEY="YOUR_GROQ_API_KEY"
```

5. デプロイ後、発行された `https://<app-name>.streamlit.app` を他PCブラウザで開けば利用できます。

## 補足

- ローカル実行:

```bash
streamlit run streamlit_app.py
```

- この Streamlit 版は、全文を文単位でチェックして修正版を作るため、後半未反映が起きにくい実装です。
