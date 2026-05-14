import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';

type Msg = { sender: string; text: string; timestamp: string; label: string };

const socketUrl = import.meta.env.VITE_SOCKET_URL ?? '';

export function SessionRoom({
  sessionId,
  role,
  initialMessages,
  candidateName,
  candidateScore,
  onSealed,
}: {
  sessionId: string;
  role: 'candidate' | 'employer';
  initialMessages: Msg[];
  candidateName: string;
  candidateScore: number;
  onSealed?: (p: { hash: string; txHash: string }) => void;
}): JSX.Element {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const endTime = useMemo(() => Date.now() + 45 * 60 * 1000, [sessionId]);
  const [remain, setRemain] = useState(() => Math.floor((endTime - Date.now()) / 1000));

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    const t = window.setInterval(() => setRemain(Math.max(0, Math.floor((endTime - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(t);
  }, [endTime]);

  useEffect(() => {
    if (!user) return;
    const s = io(socketUrl || undefined, { transports: ['websocket', 'polling'] });
    socketRef.current = s;
    s.emit('user:connect', { userId: user.id, role: user.role });
    s.emit('session:join', { sessionId, role });
    s.on('session:message', (m: { sender: string; text: string; timestamp: string; label: string }) => {
      setMessages((prev) => [...prev, m]);
    });
    s.on('session:typing', (p: { label: string }) => setTyping(p.label));
    s.on('session:stop_typing', () => setTyping(null));
    s.on('session:sealed', () => {
      toast.success('Session sealed');
    });
    return () => {
      s.disconnect();
    };
  }, [sessionId, role, user]);

  const mm = String(Math.floor(remain / 60)).padStart(2, '0');
  const ss = String(remain % 60).padStart(2, '0');
  const red = remain <= 120;

  async function send(): Promise<void> {
    const s = socketRef.current;
    if (!s || !text.trim()) return;
    s.emit('session:message', { sessionId, text: text.trim(), pasteDetected: false });
    setText('');
    s.emit('session:stop_typing', { sessionId });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <div className="card" style={{ margin: '12px 16px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 900 }}>{candidateName}</div>
          <span className="pill pill--accent">{candidateScore}/100</span>
        </div>
        <div className="mono" style={{ fontSize: 22, fontWeight: 900, color: red ? 'var(--danger)' : 'var(--text-primary)' }}>
          {mm}:{ss}
        </div>
        {role === 'employer' ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              const res = await apiFetch<{ hash: string; txHash: string }>(`/api/sessions/${sessionId}/end`, {
                method: 'POST',
              });
              if (!res.success) {
                toast.error(res.error);
                return;
              }
              onSealed?.({ hash: res.data.hash, txHash: res.data.txHash });
            }}
          >
            End & Seal
          </button>
        ) : null}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, idx) => {
          const left = m.sender !== 'candidate';
          return (
            <div key={`${m.timestamp}-${idx}`} style={{ display: 'flex', justifyContent: left ? 'flex-start' : 'flex-end' }}>
              <div
                className="card"
                style={{
                  maxWidth: 560,
                  background: left ? 'rgba(255,255,255,0.04)' : 'rgba(108,99,255,0.10)',
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>{m.label}</div>
                <div>{m.text}</div>
              </div>
            </div>
          );
        })}
        {typing ? <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{typing}</div> : null}
      </div>

      <div className="card" style={{ margin: 12, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <textarea
          className="input"
          rows={3}
          style={{ flex: 1, resize: 'none' }}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            socketRef.current?.emit('session:typing', { sessionId });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          onBlur={() => socketRef.current?.emit('session:stop_typing', { sessionId })}
        />
        <button type="button" className="btn btn--primary" onClick={() => void send()}>
          Send
        </button>
      </div>
    </div>
  );
}
