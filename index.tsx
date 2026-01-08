import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { CheatItem, User, ViewState, CategoryType, CATEGORIES } from './types';
import { Icons } from './constants';

// --- 日本語化ヘルパー ---
const CATEGORY_LABELS: Record<string, string> = {
  [CategoryType.CODE]: 'コード',
  [CategoryType.COMMAND]: 'コマンド',
  [CategoryType.RECIPE]: 'レシピ',
  [CategoryType.SHORTCUT]: 'ショートカット',
  [CategoryType.OTHER]: 'その他',
};

// --- Mock Data (日本語化) ---
const MOCK_USER: User = {
  id: 'u1',
  name: 'DevUser',
  avatarUrl: 'https://ui-avatars.com/api/?name=Dev+User&background=0d9488&color=fff'
};

// INITIAL_ITEMSは削除 - データベースから読み込む

// --- API (バックエンド) 設定 ---
// APIは相対パスで呼び出す（Viteのプロキシを使用）

async function loginApi(email: string, password: string) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || 'ログインに失敗しました');
  }

  return data;
}

async function signupApi(email: string, password: string) {
  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || 'サインアップに失敗しました');
  }

  return data;
}

async function logoutApi() {
  await fetch('/api/logout', {
    method: 'POST',
    credentials: 'include'
  });
}

async function getMe() {
  const res = await fetch('/api/me', {
    method: 'GET',
    credentials: 'include'
  });
  if (!res.ok) return null;
  return res.json(); // { user, isFirstLogin }
}

async function updateAccountName(accountName: string) {
  const res = await fetch('/api/account-name', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ account_name: accountName }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'アカウント名の更新に失敗しました');
  }
  return res.json();
}

// --- Cheat Items API ---
async function getCheatItems() {
  const res = await fetch('/api/cheat-items', {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch items');
  }
  const data = await res.json();
  return data.items || [];
}

async function getCheatItem(id: string) {
  const res = await fetch(`/api/cheat-items/${id}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch item');
  }
  return res.json();
}

async function createCheatItem(item: Omit<CheatItem, 'id' | 'createdAt' | 'updatedAt'>) {
  const res = await fetch('/api/cheat-items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to create item');
  }
  return res.json();
}

async function updateCheatItem(id: string, item: Omit<CheatItem, 'id' | 'createdAt' | 'updatedAt'>) {
  const res = await fetch(`/api/cheat-items/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to update item');
  }
  return res.json();
}

async function deleteCheatItem(id: string) {
  const res = await fetch(`/api/cheat-items/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to delete item');
  }
  return res.json();
}


// --- Components ---

// --- simple mock auth (index.tsx に組み込み) ---
// localStorage のキー
const STORAGE_TOKEN_KEY = 'auth_token';
const STORAGE_USER_KEY = 'auth_user';
const STORAGE_EXP_KEY = 'auth_exp'; // 有効期限（任意）



const LoginScreen = ({ onLogin }: { onLogin: (user: any) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignup, setShowSignup] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await loginApi(email, password);
      if (data && data.user) {
        onLogin(data.user);
      } else {
        setError('ログインに失敗しました');
      }
    } catch (err: any) {
      setError(err?.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signupApi(email, password);
      // サインアップ成功後、自動的にログイン
      const data = await loginApi(email, password);
      if (data && data.user) {
        onLogin(data.user);
      }
    } catch (err: any) {
      setError(err?.message || 'サインアップに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (showSignup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-t-8 border-primary-500">
          <div className="mb-6 flex justify-center text-primary-600">
            <Icons.Book />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">ReverseCheats</h1>
          <p className="text-gray-500 mb-8">新規アカウントを作成</p>
          
          <form onSubmit={handleSignup}>
            <div className="mb-3 text-left">
              <label className="text-sm text-slate-600">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>

            <div className="mb-4 text-left">
              <label className="text-sm text-slate-600">Password (8文字以上)</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={8}
                className="mt-1 w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>

            {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors shadow-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? '登録中...' : 'アカウントを作成'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setShowSignup(false);
              setError(null);
              setEmail('');
              setPassword('');
            }}
            className="mt-4 text-sm text-primary-600 hover:text-primary-700"
          >
            ログインに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-t-8 border-primary-500">
        <div className="mb-6 flex justify-center text-primary-600">
          <Icons.Book />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">ReverseCheats</h1>
        <p className="text-gray-500 mb-8">あなた専用のナレッジベース。<br/>コードやレシピなどを賢く管理。</p>
        
        <form onSubmit={handleLogin}>
          <div className="mb-3 text-left">
            <label className="text-sm text-slate-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="mb-4 text-left">
            <label className="text-sm text-slate-600">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors shadow-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'サインイン中...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowSignup(true)}
            className="w-full text-primary-600 hover:text-primary-700 font-medium py-2 text-sm transition-colors"
          >
            新規アカウントを作成
          </button>
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ 
  view, 
  setView, 
  user,
  onLogout 
}: { 
  view: ViewState; 
  setView: (v: ViewState) => void; 
  user: User;
  onLogout: () => void;
}) => {
  const navItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: Icons.Home },
    { id: 'list', label: 'すべてのノート', icon: Icons.Search },
  ];

  return (
    <div className="w-64 bg-primary-900 text-primary-50 flex flex-col h-full border-r border-primary-800 hidden md:flex">
      <div className="p-6 border-b border-primary-800">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-accent-400"><Icons.Book /></span>
          ReverseCheats
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as ViewState)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              view === item.id 
                ? 'bg-primary-800 text-white shadow-sm' 
                : 'text-primary-200 hover:bg-primary-800 hover:text-white'
            }`}
          >
            <span className="opacity-75"><item.icon /></span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-primary-800">
        <div className="flex items-center gap-3 px-2 mb-4">
          <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full border border-primary-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-primary-400 truncate">Proプラン</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-2 text-xs text-primary-400 hover:text-white px-2 py-1"
        >
          <Icons.LogOut /> ログアウト
        </button>
      </div>
    </div>
  );
};

