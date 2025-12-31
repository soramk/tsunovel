# Tsunovel - Web Novel Reader App

Web小説を収集（積ん読）し、自分好みの快適な環境で読むためのリーダーアプリです。

## コンセプト

「集める楽しさ」と「没頭できる読書体験」の両立を目指しています。ライブラリ画面では、魔法のアーカイブから巻物を取り出すような幻想的な体験を、リーダー画面では装飾を削ぎ落とした純粋な読書体験を提供します。

## 主な機能

### 1. ライブラリ画面 (Library View)

- **Makimono UI**: 小説を「巻物」として表現した幻想的なデザイン
- **マルチデバイス・レイアウト**:
  - **Desktop**: 多数の作品を一覧できるレスポンシブな多段グリッド表示
  - **Mobile**: 縦型ブックリストによる最適化されたブラウジング
- **フィルタリング**: ジャンル別、または「お気に入り」による絞り込み機能
- **管理機能**: 小説の「召喚（追加）」および「還送（削除）」をサポート

### 2. リーダー画面 (Reader View)

- **没頭モード**: ヘッダー以外の装飾を排除した読書環境
- **高度なカスタマイズ**:
  - **テーマ**: ライト / セピア / ダーク / 珈琲 / ミッドナイト 等、多彩なテーマを用意
  - **フォント**: 明朝体 / ゴシック体 / Noto Serif / Zen Kaku 等、多数のWebフォントに対応
  - **調整項目**: 文字サイズ、行間、背景色、文字色の詳細な設定
- **しおり機能**: 最後に読んだ位置を作品ごとに自動保存

### 3. 小説取得・同期機能 (GitHub Actions 連携)

- **なろう/R18対応**: 「小説家になろう」および「ノクターン/ムーンライト/ミッドナイトノベルズ」に対応
- **マルチ・バッチ取得**: 複数の小説URLやNCODEを一度に「召喚」可能
- **自動エピソード取得**: GitHub Actions を使用して、バックグラウンドで最新エピソードまで自動収集
- **同期・保守機能**: 既存作品の更新チェック、未取得話のみの差分取得、特定話の再取得、不要な小説の削除が可能

## 技術スタック

- **Frontend**: React, Vite
- **Styling**: Vanilla CSS (Fantasy Theme System)
- **Icons**: lucide-react (Lucide)
- **Backend Automation**: GitHub Actions (Node.js)
- **Data Source**: なろう小説API (通常 / R18)

## セットアップ & ドキュメント

### クイックスタート

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

### 詳細ガイド

- [API設定ガイド](file:///c:/Users/sora0/OneDrive/github/tsunovel/API_SETUP.md): GitHub Actionsとの連携設定
- [トラブルシューティング](file:///c:/Users/sora0/OneDrive/github/tsunovel/TROUBLESHOOTING.md): 困ったときは

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
│   ├── fetch_novel.cjs  # 小説取得エンジン
│   ├── remove_novel.cjs # 小説削除スクリプト
│   └── enrich_index.cjs # インデックス最適化スクリプト
└── .github/
    └── workflows/       # GitHub Actions ワークフロー定義
```

## ライセンス

このプロジェクトは個人の読書体験を向上させるためのプロトタイプです。利用規約等を遵守してご利用ください。
