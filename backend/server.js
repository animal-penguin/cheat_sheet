// backend/server.js -- Turso Database版
// 環境変数を読み込む（.env.localファイルから、存在しない場合は通常の環境変数から）
require('dotenv').config({ path: '.env.local' });
// Render.comなどの本番環境では環境変数から直接読み込む

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

function makeId(len = 16) {
  return crypto.randomBytes(len).toString('hex');
}

// 認証ミドルウェア
async function requireAuth(req, res, next) {
  try {
    const sid = req.cookies && req.cookies.sid;
    if (!sid) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

      const result = await db.execute({
        sql: 'SELECT s.user_id, s.expires_at, u.id, u.email, u.account_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.sid = ?',
        args: [sid],
      });

      const session = result.rows[0];
      if (!session) {
        res.clearCookie('sid');
        return res.status(401).json({ message: 'Invalid session' });
      }

      // セッションの有効期限をチェック
      if (session.expires_at && Date.now() > session.expires_at) {
        await db.execute({
          sql: 'DELETE FROM sessions WHERE sid = ?',
          args: [sid],
        });
        res.clearCookie('sid');
        return res.status(401).json({ message: 'Session expired' });
      }

      req.user = { id: session.user_id, email: session.email, account_name: session.account_name };
      next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function start() {
  const app = express();

  // セキュリティヘッダーの設定
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://esm.sh"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS設定
  app.use(cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // レート制限の設定
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 100, // 15分間に100リクエストまで
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 5, // 認証エンドポイントは15分間に5回まで
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true,
  });

  app.use('/api/', limiter);
  app.use('/api/login', authLimiter);
  app.use('/api/signup', authLimiter);

  // JSONペイロードサイズ制限
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // 入力検証ヘルパー関数
  function sanitizeString(str, maxLength = 1000) {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, maxLength);
  }

  function validateEmail(email) {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  function validatePassword(password) {
    if (typeof password !== 'string') return false;
    // 8文字以上、128文字以下
    return password.length >= 8 && password.length <= 128;
  }

  // --- Signup ---
  app.post('/api/signup', async (req, res) => {
    try {
      const { email, password } = req.body || {};

      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const sanitizedEmail = sanitizeString(email.toLowerCase(), 255);
      
      if (!validateEmail(sanitizedEmail)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      if (!validatePassword(password)) {
        return res.status(400).json({ message: 'Password must be between 8 and 128 characters' });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const created_at = Date.now();

      try {
        await db.execute({
          sql: 'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)',
          args: [sanitizedEmail, password_hash, created_at],
        });
        return res.status(201).json({ ok: true });
      } catch (err) {
        // email UNIQUE 制約に引っかかった場合
        if (err.message && err.message.includes('UNIQUE constraint')) {
          return res.status(409).json({ message: 'Email already registered' });
        }
        console.error('Signup DB error:', err);
        return res.status(500).json({ message: 'DB error' });
      }
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  // --- Login ---
  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const sanitizedEmail = sanitizeString(email.toLowerCase(), 255);
      if (!validateEmail(sanitizedEmail)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      const result = await db.execute({
        sql: 'SELECT id, email, password_hash FROM users WHERE email = ?',
        args: [sanitizedEmail],
      });
      const user = result.rows[0];

      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // セッションを作成
      const sid = makeId(32);
      const now = Date.now();
      const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7日間

      try {
        await db.execute({
          sql: 'INSERT INTO sessions (sid, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
          args: [sid, user.id, now, expiresAt],
        });

        // クッキーにセッションIDを設定
        res.cookie('sid', sid, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7日間
        });

        // ユーザー情報を取得（account_nameを含む）
        const userResult = await db.execute({
          sql: 'SELECT id, email, account_name FROM users WHERE id = ?',
          args: [user.id],
        });
        const userData = userResult.rows[0];

        return res.json({
          ok: true,
          user: { id: user.id, email: user.email, account_name: userData.account_name || null },
        });
      } catch (err) {
        console.error('Session creation error:', err);
        return res.status(500).json({ message: 'Failed to create session' });
      }
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: 'server error' });
    }
  });

  // --- Logout ---
  app.post('/api/logout', async (req, res) => {
    try {
      const sid = req.cookies && req.cookies.sid;
      if (sid) {
        await db.execute({
          sql: 'DELETE FROM sessions WHERE sid = ?',
          args: [sid],
        });
        res.clearCookie('sid');
      }
    } catch (e) {
      console.error(e);
    }
    res.json({ ok: true });
  });

  // --- Me ---
  app.get('/api/me', async (req, res) => {
    try {
      const sid = req.cookies && req.cookies.sid;
      if (!sid) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const result = await db.execute({
        sql: 'SELECT s.user_id, s.expires_at, u.id, u.email, u.account_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.sid = ?',
        args: [sid],
      });

      const session = result.rows[0];
      if (!session) {
        res.clearCookie('sid');
        return res.status(401).json({ message: 'Invalid session' });
      }

      // セッションの有効期限をチェック
      if (session.expires_at && Date.now() > session.expires_at) {
        await db.execute({
          sql: 'DELETE FROM sessions WHERE sid = ?',
          args: [sid],
        });
        res.clearCookie('sid');
        return res.status(401).json({ message: 'Session expired' });
      }

      // 過去のセッション数を確認（初回ログイン判定用）
      // 現在のセッション以外のセッションが存在するかチェック
      const sessionCountResult = await db.execute({
        sql: 'SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND sid != ?',
        args: [session.user_id, sid],
      });
      const previousSessionCount = sessionCountResult.rows[0]?.count || 0;
      const isFirstLogin = previousSessionCount === 0; // 過去のセッションがなければ初回ログイン

      return res.json({ 
        user: { 
          id: session.id, 
          email: session.email, 
          account_name: session.account_name || null 
        },
        isFirstLogin 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  // --- Cheat Items API ---

  // すべてのチートアイテムを取得
  app.get('/api/cheat-items', requireAuth, async (req, res) => {
    try {
      const result = await db.execute({
        sql: 'SELECT id, title, category, tags, content, created_at, updated_at FROM cheat_items WHERE user_id = ? ORDER BY updated_at DESC',
        args: [req.user.id],
      });

      // TursoのAPIはrowsプロパティを持つオブジェクトを返す
      const rows = result.rows || [];
      const formattedItems = rows.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        tags: JSON.parse(row.tags || '[]'),
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return res.json({ items: formattedItems });
    } catch (err) {
      console.error('Get items error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  // チートアイテムを取得
  app.get('/api/cheat-items/:id', requireAuth, async (req, res) => {
    try {
      // IDの検証
      const itemId = sanitizeString(req.params.id, 50);
      if (!itemId || !/^[a-f0-9]+$/.test(itemId)) {
        return res.status(400).json({ message: 'Invalid item ID' });
      }

      const result = await db.execute({
        sql: 'SELECT id, title, category, tags, content, created_at, updated_at FROM cheat_items WHERE id = ? AND user_id = ?',
        args: [itemId, req.user.id],
      });

      const item = result.rows[0];
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }

      return res.json({
        id: item.id,
        title: item.title,
        category: item.category,
        tags: JSON.parse(item.tags || '[]'),
        content: item.content,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      });
    } catch (err) {
      console.error('Get item error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  // チートアイテムを作成
  app.post('/api/cheat-items', requireAuth, async (req, res) => {
    try {
      const { title, category, tags, content } = req.body;

      if (!title || !content || typeof title !== 'string' || typeof content !== 'string') {
        return res.status(400).json({ message: 'title and content are required' });
      }

      const sanitizedTitle = sanitizeString(title, 200);
      const sanitizedCategory = sanitizeString(category || 'Other', 50);
      const sanitizedContent = sanitizeString(content, 100000); // 100KB制限

      if (!sanitizedTitle || !sanitizedContent) {
        return res.status(400).json({ message: 'title and content cannot be empty' });
      }

      // タグの検証
      let validTags = [];
      if (Array.isArray(tags)) {
        validTags = tags
          .filter(tag => typeof tag === 'string')
          .map(tag => sanitizeString(tag, 50))
          .filter(tag => tag.length > 0)
          .slice(0, 20); // 最大20タグ
      }

      const id = crypto.randomBytes(9).toString('hex');
      const now = new Date().toISOString();
      const tagsJson = JSON.stringify(validTags);

      await db.execute({
        sql: 'INSERT INTO cheat_items (id, user_id, title, category, tags, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [id, req.user.id, sanitizedTitle, sanitizedCategory, tagsJson, sanitizedContent, now, now],
      });

      return res.status(201).json({
        id,
        title: sanitizedTitle,
        category: sanitizedCategory,
        tags: validTags,
        content: sanitizedContent,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      console.error('Create item error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  // チートアイテムを更新
  app.put('/api/cheat-items/:id', requireAuth, async (req, res) => {
    try {
      const { title, category, tags, content } = req.body;

      if (!title || !content || typeof title !== 'string' || typeof content !== 'string') {
        return res.status(400).json({ message: 'title and content are required' });
      }

      const sanitizedTitle = sanitizeString(title, 200);
      const sanitizedCategory = sanitizeString(category || 'Other', 50);
      const sanitizedContent = sanitizeString(content, 100000);

      if (!sanitizedTitle || !sanitizedContent) {
        return res.status(400).json({ message: 'title and content cannot be empty' });
      }

      // タグの検証
      let validTags = [];
      if (Array.isArray(tags)) {
        validTags = tags
          .filter(tag => typeof tag === 'string')
          .map(tag => sanitizeString(tag, 50))
          .filter(tag => tag.length > 0)
          .slice(0, 20);
      }

      const tagsJson = JSON.stringify(validTags);
      const now = new Date().toISOString();

      // IDの検証（SQLインジェクション対策）
      const itemId = sanitizeString(req.params.id, 50);
      if (!itemId || !/^[a-f0-9]+$/.test(itemId)) {
        return res.status(400).json({ message: 'Invalid item ID' });
      }

      const result = await db.execute({
        sql: 'UPDATE cheat_items SET title = ?, category = ?, tags = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?',
        args: [sanitizedTitle, sanitizedCategory, tagsJson, sanitizedContent, now, itemId, req.user.id],
      });

      if (result.rowsAffected === 0) {
        return res.status(404).json({ message: 'Item not found' });
      }

      return res.json({
        id: itemId,
        title: sanitizedTitle,
        category: sanitizedCategory,
        tags: validTags,
        content: sanitizedContent,
        updatedAt: now,
      });
    } catch (err) {
      console.error('Update item error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  // チートアイテムを削除
  app.delete('/api/cheat-items/:id', requireAuth, async (req, res) => {
    try {
      // IDの検証
      const itemId = sanitizeString(req.params.id, 50);
      if (!itemId || !/^[a-f0-9]+$/.test(itemId)) {
        return res.status(400).json({ message: 'Invalid item ID' });
      }

      const result = await db.execute({
        sql: 'DELETE FROM cheat_items WHERE id = ? AND user_id = ?',
        args: [itemId, req.user.id],
      });

      // TursoのAPIはrowsAffectedプロパティを持つ可能性がある
      const rowsAffected = result.rowsAffected || (result.rows ? result.rows.length : 0);
      if (rowsAffected === 0) {
        return res.status(404).json({ message: 'Item not found' });
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('Delete item error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  // アカウント名を更新
  app.put('/api/account-name', requireAuth, async (req, res) => {
    try {
      const { account_name } = req.body;
      
      if (!account_name || typeof account_name !== 'string') {
        return res.status(400).json({ message: 'account_name is required' });
      }

      const sanitizedName = sanitizeString(account_name, 50);
      if (sanitizedName.length === 0) {
        return res.status(400).json({ message: 'account_name cannot be empty' });
      }

      // 不正な文字をチェック（XSS対策）
      if (/[<>\"'&]/.test(sanitizedName)) {
        return res.status(400).json({ message: 'account_name contains invalid characters' });
      }

      await db.execute({
        sql: 'UPDATE users SET account_name = ? WHERE id = ?',
        args: [sanitizedName, req.user.id],
      });

      return res.json({ 
        ok: true, 
        account_name: sanitizedName 
      });
    } catch (err) {
      console.error('Update account name error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  // static: if dist exists
  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.warn('dist not found; skipping static file serving (dev mode API only).');
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Using Turso database: ${process.env.TURSO_DATABASE_URL ? 'Yes' : 'No (check TURSO_DATABASE_URL)'}`);
  });
}

// launch
start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
