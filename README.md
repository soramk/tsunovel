# Tsunovel - Web Novel Reader App

Web小説を収集（積ん読）し、自分好みの快適な環境で読むためのリーダーアプリのプロトタイプです。

## コンセプト

「集める楽しさ」と「没頭できる読書体験」の両立を目指しています。特にライブラリ画面では、物理的な本棚から本を取り出して開くようなリッチなアニメーション体験を重視しています。

## 技術スタック

- **Framework**: React (Functional Components, Hooks)
- **Styling**: Tailwind CSS
- **Icons**: lucide-react
- **Build Tool**: Vite

## 主な機能

### 1. ライブラリ画面 (Library View)

- **3Dブック表現**: CSS 3D Transformsを使用した物理的な本のレンダリング
- **インタラクション**:
  - ホバー時: 本が少し浮き上がり、手前に傾く
  - クリック時: 本が取り出され、表紙がめくれるアニメーション後にリーダー画面へ遷移
- **デザイン**: ダークブラウンを基調とした木製の本棚風デザイン

### 2. リーダー画面 (Reader View)

- **没頭モード**: ヘッダー以外の装飾を排除した読書環境
- **カスタマイズ機能**:
  - テーマ切り替え: ライト / セピア / ダーク
  - フォント切り替え: 明朝体 / ゴシック体
  - 文字サイズ変更: 小 / 中 / 大

### 3. 検索・追加機能

- モーダルからキーワード検索
- ダミーデータベースから検索結果を表示
- 検索結果をクリックしてライブラリに追加

### 4. Web小説ダウンロード機能

- **URL入力**: Web小説サイトのURLを入力して小説をダウンロード
- **対応サイト**: 
  - **小説家になろう** (syosetu.com) - 公式APIを使用してメタ情報を取得
  - カクヨム (kakuyomu.jp)
  - その他のWeb小説サイト（汎用パーサー）
- **自動取得**: タイトル、著者、本文を自動で取得
- **バックエンドAPI**: サーバーレス関数（Vercel Functions）を使用
- **なろう小説API**: [小説家になろう公式API](https://dev.syosetu.com/man/api/)を使用

## セットアップ

### 必要な環境

- Node.js (v16以上推奨)
- npm または yarn

### インストール

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build

# ビルド結果のプレビュー
npm run preview
```

## プロジェクト構造

```
tsunovel/
├── src/
│   ├── App.jsx          # メインコンポーネント
│   ├── main.jsx         # Reactエントリーポイント
│   └── index.css        # Tailwind CSS設定
├── storage/             # 小説データ保存先（非公開推奨）
├── scripts/
│   └── fetch_novel.cjs  # 小説取得スクリプト（GitHub Actions用）
├── .github/
│   └── workflows/       # GitHub Actions設定
├── index.html           # HTMLエントリーポイント
├── package.json         # 依存関係
├── vite.config.js       # Vite設定
└── tailwind.config.js   # Tailwind CSS設定
```

## データ構造

```javascript
const novel = {
  id: number,
  title: string,
  author: string,
  site: string,        // 出典サイト名
  status: 'unread' | 'reading' | 'completed',
  progress: number,    // 0-100
  content: string      // 本文
};
```

## GitHub Pagesでの公開

このプロジェクトはGitHub Pagesで自動デプロイされるように設定されています。

### デプロイ手順

1. **リポジトリの設定**
   - GitHubリポジトリの Settings > Pages に移動
   - Source を "GitHub Actions" に設定

2. **自動デプロイ**
   - `main`ブランチにプッシュすると、自動的にビルドとデプロイが実行されます
   - デプロイの進行状況は Actions タブで確認できます

3. **公開URL**
   - デプロイ完了後、以下のURLでアクセスできます：
   - `https://[あなたのユーザー名].github.io/tsunovel/`

### 手動デプロイ（オプション）

自動デプロイを使わない場合：

```bash
# ビルド
npm run build

# gh-pagesパッケージを使用する場合
npm install -g gh-pages
gh-pages -d dist
```

**注意**: `vite.config.js`の`base`設定がリポジトリ名（`/tsunovel/`）に合わせて設定されています。リポジトリ名が異なる場合は、`vite.config.js`の`base`を変更してください。

## Web小説ダウンロード機能

### 概要

フロントエンドから直接小説家になろうの公式APIを使用して小説情報を取得します。**バックエンドAPIは不要**です。

### 対応サイト

- **小説家になろう** (syosetu.com) - 公式APIを使用
- その他のサイトはCORS制限により現在サポートされていません

### 使用方法

1. 「小説を追加」ボタンをクリック
2. 「URL」タブを選択
3. 小説家になろうのURLを入力（例: `https://ncode.syosetu.com/n1234ab/`）
4. 「小説をダウンロード」ボタンをクリック

### 取得できる情報

- タイトル
- 著者名
- あらすじ
- 初回掲載日
- 最終掲載日
- ジャンル

**注意**: 本文は取得できません（CORS制限のため）。あらすじとURLが表示されます。

### 技術詳細

- **API**: [小説家になろう公式API](https://dev.syosetu.com/man/api/)
- **実装**: フロントエンドから直接APIを呼び出し（`src/utils/novelFetcher.js`）
- **CORS**: 小説家になろうのAPIはCORSを許可しているため、ブラウザから直接アクセス可能

### 注意事項

- **利用規約**: 小説家になろうの利用規約を確認し、遵守してください
- **レート制限**: APIの利用制限（1日80,000リクエストまたは400MB）に注意してください
- **CORSエラー**: 他のサイトから取得する場合はCORSエラーが発生します

## ライセンス

このプロジェクトはプロトタイプです。

