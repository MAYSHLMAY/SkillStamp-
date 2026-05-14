import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';

type Applicant = {
  rank: number;
  id: string;
  candidateId: string;
  candidateName: string;
  overallScore: number;
  status: string;
  answers: { challengeIndex: number; text: string; score?: { accuracy: number; speed_proxy: number; complexity: number; overall: number } }[];
};

export function ApplicantsPage(): JSX.Element {
  const { jobId } = useParams();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['employer', 'applicants', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const res = await apiFetch<{ job: { id: string; title: string; companyName: string }; applicants: Applicant[] }>(
        `/api/employer/jobs/${jobId}/applicants`
      );
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  const invite = useMutation({
    mutationFn: async (applicationId: string) => {
      const s = await apiFetch<{ sessionId: string }>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ applicationId }),
      });
      if (!s.success) throw new Error(s.error);
      return applicationId;
    },
    onMutate: async (applicationId) => {
      await qc.cancelQueries({ queryKey: ['employer', 'applicants', jobId] });
      const prev = qc.getQueryData<{ job: unknown; applicants: Applicant[] }>(['employer', 'applicants', jobId]);
      if (prev) {
        qc.setQueryData(['employer', 'applicants', jobId], {
          ...prev,
          applicants: prev.applicants.map((a) =>
            a.id === applicationId ? { ...a, status: 'invited' } : a
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['employer', 'applicants', jobId], ctx.prev);
      toast.error('Invite failed');
    },
    onSuccess: () => {
      toast.success('Invited');
      void qc.invalidateQueries({ queryKey: ['employer', 'applicants', jobId] });
      void qc.invalidateQueries({ queryKey: ['employer', 'jobs', 'dashboard'] });
      void qc.invalidateQueries({ queryKey: ['sessions', 'employer'] });
      void qc.invalidateQueries({ queryKey: ['applications', 'candidate'] });
    },
  });

  const reject = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiFetch(`/api/applications/${applicationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employer', 'applicants', jobId] });
    },
    onError: () => toast.error('Reject failed'),
  });

  const rows = useMemo(() => q.data?.applicants ?? [], [q.data]);

  if (q.isPending) return <div className="page">Loading…</div>;
  if (q.isError || !q.data) return <div className="page">Not found</div>;

  return (
    <div className="page">
      <Link to="/employer/dashboard" className="btn btn--ghost" style={{ marginBottom: 12 }}>
        ← Dashboard
      </Link>
      <h1>{q.data.job.title}</h1>
      <p style={{ color: 'var(--text-secondary)' }}>Ranked by verified performance — no CVs</p>
      <div className="tagline" style={{ marginTop: 8 }}>
        No CV. No resume. No uploads. Just proof.
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
        {rows.map((a) => (
          <div key={a.id} className="card">
            <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 34, color: 'var(--text-tertiary)', fontWeight: 900 }}>{a.rank}</div>
              <div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      display: 'grid',
                      placeItems: 'center',
                      border: '1px solid var(--border)',
                      fontWeight: 900,
                    }}
                  >
                    {a.candidateName.slice(0, 1)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 900 }}>{a.candidateName}</div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {a.overallScore}/100
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)' }}>
                  <div
                    style={{
                      width: `${Math.min(100, a.overallScore)}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: 'linear-gradient(90deg, var(--accent), #9b93ff)',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {a.answers.map((ans) => (
                    <span key={ans.challengeIndex} className="pill pill--muted">
                      C{ans.challengeIndex + 1}: A {ans.score?.accuracy ?? '—'} · S {ans.score?.speed_proxy ?? '—'} · X{' '}
                      {ans.score?.complexity ?? '—'}
                    </span>
                  ))}
                  <span className="pill pill--accent">{a.status}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn--ghost inviteBtn"
                  disabled={invite.isPending}
                  onClick={() => invite.mutate(a.id)}
                >
                  Invite to Session
                </button>
                <button type="button" className="btn btn--ghost rejectBtn" onClick={() => reject.mutate(a.id)}>
                  Reject
                </button>
              </div>
            </div>
            <button type="button" className="btn btn--ghost" style={{ marginTop: 12 }} onClick={() => setOpen(open === a.id ? null : a.id)}>
              {open === a.id ? 'Hide answers' : 'Expand answers'}
            </button>
            {open === a.id ? (
              <div style={{ marginTop: 10, color: 'var(--text-secondary)' }}>
                {a.answers.map((ans) => (
                  <div key={ans.challengeIndex} className="card" style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 800 }}>Challenge {ans.challengeIndex + 1}</div>
                    <div style={{ marginTop: 8 }}>{ans.text}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <style>{`
        .inviteBtn:hover{ border-color: rgba(29,158,117,0.55) !important; color: var(--success) !important; }
        .rejectBtn:hover{ border-color: rgba(226,75,74,0.55) !important; color: var(--danger) !important; }
      `}</style>
    </div>
  );
}
