import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';

type Job = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  companyName: string;
  applyingNow: number;
};

const socketUrl = import.meta.env.VITE_SOCKET_URL ?? '';

export function JobsPage(): JSX.Element {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [online, setOnline] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const jobsQuery = useQuery({
    queryKey: ['jobs', 'list'],
    queryFn: async () => {
      const res = await apiFetch<Job[]>('/api/jobs');
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const merged = useMemo(() => {
    const rows = jobsQuery.data ?? [];
    return rows.map((j) => ({ ...j, applyingNow: counts[j.id] ?? j.applyingNow ?? 0 }));
  }, [jobsQuery.data, counts]);

  useEffect(() => {
    const s: Socket = io(socketUrl || undefined, { transports: ['websocket', 'polling'] });
    s.on('online:count', (n: number) => setOnline(n));
    s.on('job:applying_count', (p: { jobId: string; count: number }) => {
      setCounts((prev) => ({ ...prev, [p.jobId]: p.count }));
    });
    if (user) s.emit('user:connect', { userId: user.id, role: user.role });
    return () => {
      s.disconnect();
    };
  }, [user]);

  const heroRef = (node: HTMLElement | null) => {
    if (!node) return;
    /* reserved for scroll target */
  };

  return (
    <div className="page">
      <section className="jobsHero" ref={heroRef}>
        <div className="tagline">No CV. Just proof.</div>
        <h1 className="jobsHero__title">Get hired by what you can do — not what&apos;s on your CV</h1>
        <p className="jobsHero__sub">
          Complete AI-generated challenges. Get scored. Get hired. No resume required.
        </p>
        <div className="jobsHero__cta">
          <button type="button" className="btn btn--primary" onClick={() => document.getElementById('board')?.scrollIntoView({ behavior: 'smooth' })}>
            Browse Jobs
          </button>
          <Link to="/register" className="btn btn--ghost">
            Register Free
          </Link>
        </div>
        <p className="jobsHero__live">
          <span className="nav__pulse" style={{ display: 'inline-block', marginRight: 8 }} />
          {online} professionals online right now
        </p>
        <p className="jobsHero__proof">No CV. No resume. No uploads. Just proof.</p>
      </section>

      <div id="board" style={{ height: 8 }} />

      {jobsQuery.isPending ? (
        <div className="jobsGrid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card jobCard jobCard--skeleton shimmer" />
          ))}
        </div>
      ) : jobsQuery.isError ? (
        <div className="card">Could not load jobs.</div>
      ) : (
        <div className="jobsGrid">
          {merged.map((job) => (
            <article key={job.id} className="card jobCard">
              <div className="jobCard__company">{job.companyName}</div>
              <h3 className="jobCard__title">{job.title}</h3>
              <p className="jobCard__desc">{job.description}</p>
              <div className="jobCard__skills">
                {job.skills.slice(0, 6).map((s) => (
                  <span key={s} className="pill pill--muted">
                    {s}
                  </span>
                ))}
              </div>
              <div className="jobCard__row">
                <span className="jobCard__applyCount">{job.applyingNow} applying now</span>
                <Link
                  to={
                    !user
                      ? '/register'
                      : user.role === 'candidate'
                        ? `/jobs/${job.id}/apply`
                        : '/employer/dashboard'
                  }
                  state={!user ? { afterRegisterJobId: job.id } : undefined}
                  className="btn btn--primary"
                  onMouseEnter={() => {
                    void qc.prefetchQuery({
                      queryKey: ['jobs', 'detail', job.id],
                      queryFn: async () => {
                        const res = await apiFetch<unknown>(`/api/jobs/${job.id}`);
                        if (!res.success) throw new Error(res.error);
                        return res.data;
                      },
                    });
                  }}
                >
                  Apply — No CV
                </Link>
              </div>
              <div className="jobCard__banner">No CV. No resume. No uploads. Just proof.</div>
            </article>
          ))}
        </div>
      )}

      <style>{`
        .jobsHero { text-align:center; padding: 32px 0 8px; }
        .jobsHero__title { font-size: clamp(28px, 4vw, 44px); line-height:1.05; margin: 12px 0; }
        .jobsHero__sub { color: var(--text-secondary); max-width: 720px; margin: 0 auto; font-size: 16px; }
        .jobsHero__cta { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin: 20px 0 8px; }
        .jobsHero__live { color: var(--text-secondary); margin-top: 16px; }
        .jobsHero__proof { margin-top: 10px; font-weight: 800; color: var(--text-primary); }
        .jobsGrid { display:grid; gap:16px; grid-template-columns:1fr; margin-top: 24px; }
        @media (min-width: 700px){ .jobsGrid{ grid-template-columns: repeat(2, 1fr);} }
        @media (min-width: 1100px){ .jobsGrid{ grid-template-columns: repeat(3, 1fr);} }
        .jobCard{ display:flex; flex-direction:column; gap:12px; transform: translateZ(0); }
        .jobCard:hover{ transform: translateY(-2px); }
        .jobCard__company{ color: var(--text-tertiary); font-size: 13px; font-weight: 600; }
        .jobCard__title{ font-size: 22px; }
        .jobCard__desc{ color: var(--text-secondary); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height: 44px; }
        .jobCard__skills{ display:flex; flex-wrap:wrap; gap:8px; }
        .jobCard__row{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top: 4px; }
        .jobCard__applyCount{ color: var(--text-secondary); font-size: 13px; font-weight: 600; }
        .jobCard__banner{ font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--accent); }
        .jobCard--skeleton{ height: 240px; padding:0; border:none; }
      `}</style>
    </div>
  );
}
