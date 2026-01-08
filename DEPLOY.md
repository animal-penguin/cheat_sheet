# Render.com デプロイ手順

このドキュメントでは、ReverseCheatsアプリケーションをRender.comにデプロイする手順を説明します。

## 前提条件

- GitHubアカウント
- Render.comアカウント（[https://render.com](https://render.com)で無料アカウント作成可能）
- Tursoデータベースアカウント（[https://turso.tech](https://turso.tech)）

## ステップ1: GitHubにリポジトリをプッシュ

1. GitHubで新しいリポジトリを作成
2. ローカルリポジトリをGitHubにプッシュ

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/your-repo-name.git
git push -u origin main
```

## ステップ2: Tursoデータベースの準備

1. [Turso](https://turso.tech)にログイン
2. 新しいデータベースを作成
3. データベースのURLと認証トークンを取得
   - データベースURL: `libsql://your-database-name.turso.io`
   - 認証トークン: Tursoダッシュボードから取得

## ステップ3: Render.comでWebサービスを作成

1. [Render.comダッシュボード](https://dashboard.render.com)にログイン
2. 「New +」ボタンをクリック
3. 「Web Service」を選択
4. GitHubリポジトリを接続
   - 「Connect GitHub」をクリック
   - リポジトリを選択して「Connect」をクリック

## ステップ4: サービス設定

### 方法A: render.yamlを使用（推奨）

プロジェクトルートに`render.yaml`ファイルが含まれている場合、Render.comが自動的に設定を読み込みます。

1. GitHubに`render.yaml`が含まれていることを確認
2. Render.comでリポジトリを接続すると、自動的に設定が読み込まれます
3. 環境変数のみ手動で設定する必要があります（下記参照）

### 方法B: 手動設定

`render.yaml`を使用しない場合は、以下の設定を手動で入力：

#### 基本設定

- **Name**: `reversecheats`（任意の名前）
- **Region**: 最寄りのリージョンを選択（例: `Oregon (US West)`)
- **Branch**: `main`（または使用しているブランチ）
- **Root Directory**: （空白のまま）
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### 環境変数の設定

「Environment」セクションで以下の環境変数を追加：

| Key | Value | 説明 |
|-----|-------|------|
| `NODE_ENV` | `production` | 本番環境モード |
| `PORT` | `10000` | Renderが自動的に設定するポート（通常は10000） |
| `FRONTEND_ORIGIN` | `https://your-app-name.onrender.com` | デプロイ後のアプリURL（後で更新） |
| `TURSO_DATABASE_URL` | `libsql://your-database-name.turso.io` | TursoデータベースURL |
| `TURSO_AUTH_TOKEN` | `your-auth-token` | Turso認証トークン |
| `GEMINI_API_KEY` | `your-gemini-api-key` | （オプション）Gemini APIキー（AI整形機能を使用する場合） |

**重要**: 
- `TURSO_DATABASE_URL`と`TURSO_AUTH_TOKEN`は機密情報なので、必ず「Secret」として設定してください
- `FRONTEND_ORIGIN`は最初は仮の値で設定し、デプロイ後に実際のURLに更新してください

### プランの選択

- **Free**: 無料プラン（スリープモードあり）
- **Starter**: 有料プラン（常時起動）

## ステップ5: デプロイの開始

1. 「Create Web Service」ボタンをクリック
2. デプロイが開始されます（初回は5-10分かかることがあります）
3. デプロイログを確認して、エラーがないか確認

## ステップ6: デプロイ後の設定

1. デプロイが完了したら、Renderが提供するURLを確認（例: `https://your-app-name.onrender.com`）
2. Renderダッシュボードで環境変数`FRONTEND_ORIGIN`を実際のURLに更新
3. 「Manual Deploy」から「Deploy latest commit」をクリックして再デプロイ

## ステップ7: 動作確認

1. ブラウザでアプリにアクセス
2. サインアップ機能をテスト
3. ログイン機能をテスト
4. チートシートの作成・編集・削除をテスト

## トラブルシューティング

### デプロイが失敗する場合

1. **ビルドエラー**: ログを確認して、依存関係の問題がないか確認
2. **環境変数エラー**: すべての必須環境変数が設定されているか確認
3. **ポートエラー**: `PORT`環境変数が正しく設定されているか確認

### データベース接続エラー

1. TursoデータベースのURLとトークンが正しいか確認
2. Tursoダッシュボードでデータベースがアクティブか確認
3. ネットワーク接続を確認

### アプリが起動しない場合

1. Renderのログを確認
2. `npm start`コマンドが正しく実行されているか確認
3. ポート番号が正しく設定されているか確認

## 継続的デプロイ（CD）

Renderはデフォルトで自動デプロイが有効になっています：
- `main`ブランチにプッシュすると自動的にデプロイされます
- 手動デプロイも可能です

## カスタムドメインの設定（オプション）

1. Renderダッシュボードでサービスを選択
2. 「Settings」タブを開く
3. 「Custom Domain」セクションでドメインを追加
4. DNS設定を更新（Renderが指示を提供）

## セキュリティの確認

- ✅ 環境変数は「Secret」として設定されている
- ✅ `.gitignore`で機密情報が除外されている
- ✅ HTTPSが有効になっている（Renderは自動的にHTTPSを提供）

## サポート

問題が発生した場合：
1. Renderのドキュメント: [https://render.com/docs](https://render.com/docs)
2. Tursoのドキュメント: [https://docs.turso.tech](https://docs.turso.tech)
3. Renderのサポート: Renderダッシュボードからサポートチケットを作成

## 注意事項

- 無料プランでは、15分間アクセスがないとアプリがスリープモードになります
- スリープモードからの復帰には数秒かかることがあります
- 本番環境では有料プランの使用を推奨します

