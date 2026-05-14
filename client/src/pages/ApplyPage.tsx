import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';

type Challenge = { title: string; description: string; expectedElements: string[] };
type JobDetail = { id: string; title: string; companyName: string; skills: string[]; challenges: Challenge[] };

export function ApplyPage(): JSX.Element {
  const { id } = useParams();
  const qc = useQueryClient();
  const jobQ = useQuery({
    queryKey: ['jobs', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<JobDetail>(`/api/jobs/${id}`);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  const [started, setStarted] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastScore, setLastScore] = useState<{ overall: number; feedback: string } | null>(null);
  const [done, setDone] = useState(false);
  const [seconds, setSeconds] = useState(300);
  const pasteRef = useRef(false);
  const submitLockedRef = useRef(false);

  const challenges = jobQ.data?.challenges ?? [];
  const total = Math.max(challenges.length, 1);
  const challenge = challenges[step];

  const startApply = useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ application: { id: string } }>(`/api/applications/${id}`, { method: 'POST' });
      if (!res.success) throw new Error(res.error);
      return res.data.application.id;
    },
    onSuccess: (appId) => {
      setApplicationId(appId);
      setStarted(true);
      setStep(0);
      setSeconds(300);
      void qc.invalidateQueries({ queryKey: ['applications', 'candidate'] });
    },
  });

  const submit = useCallback(
    async (opts?: { fromTimer?: boolean }) => {
      if (!applicationId || submitLockedRef.current) return;
      if (!opts?.fromTimer && text.trim().length < 20) return;
      const bodyText = opts?.fromTimer && text.trim().length < 20 ? `${text}\n(Timed submission)` : text;

      submitLockedRef.current = true;
      flushSync(() => setBusy(true));
      const startedAt = Date.now();
      try {
        const res = await apiFetch<{ score: { overall: number; feedback: string }; allDone: boolean }>(
          `/api/applications/${applicationId}/answer`,
          {
            method: 'POST',
            body: JSON.stringify({
              challengeIndex: step,
              text: bodyText,
              pasteDetected: pasteRef.current,
            }),
          }
        );
        pasteRef.current = false;
        if (!res.success) throw new Error(res.error);
        setLastScore({ overall: res.data.score.overall, feedback: res.data.score.feedback });
        setText('');
        if (res.data.allDone || step >= total - 1) {
          setDone(true);
          return;
        }
        setStep((x) => x + 1);
        setSeconds(300);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Submit failed');
      } finally {
        const elapsed = Date.now() - startedAt;
        const remaining = 300 - elapsed;
        if (remaining > 0) {
          await new Promise<void>((r) => {
            window.setTimeout(r, remaining);
          });
        }
        submitLockedRef.current = false;
        setBusy(false);
      }
    },
    [applicationId, step, text, total]
  );

  const prevSec = useRef(seconds);
  useEffect(() => {
    if (!started || done) return;
    const t = window.setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [started, done, step]);

  useEffect(() => {
    if (!started || done) return;
    if (prevSec.current !== 0 && seconds === 0) void submit({ fromTimer: true });
    prevSec.current = seconds;
  }, [seconds, started, done, submit]);

  const banner = useMemo(
    () => (
      <div className="card" style={{ borderColor: 'var(--accent)', background: 'rgba(108,99,255,0.08)' }}>
        <div className="tagline">Proof-first application</div>
        <div style={{ fontWeight: 900, marginTop: 6 }}>No CV needed. Complete the challenges below to apply.</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>No CV. No resume. No uploads. Just proof.</div>
      </div>
    ),
    []
  );

  if (jobQ.isPending) return <div className="page">Loading job…</div>;
  if (jobQ.isError || !jobQ.data) return <div className="page">Job not found.</div>;

  if (!started) {
    return (
      <div className="page">
        <Link to="/jobs" className="btn btn--ghost" style={{ marginBottom: 12 }}>
          ← Back to jobs
        </Link>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{jobQ.data.title}</h1>
        <div style={{ color: 'var(--text-secondary)' }}>{jobQ.data.companyName}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {jobQ.data.skills.map((s) => (
            <span key={s} className="pill pill--muted">
              {s}
            </span>
          ))}
        </div>
        {banner}
        <div style={{ marginTop: 16 }} className="card">
          <div style={{ fontWeight: 800 }}>{total} challenges · ~15 minutes</div>
          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 12 }}
            disabled={startApply.isPending}
            onClick={() => startApply.mutate()}
          >
            Start Assessment
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '44px' }}>✅</div>
          <h2>Assessment Complete</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Your application has been submitted. You&apos;ll be notified if you&apos;re invited to a live session.
          </p>
          <div style={{ marginTop: 16, fontWeight: 900, fontSize: 42, fontFamily: "'Space Grotesk', sans-serif" }}>
            {lastScore?.overall ?? '—'}
          </div>
          <Link className="btn btn--primary" style={{ marginTop: 16 }} to="/jobs">
            Browse more jobs
          </Link>
        </div>
      </div>
    );
  }

  const red = seconds <= 60;

  return (
    <div className="page">
      <div style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
        Challenge {step + 1} of {total}
      </div>
      <div className="card" style={{ padding: 10 }}>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${((step + 1) / total) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent), #9b93ff)',
              transition: 'width 400ms ease',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{challenge?.title}</h2>
        <div
          className="mono"
          style={{ fontSize: 28, fontWeight: 900, color: red ? 'var(--danger)' : 'var(--text-primary)' }}
        >
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
        </div>
      </div>

      <blockquote className="card" style={{ marginTop: 12, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
        {challenge?.description}
      </blockquote>

      <textarea
        className="input"
        rows={6}
        style={{ marginTop: 12, minHeight: 120, resize: 'vertical' }}
        value={text}
        disabled={busy}
        onChange={(e) => setText(e.target.value)}
        onPaste={() => {
          pasteRef.current = true;
        }}
      />

      <button
        type="button"
        className="btn btn--primary applySubmitBtn"
        style={{ marginTop: 12, width: '100%' }}
        disabled={busy || text.trim().length < 20}
        aria-busy={busy}
        onClick={() => void submit()}
      >
        {busy ? (
          <>
            <span className="applySubmitSpinner" aria-hidden />
            <span>Scoring your answer…</span>
          </>
        ) : (
          'Submit Answer'
        )}
      </button>

      <style>{`
        .applySubmitBtn:disabled {
          opacity: 0.85;
          cursor: not-allowed;
        }
        .applySubmitSpinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: applySubmitSpin 0.65s linear infinite;
          flex-shrink: 0;
        }
        @keyframes applySubmitSpin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {lastScore ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900 }}>Score: {lastScore.overall}</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: 6 }}>{lastScore.feedback}</div>
        </div>
      ) : null}
    </div>
  );
}
