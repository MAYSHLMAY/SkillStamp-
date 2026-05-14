import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { apiFetch, type ApiUser } from '../lib/api';

export function RegisterPage(): JSX.Element {
  const { user, setSession } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const afterJobId = (location.state as { afterRegisterJobId?: string } | null)?.afterRegisterJobId;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'candidate' | 'employer'>('candidate');

  useEffect(() => {
    if (user) nav(user.role === 'employer' ? '/employer/dashboard' : '/candidate/dashboard', { replace: true });
  }, [user, nav]);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const res = await apiFetch<{ token: string; user: ApiUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
      token: null,
    });
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setSession(res.data.token, res.data.user);
    if (res.data.user.role === 'candidate' && afterJobId) {
      nav(`/jobs/${afterJobId}/apply`, { replace: true });
      return;
    }
    nav(res.data.user.role === 'employer' ? '/employer/dashboard' : '/candidate/dashboard', { replace: true });
  }

  return (
    <div className="page authPage">
      <form className="card authCard" onSubmit={onSubmit}>
        <div className="tagline">No CV. Just proof.</div>
        <h2>Join SkillStamp</h2>
        <label className="authLabel">
          Name
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
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

        <div className="roleGrid">
          <button
            type="button"
            className={`roleCard ${role === 'candidate' ? 'roleCard--on' : ''}`}
            onClick={() => setRole('candidate')}
          >
            <div className="roleCard__title">I&apos;m looking for work</div>
            <div className="roleCard__sub">Candidate</div>
          </button>
          <button
            type="button"
            className={`roleCard ${role === 'employer' ? 'roleCard--on' : ''}`}
            onClick={() => setRole('employer')}
          >
            <div className="roleCard__title">I&apos;m hiring</div>
            <div className="roleCard__sub">Employer</div>
          </button>
        </div>

        <button className="btn btn--primary" style={{ width: '100%' }} type="submit">
          Register
        </button>
        <p className="authFooter">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
      <style>{`
        .authPage{ min-height: calc(100vh - 40px); display:flex; align-items:center; justify-content:center; }
        .authCard{ width: min(560px, 100%); display:flex; flex-direction:column; gap: 14px; }
        .authLabel{ display:flex; flex-direction:column; gap:8px; color: var(--text-secondary); font-size: 13px; font-weight: 600; }
        .authFooter{ color: var(--text-secondary); text-align:center; margin: 0; }
        .authFooter a{ color: var(--accent); font-weight: 700; }
        .roleGrid{ display:grid; grid-template-columns:1fr; gap:12px; }
        @media (min-width: 700px){ .roleGrid{ grid-template-columns: 1fr 1fr; } }
        .roleCard{
          text-align:left;
          border: 1px solid var(--border);
          background: #0d0d14;
          color: var(--text-primary);
          border-radius: var(--radius-md);
          padding: 16px;
          cursor:pointer;
          transition: all 0.15s ease;
        }
        .roleCard--on{
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-dim);
        }
        .roleCard__title{ font-weight: 800; font-family: 'Space Grotesk', sans-serif; }
        .roleCard__sub{ color: var(--text-secondary); margin-top: 6px; font-size: 13px; }
      `}</style>
    </div>
  );
}
