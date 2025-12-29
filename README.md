# Tsunovel - Web Novel Reader App

Web小説を収集（積ん読）し、自分好みの快適な環境で読むためのリーダーアプリです。

## コンセプト

「集める楽しさ」と「没頭できる読書体験」の両立を目指しています。ライブラリ画面では、魔法のアーカイブから巻物を取り出すような幻想的な体験を、リーダー画面では装飾を削ぎ落とした純粋な読書体験を提供します。

## 主な機能

### 1. ライブラリ画面 (Library View)

- **Makimono UI**: 小説を「巻物」として表現した幻想的なデザイン
- **マルチデバイス・レイアウト**:
  - **Desktop**: 多数の作品を一覧できるレスポンシブな多段グリッド表示
  - **Mobile**: 横スクロールによる直感的なブラウジング
- **フィルタリング**: ジャンル別、または「お気に入り」による絞り込み機能

### 2. リーダー画面 (Reader View)

- **没頭モード**: ヘッダー以外の装飾を排除した読書環境
- **高度なカスタマイズ**:
  - **テーマ**: ライト / セピア / ダーク / 珈琲 / ミッドナイト 等、多彩なテーマを用意
  - **フォント**: 明朝体 / ゴシック体 / Noto Serif / Zen Kaku 等、多数のWebフォントに対応
  - **調整項目**: 文字サイズ、行間、背景色、文字色の詳細な設定
- **しおり機能**: 最後に読んだ位置を作品ごとに自動保存

### 3. 小説取得・同期機能 (GitHub Actions 連携)

- **なろう/R18対応**: 「小説家になろう」および「ノクターン/ムーンライト/ミッドナイトノベルズ」に対応
- **自動エピソード取得**: GitHub Actions を使用して、バックグラウンドで最新エピソードまで自動収集
- **同期機能**: 既存作品の更新チェック、未取得話のみの差分取得、特定話の再取得が可能

## 技術スタック

- **Frontend**: React, Vite
- **Styling**: Tailwind CSS
- **Icons**: lucide-react (Lucide)
- **Backend Automation**: GitHub Actions
- **Data Source**: なろう小説API (通常 / R18)

## セットアップ

### 必要な環境

- Node.js (v18以上推奨)
- GitHub リポジトリ（Actions を使用する場合）

### インストール

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

## GitHub Actions の設定 (重要)

小説を実際に取得・保存するには、GitHub Actions の設定が必要です。

1. **PAT (Personal Access Token) の作成**:
   - `repo` 権限を持つ PAT を作成します。
2. **Web UI での設定**:
   - 右上の設定アイコンから、GitHub の Owner 名、Repository 名、PAT を入力して保存します。
3. **小説の追加**:
   - 「召喚（追加）」ボタンから URL を入力すると、GitHub Actions が起動し、小説データが `storage/` フォルダに自動的に蓄積されます。

## プロジェクト構造

```
tsunovel/
├── src/
│   ├── App.jsx          # メインコンポーネント (ライブラリ & リーダー)
│   ├── utils/
│   │   ├── githubActions.js # API連携・Actionsトリガー
│   │   └── novelFetcher.js  # URL解析・なろう検索
│   └── index.css        # デザインシステム (Fantasy UI)
├── storage/             # 取得済み小説データの保存先 (JSON/Text)
├── scripts/
│   └── fetch_novel.cjs  # 小説取得エンジンスクリプト
└── .github/
    └── workflows/       # GitHub Actions ワークフロー定義
```

## ライセンス

このプロジェクトはプロトタイプです。利用規約等を遵守してご利用ください。