const CategoryBadge = ({ category }: { category: string }) => {
  const colors: Record<string, string> = {
    [CategoryType.CODE]: 'bg-blue-100 text-blue-700',
    [CategoryType.COMMAND]: 'bg-slate-100 text-slate-700',
    [CategoryType.RECIPE]: 'bg-orange-100 text-orange-700',
    [CategoryType.SHORTCUT]: 'bg-purple-100 text-purple-700',
    [CategoryType.OTHER]: 'bg-gray-100 text-gray-700',
  };
  
  const icons: Record<string, any> = {
    [CategoryType.CODE]: Icons.Code,
    [CategoryType.RECIPE]: Icons.Coffee,
  }

  const Icon = icons[category] || Icons.Book;
  const label = CATEGORY_LABELS[category] || category;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[category] || colors[CategoryType.OTHER]}`}>
      <span className="w-3 h-3"><Icon /></span>
      {label}
    </span>
  );
};

// XSS対策：HTMLエスケープ関数
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

const MarkdownViewer = ({ content }: { content: string }) => {
  // Simple markdown renderer for demo purposes
  // XSS対策：すべてのユーザー入力をエスケープ
  const lines = content.split('\n');
  const rendered = [];
  let inCodeBlock = false;
  let codeBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // コードブロック内もエスケープ（ただし、コードなので表示用）
        const escapedCode = escapeHtml(codeBuffer.join('\n'));
        rendered.push(
          <div key={`code-${i}`} className="bg-slate-900 text-slate-50 p-4 rounded-lg my-3 font-mono text-sm overflow-x-auto relative group">
             <button 
               className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 bg-slate-700 p-1 rounded text-white transition-opacity" 
               title="コピー"
               onClick={() => {
                 navigator.clipboard.writeText(codeBuffer.join('\n')).catch(() => {});
               }}
             >
               <Icons.Copy />
             </button>
            <pre dangerouslySetInnerHTML={{ __html: escapedCode }} />
          </div>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
    } else if (inCodeBlock) {
      codeBuffer.push(line);
    } else {
      // すべてのテキストをエスケープ
      const escapedLine = escapeHtml(line);
      if (line.startsWith('# ')) {
        rendered.push(<h1 key={i} className="text-2xl font-bold text-slate-900 mt-6 mb-3" dangerouslySetInnerHTML={{ __html: escapedLine.replace('# ', '') }} />);
      } else if (line.startsWith('## ')) {
        rendered.push(<h2 key={i} className="text-lg font-bold text-slate-800 mt-4 mb-2" dangerouslySetInnerHTML={{ __html: escapedLine.replace('## ', '') }} />);
      } else if (line.startsWith('- ')) {
        rendered.push(<li key={i} className="ml-4 text-slate-700 mb-1 list-disc" dangerouslySetInnerHTML={{ __html: escapedLine.replace('- ', '') }} />);
      } else if (line.trim() === '') {
        rendered.push(<div key={i} className="h-2"></div>);
      } else {
        rendered.push(<p key={i} className="text-slate-600 mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: escapedLine }} />);
      }
    }
  }

  return <div className="prose prose-slate max-w-none">{rendered}</div>;
};

// --- Main Views ---

const Dashboard = ({ 
  user, 
  items, 
  onSearch, 
  onCreate,
  onShowAccountNameModal
}: { 
  user: User; 
  items: CheatItem[]; 
  onSearch: (q: string) => void;
  onCreate: () => void;
  onShowAccountNameModal?: () => void;
}) => {
  const [query, setQuery] = useState('');

  const displayName = user.account_name || '仮名';
  const hasAccountName = !!user.account_name;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const recentItems = [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3);

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      <header className="mb-10">
        <h2 className="text-3xl font-light text-slate-800 mb-1">
          こんにちは、<span className="font-semibold text-primary-700">{displayName}</span> さん。
        </h2>
        {!hasAccountName && onShowAccountNameModal && (
          <div className="mt-3">
            <button
              onClick={onShowAccountNameModal}
              className="text-sm text-primary-600 hover:text-primary-700 underline"
            >
              アカウント名を登録しますか？
            </button>
          </div>
        )}
        <p className="text-slate-500">今日は何を調べますか？</p>
      </header>

      <form onSubmit={handleSearch} className="mb-12 relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="コマンド、スニペット、レシピなどを検索..."
          className="w-full pl-12 pr-4 py-4 rounded-xl border-0 bg-white shadow-lg shadow-primary-900/5 text-lg placeholder-slate-400 focus:ring-2 focus:ring-primary-500 transition-shadow"
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-500">
          <Icons.Search />
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <button 
          onClick={onCreate}
          className="col-span-1 md:col-span-1 bg-gradient-to-r from-accent-500 to-accent-600 text-white p-4 rounded-xl shadow-md hover:shadow-lg transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <div className="bg-white/20 p-2 rounded-full group-hover:scale-110 transition-transform">
            <Icons.Plus />
          </div>
          <span className="font-semibold">新規作成</span>
        </button>
        <div className="col-span-1 md:col-span-2 bg-primary-600 text-white p-6 rounded-xl shadow-md relative overflow-hidden">
          <div className="relative z-10">
             <h3 className="font-bold text-lg mb-1">Proのヒント</h3>
             <p className="text-primary-100 text-sm">AIアシスタントを使えば、手書きのメモを瞬時に整形できます。</p>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
             <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3z"/></svg>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">最近の更新</h3>
        <div className="space-y-3">
          {recentItems.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm hover:border-primary-300 transition-colors flex items-center justify-between group cursor-pointer" onClick={() => onSearch(item.title)}>
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-primary-600 transition-colors">
                   {item.category === CategoryType.CODE ? <Icons.Code /> : item.category === CategoryType.RECIPE ? <Icons.Coffee /> : <Icons.Book />}
                 </div>
                 <div>
                   <h4 className="font-medium text-slate-800 group-hover:text-primary-700">{item.title}</h4>
                   <p className="text-xs text-slate-500">{new Date(item.updatedAt).toLocaleDateString()}</p>
                 </div>
              </div>
              <CategoryBadge category={item.category} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ListPage = ({ items, onSelect, onCreate }: { items: CheatItem[], onSelect: (id: string) => void, onCreate: () => void }) => {
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = items.filter(item => {
    const matchesCategory = filter === 'All' || item.category === filter;
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-6 md:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">マイチートシート</h2>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} 件見つかりました</p>
        </div>
        <button onClick={onCreate} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
          <Icons.Plus /> 新規作成
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
         <div className="relative flex-1">
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="キーワードで検索..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icons.Search /></div>
         </div>
         <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
           {['All', ...CATEGORIES].map(cat => (
             <button 
               key={cat}
               onClick={() => setFilter(cat)}
               className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border ${
                 filter === cat 
                 ? 'bg-primary-50 border-primary-200 text-primary-700 font-medium' 
                 : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
               }`}
             >
               {cat === 'All' ? 'すべて' : (CATEGORY_LABELS[cat] || cat)}
             </button>
           ))}
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-10">
        {filtered.map(item => (
          <div key={item.id} onClick={() => onSelect(item.id)} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-primary-300 transition-all cursor-pointer flex flex-col h-full">
            <div className="flex justify-between items-start mb-3">
              <CategoryBadge category={item.category} />
              <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span>
            </div>
            <h3 className="font-bold text-lg text-slate-800 mb-2 line-clamp-2">{item.title}</h3>
            <p className="text-slate-500 text-sm mb-4 line-clamp-3 flex-1">
              {item.content.replace(/[#*`]/g, '').substring(0, 100)}...
            </p>
            <div className="flex flex-wrap gap-1 mt-auto">
              {item.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">#{tag}</span>
              ))}
              {item.tags.length > 3 && <span className="text-xs text-slate-400 px-1">+{item.tags.length - 3}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DetailPage = ({ item, onBack, onEdit, onDelete }: { item: CheatItem, onBack: () => void, onEdit: () => void, onDelete: () => void }) => {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-primary-600 mb-6 transition-colors">
        <Icons.ArrowLeft /> 一覧に戻る
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <CategoryBadge category={item.category} />
              <span className="text-xs text-slate-400">最終更新: {new Date(item.updatedAt).toLocaleString()}</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">{item.title}</h1>
            <div className="flex flex-wrap gap-2 mt-4">
              {item.tags.map(tag => (
                <span key={tag} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-sm">#{tag}</span>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onEdit} className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="編集">
              <Icons.Edit />
            </button>
            <button onClick={onDelete} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="削除">
              <Icons.Trash />
            </button>
          </div>
        </div>
        <div className="p-6 md:p-8 bg-slate-50/50 min-h-[400px]">
          <MarkdownViewer content={item.content} />
        </div>
      </div>
    </div>
  );
};

const EditorPage = ({ 
  initialItem, 
  onSave, 
  onCancel 
}: { 
  initialItem?: CheatItem, 
  onSave: (item: Omit<CheatItem, 'id' | 'createdAt' | 'updatedAt'>) => void, 
  onCancel: () => void 
}) => {
  const [title, setTitle] = useState(initialItem?.title || '');
  const [category, setCategory] = useState(initialItem?.category || CategoryType.CODE);
  const [tags, setTags] = useState(initialItem?.tags.join(', ') || '');
  const [content, setContent] = useState(initialItem?.content || '');
  const [isThinking, setIsThinking] = useState(false);

  const handleAiFormat = async () => {
    if (!content.trim()) return;
    setIsThinking(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Using gemini-3-flash-preview as per guidelines for basic text tasks
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `あなたは技術ドキュメントのアシスタントです。
        以下のラフなメモを、きれいで構造化されたMarkdown形式に整形してください。
        コードが含まれる場合は、適切な言語指定を行ったコードブロックを使用してください。
        レシピやリストの場合は、箇条書きを使用してください。
        簡潔にまとめてください。
        
        ラフなメモ:
        ${content}`,
      });
      
      const text = response.text;
      if (text) {
        setContent(text);
      }
    } catch (e) {
      console.error("AI Error:", e);
      alert("AIへの接続に失敗しました。もう一度お試しください。");
    } finally {
      setIsThinking(false);
    }
  };

  const handleSave = () => {
    if (!title || !content) {
      alert("タイトルと内容は必須です");
      return;
    }
    onSave({
      title,
      category,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      content
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{initialItem ? 'チートシートを編集' : '新しいチートシート'}</h2>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">キャンセル</button>
          <button onClick={handleSave} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2 shadow-sm transition-colors">
            <Icons.Save /> 保存
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">タイトル</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="例: Gitの取り消し"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">カテゴリー</label>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">タグ (カンマ区切り)</label>
            <input 
              type="text" 
              value={tags} 
              onChange={e => setTags(e.target.value)} 
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="例: git, bash, 重要"
            />
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col relative bg-slate-50">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-slate-700">内容 (Markdown)</label>
            <button 
              onClick={handleAiFormat}
              disabled={isThinking}
              className={`text-xs px-3 py-1.5 rounded-full border border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100 flex items-center gap-1 transition-all ${isThinking ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isThinking ? (
                <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-accent-600 border-t-transparent"></span>
              ) : (
                <Icons.Sparkles />
              )}
              {isThinking ? '整形中...' : 'AI整形'}
            </button>
          </div>
          <textarea 
            value={content}
            onChange={e => setContent(e.target.value)}
            className="flex-1 w-full p-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm leading-relaxed resize-none"
            placeholder="# ここにメモを入力...&#10;箇条書きやラフなメモでも、'AI整形'ボタンできれいに直せます。"
          />
        </div>
      </div>
    </div>
  );
};

// --- App Container ---

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('login');
  const [items, setItems] = useState<CheatItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAccountNameModal, setShowAccountNameModal] = useState(false);
  const [accountNameInput, setAccountNameInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // チートアイテムを読み込む
  const loadItems = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const fetchedItems = await getCheatItems();
      setItems(fetchedItems);
    } catch (e) {
      console.error('Failed to load items:', e);
    } finally {
      setLoading(false);
    }
  };

  // バックエンドのuserオブジェクトをフロントエンドのUser型に変換
  const convertUser = (backendUser: any): User => {
    return {
      id: String(backendUser.id),
      name: backendUser.account_name || '仮名',
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(backendUser.account_name || backendUser.email || 'User')}&background=0d9488&color=fff`,
      account_name: backendUser.account_name || null,
    };
  };

  // ユーザー情報を再取得
  const refreshUser = async () => {
    try {
      const data = await getMe();
      if (data && data.user) {
        setUser(convertUser(data.user));
      }
    } catch (e) {
      console.warn('Could not refresh user', e);
    }
  };

  // 起動時にログイン状態を復元し、データを読み込む
  useEffect(() => {
    (async () => {
      try {
        const data = await getMe();
        if (data && data.user) {
          setUser(convertUser(data.user));
          setView(prev => prev === 'login' ? 'dashboard' : prev);
          // 初回ログインでアカウント名が未登録の場合、モーダルを表示
          if (data.isFirstLogin && !data.user.account_name) {
            setShowAccountNameModal(true);
          }
        }
      } catch (e) {
        console.warn('Could not restore session', e);
      }
    })();
  }, []);

  // ユーザーがログインしたらデータを読み込む
  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [user]);

  // Login handler: LoginScreen が成功時に onLogin() を呼んだら実行
  const handleLogin = async (loggedInUser: any) => {
    try {
      // ログイン後にユーザー情報を再取得（isFirstLoginを含む）
      const data = await getMe();
      if (data && data.user) {
        setUser(convertUser(data.user));
        setView('dashboard');
        // データを読み込む
        await loadItems();
        // 初回ログインでアカウント名が未登録の場合、モーダルを表示
        if (data.isFirstLogin && !data.user.account_name) {
          setShowAccountNameModal(true);
        }
      } else {
        setUser(convertUser(loggedInUser));
        setView('dashboard');
        await loadItems();
      }
    } catch (e) {
      console.warn('handleLogin error', e);
    }
  };

  // アカウント名更新ハンドラ
  const handleAccountNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountNameInput.trim()) return;
    
    setIsUpdating(true);
    try {
      await updateAccountName(accountNameInput.trim());
      setShowAccountNameModal(false);
      setAccountNameInput('');
      await refreshUser();
    } catch (err: any) {
      alert(err.message || 'アカウント名の更新に失敗しました');
    } finally {
      setIsUpdating(false);
    }
  };

  // Logout handler: サーバに /api/logout を投げる
const handleLogout = async () => {
  try {
    await logoutApi();
  } catch (e) {
    console.warn('logoutApi failed', e);
  }
  setUser(null);
  setView('login');
};

  const handleCreate = () => {
    setSelectedItemId(null);
    setView('create');
  };

  const handleSelect = (id: string) => {
    setSelectedItemId(id);
    setView('detail');
  };

  const handleEdit = () => {
    setView('edit');
  };

  const handleDelete = async () => {
    if (!selectedItemId) return;
    if (confirm("本当にこの項目を削除しますか？")) {
      try {
        setLoading(true);
        await deleteCheatItem(selectedItemId);
        setItems(items.filter(i => i.id !== selectedItemId));
        setView('list');
      } catch (e: any) {
        console.error('Failed to delete item:', e);
        alert(e.message || '削除に失敗しました');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveItem = async (data: Omit<CheatItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      if (view === 'create') {
        const newItem = await createCheatItem(data);
        setItems([newItem, ...items]);
      } else if (selectedItemId) {
        const updatedItem = await updateCheatItem(selectedItemId, data);
        setItems(items.map(item => 
          item.id === selectedItemId ? updatedItem : item
        ));
      }
      setView('list');
    } catch (e: any) {
      console.error('Failed to save item:', e);
      alert(e.message || '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchNavigation = (query: string) => {
    // Ideally pass query to list, for now just go to list
    setView('list');
  };

  if (!user || view === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      {showAccountNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-slate-800 mb-4">アカウント名を登録</h3>
            <p className="text-slate-600 mb-6">あなたのアカウント名を入力してください。</p>
            <form onSubmit={handleAccountNameSubmit}>
              <input
                type="text"
                value={accountNameInput}
                onChange={(e) => setAccountNameInput(e.target.value)}
                placeholder="アカウント名"
                maxLength={50}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-4"
                required
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountNameModal(false);
                    setAccountNameInput('');
                  }}
                  className="flex-1 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  disabled={isUpdating}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isUpdating || !accountNameInput.trim()}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isUpdating ? '登録中...' : '登録'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Sidebar view={view} setView={setView} user={user} onLogout={handleLogout} />
      
      <main className="flex-1 overflow-y-auto relative">
        {/* Mobile Header */}
        <div className="md:hidden bg-primary-900 text-white p-4 flex justify-between items-center sticky top-0 z-20">
           <span className="font-bold">ReverseCheats</span>
           <button onClick={handleLogout}><Icons.LogOut /></button>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-50">
            <div className="text-slate-600">読み込み中...</div>
          </div>
        )}
        
        {view === 'dashboard' && (
          <Dashboard 
            user={user} 
            items={items} 
            onSearch={handleSearchNavigation} 
            onCreate={handleCreate} 
            onShowAccountNameModal={() => setShowAccountNameModal(true)} 
          />
        )}
        
        {view === 'list' && (
          <ListPage items={items} onSelect={handleSelect} onCreate={handleCreate} />
        )}

        {view === 'detail' && selectedItemId && (
          <DetailPage 
            item={items.find(i => i.id === selectedItemId)!} 
            onBack={() => setView('list')}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        {(view === 'create' || view === 'edit') && (
          <EditorPage 
            initialItem={view === 'edit' ? items.find(i => i.id === selectedItemId) : undefined}
            onSave={handleSaveItem}
            onCancel={() => setView(selectedItemId ? 'detail' : 'dashboard')}
          />
        )}
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);