import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';

type AppRow = {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  answers: {
    challengeIndex: number;
    score?: { accuracy: number; speed_proxy: number; complexity: number; overall: number };
  }[];
  overallScore?: number;
  status: 'pending' | 'invited' | 'rejected' | 'completed';
  activeSessionId?: string | null;
};

type SessionRow = {
  id: string;
  jobTitle: string;
  companyName: string;
  status: string;
  startTime: string;
  duration?: number;
  hash?: string;
};

export function CandidateDashboardPage(): JSX.Element {
  const appsQ = useQuery({
    queryKey: ['applications', 'candidate'],
    queryFn: async () => {
      const res = await apiFetch<AppRow[]>('/api/applications/candidate');
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  const sessQ = useQuery({
    queryKey: ['sessions', 'candidate'],
    queryFn: async () => {
      const res = await apiFetch<{ sessions: SessionRow[] }>('/api/sessions/candidate');
      if (!res.success) throw new Error(res.error);
      return res.data.sessions;
    },
  });

  const agg = useMemo(() => {
    const apps = appsQ.data ?? [];
    let acc = 0;
    let sp = 0;
    let cx = 0;
    let n = 0;
    for (const a of apps) {
      for (const ans of a.answers) {
        if (!ans.score) continue;
        acc += ans.score.accuracy;
        sp += ans.score.speed_proxy;
        cx += ans.score.complexity;
        n += 1;
      }
    }
    const overall = n ? Math.round((acc + sp + cx) / (3 * n)) : 0;
    return {
      accuracy: n ? Math.round(acc / n) : 0,
      speed: n ? Math.round(sp / n) : 0,
      complexity: n ? Math.round(cx / n) : 0,
      overall,
      verified: overall >= 75,
    };
  }, [appsQ.data]);

  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="page">
      <div className="tagline">No CV. No resume. No uploads. Just proof.</div>
      <section className="card scoreHero">
        <div className="scoreHero__left">
          <div className="ring" style={{ ['--p' as string]: `${agg.overall}%` }}>
            <div className="ring__inner">
              <div className="ring__num">{agg.overall}</div>
              <div className="ring__lbl">Verified score</div>
            </div>
          </div>
        </div>
        <div className="scoreHero__right">
          <Bar label="Accuracy" value={agg.accuracy} />
          <Bar label="Speed" value={agg.speed} />
          <Bar label="Complexity" value={agg.complexity} />
          <div style={{ marginTop: 12 }}>
            <span className={`pill ${agg.verified ? 'pill--success' : 'pill--warn'}`}>
              {agg.verified ? 'Verified ✓' : 'Under Review ⚠'}
            </span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 12 }}>My Applications</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {(appsQ.data ?? []).map((a) => (
            <div key={a.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>{a.jobTitle}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{a.companyName}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusPill status={a.status} />
                  {typeof a.overallScore === 'number' ? (
                    <span className="pill pill--accent">Score {a.overallScore}</span>
                  ) : null}
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn--ghost" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
                  View details
                </button>
                {a.status === 'invited' && a.activeSessionId ? (
                  <Link className="btn btn--primary joinPulse" to={`/candidate/sessions/${a.activeSessionId}`}>
                    Join Session →
                  </Link>
                ) : null}
              </div>
              {openId === a.id ? (
                <div style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
                  {a.answers.map((ans) => (
                    <div key={ans.challengeIndex} className="mono" style={{ fontSize: 12, marginTop: 6 }}>
                      Challenge {ans.challengeIndex + 1}:{' '}
                      {ans.score ? `${ans.score.overall} overall` : 'Not scored'}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 12 }}>My Sessions</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {(sessQ.data ?? []).map((s) => (
            <div key={s.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{s.jobTitle}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {new Date(s.startTime).toLocaleString()} · {s.duration ? `${s.duration}s` : '—'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={async () => {
                    const url = `${window.location.origin}/verify/${s.id}`;
                    await navigator.clipboard.writeText(url);
                    toast.success('Verification link copied');
                  }}
                >
                  Copy verification link
                </button>
              </div>
              {s.hash ? (
                <div className="mono" style={{ marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {s.hash.slice(0, 16)}…
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .scoreHero{ display:grid; grid-template-columns:1fr; gap: 18px; align-items:center; }
        @media (min-width: 900px){ .scoreHero{ grid-template-columns: 280px 1fr; } }
        .ring{
          width: 220px; height: 220px; border-radius: 999px;
          margin: 0 auto;
          background: conic-gradient(var(--accent) calc(var(--p) * 1%), rgba(255,255,255,0.08) 0);
          display:flex; align-items:center; justify-content:center;
          animation: ringIn 900ms ease both;
        }
        .ring__inner{
          width: 170px; height: 170px; border-radius: 999px;
          background: var(--bg-base);
          border: 1px solid var(--border);
          display:flex; flex-direction:column; align-items:center; justify-content:center; gap: 6px;
        }
        .ring__num{ font-size: 44px; font-family: 'Space Grotesk', sans-serif; font-weight: 800; }
        .ring__lbl{ color: var(--text-secondary); font-size: 12px; font-weight: 700; }
        @keyframes ringIn{ from{ transform: rotate(-8deg) scale(.98); opacity:.0 } to{ transform: rotate(0) scale(1); opacity:1 } }
        .bar{ margin-top: 12px; }
        .bar__top{ display:flex; justify-content:space-between; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
        .bar__track{ height: 10px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); overflow:hidden; }
        .bar__fill{ height: 100%; background: linear-gradient(90deg, var(--accent), #9b93ff); width: calc(var(--v) * 1%); transition: width 600ms ease; }
        .joinPulse{ animation: pulseBtn 1.2s ease-in-out infinite; }
        @keyframes pulseBtn{ 0%{ box-shadow: 0 0 0 0 rgba(29,158,117,.35)} 70%{ box-shadow: 0 0 0 12px rgba(29,158,117,0)} 100%{ box-shadow: 0 0 0 0 rgba(29,158,117,0)} }
      `}</style>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="bar">
      <div className="bar__top">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="bar__track">
        <div className="bar__fill" style={{ ['--v' as string]: String(value) }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: AppRow['status'] }): JSX.Element {
  const label =
    status === 'pending'
      ? 'Pending review'
      : status === 'invited'
        ? 'Invited to session'
        : status === 'rejected'
          ? 'Rejected'
          : 'Completed';
  const cls =
    status === 'invited' ? 'pill--success' : status === 'rejected' ? 'pill--danger' : status === 'completed' ? 'pill--muted' : 'pill--warn';
  return <span className={`pill ${cls}`}>{label}</span>;
}
