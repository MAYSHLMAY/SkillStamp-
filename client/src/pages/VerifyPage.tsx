import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';

type VerifyData =
  | { valid: false }
  | {
      valid: true;
      sessionId: string;
      candidateName?: string;
      employerName?: string;
      jobTitle?: string;
      companyName?: string;
      startTime?: string;
      endTime?: string;
      duration?: number;
      hash?: string;
      blockchainTxHash?: string;
    };

export function VerifyPage(): JSX.Element {
  const { sessionId } = useParams();
  const q = useQuery({
    queryKey: ['verify', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const res = await apiFetch<VerifyData>(`/api/sessions/${sessionId}/verify`, { skipAuth: true });
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  return (
    <div className="page authPage">
      <div className="card authCard">
        <div className="authBrand" style={{ justifyContent: 'center' }}>
          <span className="nav__dot" />
          <span className="nav__word" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800 }}>
            SkillStamp
          </span>
        </div>
        <div className="mono" style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 8 }}>
          {sessionId}
        </div>
        {q.isPending ? <div style={{ textAlign: 'center', marginTop: 16 }}>Verifying…</div> : null}
        {q.data && !q.data.valid ? (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 44 }}>✖</div>
            <h2>Session Not Found or Tampered</h2>
          </div>
        ) : null}
        {q.data && q.data.valid ? (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 44 }}>🛡</div>
            <h2 style={{ color: 'var(--success)' }}>Verified Authentic</h2>
            <div style={{ color: 'var(--text-secondary)', marginTop: 12, textAlign: 'left' }}>
              <div>
                <strong>Candidate:</strong> {q.data.candidateName}
              </div>
              <div>
                <strong>Employer:</strong> {q.data.employerName}
              </div>
              <div>
                <strong>Job:</strong> {q.data.jobTitle} · {q.data.companyName}
              </div>
              <div>
                <strong>When:</strong> {q.data.startTime ? new Date(q.data.startTime).toLocaleString() : '—'}
              </div>
              <div>
                <strong>Duration:</strong> {q.data.duration ? `${q.data.duration}s` : '—'}
              </div>
            </div>
            <div className="mono" style={{ fontSize: 11, wordBreak: 'break-all', marginTop: 12, textAlign: 'left' }}>
              {q.data.hash}
            </div>
            <button
              type="button"
              className="btn btn--primary"
              style={{ marginTop: 12, width: '100%' }}
              onClick={async () => {
                const tx = q.data.valid ? q.data.blockchainTxHash : '';
                window.open(`https://mumbai.polygonscan.com/tx/${tx}`, '_blank');
              }}
            >
              Verify on Polygon →
            </button>
            <Link to="/jobs" className="btn btn--ghost" style={{ marginTop: 12, width: '100%' }}>
              Browse jobs
            </Link>
          </div>
        ) : null}
      </div>
      <style>{`
        .authPage{ min-height: calc(100vh - 40px); display:flex; align-items:center; justify-content:center; }
        .authCard{ width: min(640px, 100%); display:flex; flex-direction:column; gap: 14px; }
        .authBrand{ display:flex; align-items:center; gap:10px; }
      `}</style>
    </div>
  );
}
