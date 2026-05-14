import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';

type Challenge = {
  title: string;
  description: string;
  expectedElements: string[];
  type?: string;
};

export function EmployerJobNewPage(): JSX.Element {
  const nav = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [locale, setLocale] = useState<'en' | 'am'>('en');
  const [jobId, setJobId] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  const generate = useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ job: { _id: string; challenges: Challenge[] } }>('/api/employer/jobs', {
        method: 'POST',
        body: JSON.stringify({ title, description, skills, locale }),
      });
      if (!res.success) throw new Error(res.error);
      return res.data.job;
    },
    onSuccess: (job) => {
      setJobId(String(job._id));
      setChallenges(job.challenges);
      setStep(2);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error('No job');
      const res = await apiFetch<{ job: { challenges: Challenge[] } }>('/api/employer/jobs', {
        method: 'POST',
        body: JSON.stringify({ jobId, regenerate: true }),
      });
      if (!res.success) throw new Error(res.error);
      return res.data.job.challenges;
    },
    onSuccess: (ch) => setChallenges(ch),
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error('No job');
      const res = await apiFetch<{ job: { _id: string } }>('/api/employer/jobs', {
        method: 'POST',
        body: JSON.stringify({ jobId, publish: true, challenges }),
      });
      if (!res.success) throw new Error(res.error);
      return String(res.data.job._id);
    },
    onSuccess: () => {
      if (jobId) nav(`/employer/jobs/${jobId}/applicants`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (step === 1) {
    return (
      <div className="page">
        <h1>Post a job</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Step 1 — Job details</p>
        <div className="card" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="authLabel">
            Job title
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="authLabel">
            Description (min 100)
            <textarea className="input" rows={8} value={description} onChange={(e) => setDescription(e.target.value)} />
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{description.length} chars</span>
          </label>
          <label className="authLabel">
            Skills (type + Enter)
            <input
              className="input"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const v = skillInput.trim();
                  if (!v) return;
                  setSkills((s) => [...s, v]);
                  setSkillInput('');
                }
              }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {skills.map((s) => (
                <button
                  type="button"
                  key={s}
                  className="pill pill--muted"
                  onClick={() => setSkills((x) => x.filter((y) => y !== s))}
                >
                  {s} ×
                </button>
              ))}
            </div>
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className={`btn ${locale === 'en' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setLocale('en')}>
              English
            </button>
            <button type="button" className={`btn ${locale === 'am' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setLocale('am')}>
              Amharic
            </button>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            disabled={generate.isPending || description.length < 100 || !title || skills.length === 0}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? 'AI is creating your interview challenges…' : 'Generate Challenges →'}
          </button>
          {generate.isPending ? (
            <div className="card" style={{ padding: 0, height: 8, overflow: 'hidden' }}>
              <div className="shimmer" style={{ height: '100%' }} />
            </div>
          ) : null}
        </div>
        <style>{`
          .authLabel{ display:flex; flex-direction:column; gap:8px; color: var(--text-secondary); font-size: 13px; font-weight: 600; }
          .shimmer{ background: linear-gradient(90deg, var(--bg-card) 25%, #1e1e2e 50%, var(--bg-card) 75%); background-size: 200% 100%; animation: sh 1.2s ease-in-out infinite; }
          @keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}
        `}</style>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Review challenges</h1>
      <p style={{ color: 'var(--text-secondary)' }}>Step 2 — Publish when ready</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {challenges.map((c, i) => (
          <div key={`${c.title}-${i}`} className="card">
            <div style={{ fontWeight: 900 }}>{c.title}</div>
            <p style={{ color: 'var(--text-secondary)' }}>{c.description}</p>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Expected duration: ~5 minutes</div>
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Rubric</summary>
              <ul>
                {c.expectedElements.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </details>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--ghost" disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>
          Regenerate
        </button>
        <button type="button" className="btn btn--primary" disabled={publish.isPending} onClick={() => publish.mutate()}>
          Publish Job
        </button>
      </div>
    </div>
  );
}
