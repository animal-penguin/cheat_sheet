// 環境変数を読み込む（.env.localファイルから、存在しない場合は通常の環境変数から）
require('dotenv').config({ path: '.env.local' });
// Render.comなどの本番環境では環境変数から直接読み込む

const { createClient } = require('@libsql/client');
const path = require('path');

// Tursoデータベース接続
// 環境変数が設定されていない場合は、ローカルのSQLiteデータベースを使用
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

let db;
if (tursoUrl && tursoToken) {
  // Tursoリモートデータベースを使用
  console.log('Connecting to Turso database...');
  db = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });
} else {
  // ローカルのSQLiteデータベースを使用（開発用）
  console.log('Using local SQLite database (development mode)');
  console.log('To use Turso, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables');
  const localDbPath = path.join(__dirname, 'cheat_sheet.db');
  db = createClient({
    url: `file:${localDbPath}`,
  });
}

// テーブル初期化
async function initializeDatabase() {
  try {
    // usersテーブル
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        account_name TEXT,
        created_at INTEGER NOT NULL
      )`,
    });

    // 既存のusersテーブルにaccount_nameカラムを追加（マイグレーション）
    try {
      await db.execute({
        sql: `ALTER TABLE users ADD COLUMN account_name TEXT`,
      });
      console.log('Added account_name column to users table');
    } catch (error) {
      // カラムが既に存在する場合はエラーを無視
      if (!error.message || !error.message.includes('duplicate column name')) {
        console.warn('Could not add account_name column (may already exist):', error.message);
      }
    }

    // sessionsテーブル
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    });

    // cheat_itemsテーブル（チートシートアイテム）
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS cheat_items (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        tags TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    });

    // インデックス
    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
    });

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
    });

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_cheat_items_user_id ON cheat_items(user_id)`,
    });

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// 初期化を実行
initializeDatabase().catch(console.error);

module.exports = db;
