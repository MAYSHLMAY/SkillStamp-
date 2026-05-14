import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';

type JobRow = {
  id: string;
  title: string;
  applicantCount: number;
  scoreSamples: number[];
  topScorer: { score: number; name: string; candidateId: string } | null;
};

type DashboardPayload = {
  stats: {
    activeJobs: number;
    applicantsThisWeek: number;
    sessionsCompleted: number;
    avgApplicantScore: number;
  };
  jobs: JobRow[];
};

export function EmployerDashboardPage(): JSX.Element {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['employer', 'jobs', 'dashboard'],
    queryFn: async () => {
      const res = await apiFetch<DashboardPayload>('/api/employer/jobs');
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  const startSession = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiFetch<{ sessionId: string }>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ applicationId }),
      });
      if (!res.success) throw new Error(res.error);
      return res.data.sessionId;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employer', 'jobs', 'dashboard'] });
      void qc.invalidateQueries({ queryKey: ['sessions', 'employer'] });
    },
  });

  if (q.isPending) return <div className="page">Loading…</div>;
  if (q.isError || !q.data) return <div className="page">Failed to load dashboard.</div>;

  const { stats, jobs } = q.data;

  return (
    <div className="page">
      <div className="tagline">No CV. No resume. No uploads. Just proof.</div>
      <div className="statGrid">
        <div className="card statCard">
          <div className="statCard__k">Active jobs posted</div>
          <div className="statCard__v">{stats.activeJobs}</div>
        </div>
        <div className="card statCard">
          <div className="statCard__k">Applicants this week</div>
          <div className="statCard__v">{stats.applicantsThisWeek}</div>
        </div>
        <div className="card statCard">
          <div className="statCard__k">Sessions completed</div>
          <div className="statCard__v">{stats.sessionsCompleted}</div>
        </div>
        <div className="card statCard">
          <div className="statCard__k">Average applicant score</div>
          <div className="statCard__v">{stats.avgApplicantScore}</div>
        </div>
      </div>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 12 }}>Posted jobs</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {jobs.map((j) => (
            <div key={j.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", fontSize: 20 }}>{j.title}</div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 6 }}>{j.applicantCount} applicants</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Top scorer</div>
                  <div style={{ fontWeight: 800 }}>
                    {j.topScorer ? `${j.topScorer.name} · ${j.topScorer.score}` : '—'}
                  </div>
                </div>
              </div>
              <MiniDistribution samples={j.scoreSamples} />
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <Link className="btn btn--ghost" to={`/employer/jobs/${j.id}/applicants`}>
                  View leaderboard
                </Link>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={startSession.isPending || !j.topScorer}
                  onClick={async () => {
                    try {
                      const top = j.topScorer;
                      if (!top) return;
                      const apps = await apiFetch<{
                        applicants: { id: string; candidateId: string; overallScore: number }[];
                      }>(`/api/employer/jobs/${j.id}/applicants`);
                      if (!apps.success) throw new Error(apps.error);
                      const row = apps.data.applicants.find((a) => a.candidateId === top.candidateId);
                      if (!row) throw new Error('Applicant not found');
                      await startSession.mutateAsync(row.id);
                      toast.success('Session created');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed');
                    }
                  }}
                >
                  Start Session
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .statGrid{ display:grid; gap:12px; grid-template-columns: 1fr; margin-top: 16px; }
        @media (min-width: 900px){ .statGrid{ grid-template-columns: repeat(4, 1fr); } }
        .statCard__k{ color: var(--text-secondary); font-size: 13px; font-weight: 700; }
        .statCard__v{ font-size: 34px; font-weight: 900; font-family: 'Space Grotesk', sans-serif; margin-top: 8px; }
      `}</style>
    </div>
  );
}

function MiniDistribution({ samples }: { samples: number[] }): JSX.Element {
  const bins = [0, 0, 0, 0, 0];
  for (const s of samples) {
    const b = Math.min(4, Math.floor(s / 20));
    bins[b] += 1;
  }
  const max = Math.max(1, ...bins);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginTop: 12, height: 44 }}>
      {bins.map((c, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
          <div
            style={{
              height: `${Math.round((c / max) * 36)}px`,
              borderRadius: 8,
              background: 'linear-gradient(180deg, var(--accent), rgba(108,99,255,0.2))',
              border: '1px solid var(--border)',
            }}
          />
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            {i * 20}
          </div>
        </div>
      ))}
    </div>
  );
}
