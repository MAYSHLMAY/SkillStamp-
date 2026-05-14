import { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { SessionRoom } from '../components/SessionRoom';

type Sess = {
  id: string;
  candidateName: string;
  candidateScore: number;
  messages: { sender: string; text: string; timestamp: string; label: string }[];
  trustScore: number;
  pasteDetected: boolean;
  jobTitle: string;
  status: string;
};

const socketUrl = import.meta.env.VITE_SOCKET_URL ?? '';

export function EmployerSessionsPage(): JSX.Element {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['sessions', 'employer'],
    queryFn: async () => {
      const res = await apiFetch<{ sessions: Sess[] }>('/api/sessions/employer');
      if (!res.success) throw new Error(res.error);
      return res.data.sessions.filter((s) => s.status === 'active');
    },
  });

  const active = useMemo(() => (q.data ?? []).filter((s) => s), [q.data]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && active[0]) setSelected(active[0].id);
  }, [active, selected]);
  const [trust, setTrust] = useState<Record<string, number>>({});
  const [aiPing, setAiPing] = useState<Record<string, boolean>>({});
  const [paste, setPaste] = useState<Record<string, boolean>>({});
  const [sealModal, setSealModal] = useState<{ hash: string; txHash: string } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const s: Socket = io(socketUrl || undefined, { transports: ['websocket', 'polling'] });
    s.emit('user:connect', { userId: user.id, role: 'employer' });
    s.on('session:trust_update', (p: { sessionId: string; trustScore: number }) => {
      setTrust((m) => ({ ...m, [p.sessionId]: p.trustScore }));
    });
    s.on('session:ai_ping', (p: { sessionId: string }) => setAiPing((m) => ({ ...m, [p.sessionId]: true })));
    s.on('session:paste_detected', (p: { sessionId: string }) => setPaste((m) => ({ ...m, [p.sessionId]: true })));
    return () => {
      s.disconnect();
    };
  }, [user]);

  const sel = active.find((x) => x.id === selected) ?? null;

  return (
    <div className="cc">
      <aside className={`cc__left ${sheetOpen ? 'cc__left--open' : ''}`}>
        <div className="cc__leftHead">
          <div style={{ fontWeight: 900 }}>Threads</div>
          <button type="button" className="btn btn--ghost" style={{ display: 'none' }} onClick={() => setSheetOpen(false)}>
            Close
          </button>
        </div>
        <div className="cc__tiles">
          {active.map((s) => {
            const t = trust[s.id] ?? s.trustScore;
            const color = t > 70 ? 'var(--success)' : t >= 40 ? 'var(--warning)' : 'var(--danger)';
            const live = selected === s.id;
            const last = s.messages[s.messages.length - 1];
            return (
              <button
                type="button"
                key={s.id}
                className={`cc__tile ${aiPing[s.id] ? 'cc__tile--ping' : ''}`}
                onClick={() => {
                  setSelected(s.id);
                  setSheetOpen(false);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 900 }}>{s.candidateName}</div>
                  <span className={`pill ${live ? 'pill--success' : 'pill--accent'}`}>{live ? "You're Live" : 'AI Active'}</span>
                </div>
                <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ width: `${t}%`, height: '100%', borderRadius: 999, background: color }} />
                </div>
                <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 12, textAlign: 'left' }}>
                  {last?.text.slice(0, 80) ?? '—'}
                </div>
                {paste[s.id] || s.pasteDetected ? (
                  <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>⚠ Paste detected</div>
                ) : null}
                {aiPing[s.id] ? (
                  <div style={{ color: 'var(--accent)', fontSize: 12, marginTop: 6 }}>🔔 Jump in — strong answer</div>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      <button type="button" className="cc__fab btn btn--primary" onClick={() => setSheetOpen(true)}>
        Threads
      </button>

      <main className="cc__main">
        {sel ? (
          <SessionRoom
            sessionId={sel.id}
            role="employer"
            initialMessages={sel.messages}
            candidateName={sel.candidateName}
            candidateScore={sel.candidateScore}
            onSealed={(p) => setSealModal(p)}
          />
        ) : (
          <div className="page">Select a candidate thread</div>
        )}
      </main>

      {sealModal ? (
        <div className="cc__modal">
          <div className="card" style={{ maxWidth: 560, width: 'min(560px, 92vw)' }}>
            <div style={{ fontSize: 44, textAlign: 'center' }}>✅</div>
            <h2 style={{ textAlign: 'center' }}>Session Sealed</h2>
            <div className="mono" style={{ wordBreak: 'break-all', fontSize: 12, marginTop: 12 }}>
              {sealModal.hash}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${window.location.origin}/verify/${selected}`);
                  toast.success('Copied');
                }}
              >
                Copy Verification Link
              </button>
              <a
                className="btn btn--ghost"
                href={`https://mumbai.polygonscan.com/tx/${sealModal.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View on Polygonscan
              </a>
              <button type="button" className="btn btn--ghost" onClick={() => setSealModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .cc{ display:flex; min-height: calc(100vh - 64px); }
        .cc__left{ width: 320px; border-right: 1px solid var(--border); background: rgba(19,19,26,0.65); display:flex; flex-direction:column; }
        .cc__leftHead{ padding: 12px 12px 0; display:flex; justify-content:space-between; align-items:center; }
        .cc__tiles{ padding: 12px; overflow:auto; display:flex; flex-direction:column; gap:10px; flex:1; }
        .cc__tile{
          text-align:left;
          border: 1px solid var(--border);
          background: var(--bg-card);
          border-radius: var(--radius-md);
          padding: 12px;
          cursor:pointer;
          transition: all 0.15s ease;
        }
        .cc__tile:hover{ border-color: var(--border-hover); background: var(--bg-card-hover); }
        .cc__tile--ping{ box-shadow: 0 0 0 2px rgba(108,99,255,0.35); border-color: var(--accent); }
        .cc__main{ flex:1; min-width: 0; }
        .cc__fab{ position: fixed; left: 12px; bottom: 12px; z-index: 50; display: none; }
        @media (max-width: 900px){
          .cc__left{ position: fixed; left: 0; bottom: 0; height: 52vh; width: 100%; z-index: 60; transform: translateY(102%); transition: transform 0.25s ease; border-right: none; border-top: 1px solid var(--border); }
          .cc__left--open{ transform: translateY(0); }
          .cc__fab{ display: inline-flex; }
        }
        .cc__modal{ position: fixed; inset:0; background: rgba(0,0,0,0.65); display:flex; align-items:center; justify-content:center; z-index: 120; padding: 16px; }
      `}</style>
    </div>
  );
}
