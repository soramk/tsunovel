# API設定ガイド

Web小説ダウンロード機能を使用するには、バックエンドAPIを設定する必要があります。

## 設定方法

### 方法1: 環境変数を使用（推奨）

プロジェクトルートに `.env` ファイルを作成し、以下のように設定します：

```bash
VITE_API_URL=https://your-api-domain.com/api/fetch-novel
```

**注意**: `.env` ファイルはGitにコミットしないでください（既に`.gitignore`に含まれています）

### 方法2: コード内で直接設定

`src/App.jsx` の `handleUrlDownload` 関数内で、API URLを直接指定できます：

```javascript
const apiUrl = 'https://your-api-domain.com/api/fetch-novel';
```

## バックエンドAPIのデプロイ

### オプション1: Vercelを使用（推奨）

1. [Vercel](https://vercel.com)にアカウントを作成
2. GitHubリポジトリをVercelに接続
3. プロジェクトをデプロイ
4. デプロイされたURLを確認（例: `https://tsunovel-api.vercel.app`）
5. `.env`ファイルに以下を設定：
   ```
   VITE_API_URL=https://tsunovel-api.vercel.app/api/fetch-novel
   ```

### オプション2: その他のサーバーレス環境

- **Netlify Functions**: `netlify/functions/fetch-novel.js` に配置
- **AWS Lambda**: Lambda関数としてデプロイ
- **Google Cloud Functions**: Cloud Functionsとしてデプロイ
- **Railway/Render**: Node.jsアプリケーションとしてデプロイ

## ローカル開発

### Vercel CLIを使用

```bash
# Vercel CLIをインストール
npm install -g vercel

# プロジェクトをデプロイ
vercel

# ローカルで開発サーバーを起動
vercel dev
```

ローカル開発時は、`.env`ファイルに以下を設定：
```
VITE_API_URL=http://localhost:3000/api/fetch-novel
```

## APIエンドポイントの形式

APIは以下の形式でリクエストを受け付けます：

**リクエスト:**
```http
POST /api/fetch-novel
Content-Type: application/json

{
  "url": "https://ncode.syosetu.com/n1234ab/"
}
```

**レスポンス:**
```json
{
  "title": "小説のタイトル",
  "author": "著者名",
  "site": "サイト名",
  "content": "小説の本文...",
  "url": "https://ncode.syosetu.com/n1234ab/"
}
```

## トラブルシューティング

### CORSエラーが発生する場合

APIサーバーでCORSヘッダーを設定してください：

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

### APIが404エラーを返す場合

- APIのエンドポイントURLが正しいか確認
- デプロイが完了しているか確認
- Vercelの場合、`vercel.json`の設定を確認

### 環境変数が反映されない場合

- `.env`ファイルがプロジェクトルートにあるか確認
- 環境変数名が`VITE_`で始まっているか確認（Viteの要件）
- 開発サーバーを再起動

## 現在の設定を確認

`src/App.jsx`の`handleUrlDownload`関数で、現在のAPI URL設定を確認できます：

```javascript
const apiUrl = import.meta.env.VITE_API_URL 
  || (import.meta.env.DEV 
    ? 'http://localhost:3000/api/fetch-novel'
    : '/api/fetch-novel');
```

- `VITE_API_URL`が設定されている場合: その値を使用
- 開発環境の場合: `http://localhost:3000/api/fetch-novel`
- 本番環境の場合: `/api/fetch-novel`（相対パス）

