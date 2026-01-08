<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ReverseCheats - 逆引きチートシート

あなた専用のナレッジベース。コードやレシピなどを賢く管理。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Tursoデータベースの設定

1. [Turso](https://turso.tech/)でアカウントを作成
2. データベースを作成
3. 認証トークンを取得

### 3. 環境変数の設定

プロジェクトルートに`.env`ファイルを作成し、以下を設定：

```env
# Turso Database Configuration
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your-auth-token-here

# Server Configuration
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
NODE_ENV=development

# Gemini API (オプション - AI整形機能用)
GEMINI_API_KEY=your-gemini-api-key
```

### 4. アプリケーションの起動

**バックエンドサーバーを起動:**
```bash
node backend/server.js
```

**フロントエンド開発サーバーを起動（別のターミナル）:**
```bash
npm run dev
```

ブラウザで `http://localhost:5173` にアクセスしてください。

## 機能

- ✅ ユーザー認証（サインアップ・ログイン）
- ✅ チートシートの作成・編集・削除
- ✅ カテゴリー別の整理
- ✅ タグ機能
- ✅ Markdown形式のコンテンツ
- ✅ AIによる自動整形（Gemini API使用時）
- ✅ Tursoデータベースによる永続化

## 技術スタック

- **フロントエンド**: React, TypeScript, Tailwind CSS
- **バックエンド**: Express.js, Node.js
- **データベース**: Turso (SQLite)
- **認証**: セッション管理（HTTP-only Cookie）
