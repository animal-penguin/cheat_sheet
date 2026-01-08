import React, { useState } from 'react';

export const SignupForm: React.FC<{ onSignedUp?: () => void}> = ({ onSignedUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      if (res.status === 201) {
        onSignedUp?.();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Signup failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required />
      {error && <div style={{color:'red'}}>{error}</div>}
      <button type="submit" disabled={loading}>{loading ? 'Signing up...' : 'Sign up'}</button>
    </form>
  );
};
