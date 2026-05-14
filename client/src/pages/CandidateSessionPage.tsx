import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { SessionRoom } from '../components/SessionRoom';

type Sess = {
  id: string;
  jobTitle: string;
  messages: { sender: string; text: string; timestamp: string; label: string }[];
};

export function CandidateSessionPage(): JSX.Element {
  const { sessionId } = useParams();
  const q = useQuery({
    queryKey: ['sessions', 'candidate', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const res = await apiFetch<{ sessions: Sess[] }>('/api/sessions/candidate');
      if (!res.success) throw new Error(res.error);
      return res.data.sessions.find((s) => s.id === sessionId) ?? null;
    },
  });

  if (q.isPending) return <div className="page">Loading…</div>;
  if (!q.data) return <div className="page">Session not found</div>;

  return (
    <SessionRoom
      sessionId={q.data.id}
      role="candidate"
      initialMessages={q.data.messages}
      candidateName="You"
      candidateScore={0}
    />
  );
}
