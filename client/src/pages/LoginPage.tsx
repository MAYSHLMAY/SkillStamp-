import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { apiFetch, type ApiUser } from '../lib/api';

export function LoginPage(): JSX.Element {
  const { user, setSession } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user) nav(user.role === 'employer' ? '/employer/dashboard' : '/candidate/dashboard', { replace: true });
  }, [user, nav]);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const res = await apiFetch<{ token: string; user: ApiUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      token: null,
    });
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setSession(res.data.token, res.data.user);
    nav(from && from !== '/login' ? from : res.data.user.role === 'employer' ? '/employer/dashboard' : '/candidate/dashboard');
  }

  return (
    <div className="page authPage">
      <form className="card authCard" onSubmit={onSubmit}>
        <div className="tagline">No CV. Just proof.</div>
        <div className="authBrand">
          <span className="nav__dot" />
          <span className="nav__word" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800 }}>
            SkillStamp
          </span>
        </div>
        <h2>Welcome back</h2>
        <label className="authLabel">
          Email
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label className="authLabel">
          Password
          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        <button className="btn btn--primary" style={{ width: '100%' }} type="submit">
          Login
        </button>
        <p className="authFooter">
          No account? <Link to="/register">Register</Link>
        </p>
      </form>
      <style>{`
        .authPage{ min-height: calc(100vh - 40px); display:flex; align-items:center; justify-content:center; }
        .authCard{ width: min(520px, 100%); display:flex; flex-direction:column; gap: 14px; }
        .authBrand{ display:flex; align-items:center; gap:10px; margin-top: 6px; }
        .authLabel{ display:flex; flex-direction:column; gap:8px; color: var(--text-secondary); font-size: 13px; font-weight: 600; }
        .authFooter{ color: var(--text-secondary); text-align:center; margin: 0; }
        .authFooter a{ color: var(--accent); font-weight: 700; }
      `}</style>
    </div>
  );
}
