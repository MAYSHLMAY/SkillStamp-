import Groq from 'groq-sdk';
import type { JobChallenge } from '../models/Job';

const MODEL = 'llama-3.3-70b-versatile';

export const FALLBACK_CHALLENGES: JobChallenge[] = [
  {
    title: 'Addis Ababa Customer Escalation',
    description:
      'A customer in Bole reports double billing on mobile airtime. They are upset and posting publicly. Walk through how you would de-escalate, verify the issue, and propose a fix within company policy.',
    expectedElements: [
      'Acknowledge emotion and set expectations',
      'Concrete verification steps',
      'Ethiopian consumer context (airtime, agents, Amharic-first support)',
    ],
    type: 'text',
  },
  {
    title: 'Cross-team Deadline Conflict',
    description:
      'Finance needs a report by Friday, but Operations is blocked on data from your team until Monday. Explain how you would negotiate scope, communicate stakeholders, and protect quality.',
    expectedElements: ['Stakeholder map', 'Tradeoffs', 'Written follow-up plan'],
    type: 'text',
  },
  {
    title: 'Quality vs Speed Tradeoff',
    description:
      'Leadership wants a same-day rollout for a minor feature used by merchants in Merkato. You spot a regression risk. How do you decide and communicate?',
    expectedElements: ['Risk assessment', 'Mitigation', 'Clear recommendation'],
    type: 'text',
  },
];

function getClient(): Groq | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new Groq({ apiKey: key });
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export async function generateChallenges(params: {
  title: string;
  description: string;
  skills: string[];
  locale: 'en' | 'am';
}): Promise<JobChallenge[]> {
  const { title, description, skills, locale } = params;
  const client = getClient();
  const prompt = `You are designing realistic job interview challenges for a ${locale === 'am' ? 'Amharic' : 'English'} speaking candidate.
Job title: ${title}
Job description: ${description}
Required skills: ${skills.join(', ')}

Generate exactly 3 job simulation challenges that test real skills for this role.
Each challenge must:
- Be a realistic scenario the candidate would actually face on this job
- Be completable via text response in 5 minutes
- Be grounded in Ethiopian business context (mention real local scenarios where relevant)
- Include a clear rubric for scoring (what a good answer looks like)

Return ONLY valid JSON in this exact format:
{
  "challenges": [
    {
      "title": "Challenge title",
      "description": "The scenario text shown to the candidate",
      "expectedElements": ["what to look for 1", "what to look for 2", "what to look for 3"],
      "type": "text"
    }
  ]
}`;

  if (!client) return FALLBACK_CHALLENGES;

  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });
    const text = res.choices[0]?.message?.content ?? '';
    const parsed = safeJsonParse<{ challenges: JobChallenge[] }>(text);
    if (parsed?.challenges?.length) {
      return parsed.challenges.slice(0, 3).map((c) => ({
        title: c.title,
        description: c.description,
        expectedElements: c.expectedElements ?? [],
        type: 'text' as const,
      }));
    }
  } catch {
    /* fallback */
  }
  return FALLBACK_CHALLENGES;
}

export interface ScoreResult {
  accuracy: number;
  speed_proxy: number;
  complexity: number;
  overall: number;
  feedback: string;
}

export async function scoreAnswer(params: {
  jobTitle: string;
  challenge: JobChallenge;
  candidateAnswer: string;
}): Promise<ScoreResult> {
  const { jobTitle, challenge, candidateAnswer } = params;
  const client = getClient();
  const prompt = `You are scoring a job candidate's response.
Job: ${jobTitle}
Challenge: ${challenge.description}
What a good answer looks like: ${challenge.expectedElements.join(', ')}
Candidate's answer: ${candidateAnswer}

Score this answer on three dimensions (0-100 each):
- accuracy: Did they address the core problem? Did they hit the expected elements?
- speed_proxy: Is the answer direct and efficient, or rambling and unclear?
- complexity: Did they show nuanced thinking or handle complexity well?

Return ONLY valid JSON:
{
  "accuracy": 85,
  "speed_proxy": 72,
  "complexity": 78,
  "overall": 78,
  "feedback": "One sentence of specific feedback"
}`;

  const fallback = (): ScoreResult => ({
    accuracy: 70,
    speed_proxy: 70,
    complexity: 70,
    overall: 70,
    feedback: 'Solid baseline response; add more concrete steps and local context.',
  });

  if (!client) return fallback();

  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    const text = res.choices[0]?.message?.content ?? '';
    const parsed = safeJsonParse<ScoreResult>(text);
    if (
      parsed &&
      typeof parsed.accuracy === 'number' &&
      typeof parsed.speed_proxy === 'number' &&
      typeof parsed.complexity === 'number' &&
      typeof parsed.overall === 'number'
    ) {
      return {
        accuracy: Math.max(0, Math.min(100, parsed.accuracy)),
        speed_proxy: Math.max(0, Math.min(100, parsed.speed_proxy)),
        complexity: Math.max(0, Math.min(100, parsed.complexity)),
        overall: Math.max(0, Math.min(100, parsed.overall)),
        feedback: parsed.feedback || 'Good effort.',
      };
    }
  } catch {
    /* fallback */
  }
  return fallback();
}

export async function nextInterviewerQuestion(params: {
  jobTitle: string;
  candidateScore: number;
  challenges: { title: string }[];
  messages: { label: string; text: string }[];
  locale: 'en' | 'am';
}): Promise<string> {
  const { jobTitle, candidateScore, challenges, messages, locale } = params;
  const client = getClient();
  const prompt = `You are conducting a live job interview via text chat. You are the interviewer.
Job: ${jobTitle}
Candidate score from pre-screen: ${candidateScore}/100
Previous challenges they completed: ${challenges.map((c) => c.title).join(', ')}
Conversation so far: ${messages.map((m) => `${m.label}: ${m.text}`).join('\n')}

Ask ONE follow-up question based on the conversation. 
- Keep it natural, professional, and conversational
- Do not ask questions already covered
- If they just gave an exceptional answer, acknowledge it briefly then probe deeper
- If they gave a weak answer, probe gently for more detail
- Never reveal you are an AI
- Respond in ${locale === 'am' ? 'Amharic' : 'English'}
- Maximum 2 sentences

Respond with ONLY the question text, nothing else.`;

  if (!client) {
    return locale === 'am'
      ? 'እባክዎ በዚህ ሚና ላይ ከፈተኛው ችግር ምን ይመስልዎታል እና እንዴት ይፈታሉ?'
      : 'What is the hardest situation you would expect in this role in Addis, and how would you handle it end-to-end?';
  }

  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
    });
    const text = (res.choices[0]?.message?.content ?? '').trim();
    if (text) return text;
  } catch {
    /* fallback */
  }
  return locale === 'am'
    ? 'እባክዎ ከደንበኛ ጋር ያለዎትን የመጨረሻውን የስራ ሂደት ያብራሩ።'
    : 'Walk me through your last difficult stakeholder conversation and what you learned.';
}

export function lexicalUniqueRatio(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\u1200-\u137F\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 0;
  const unique = new Set(words);
  return unique.size / words.length;
}

export function trustFromSignals(pasteCount: number, anomalyCount: number): number {
  const raw = 100 - pasteCount * 15 - anomalyCount * 10;
  return Math.max(0, Math.min(100, raw));
}

export function trustColor(score: number): 'green' | 'yellow' | 'red' {
  if (score > 70) return 'green';
  if (score >= 40) return 'yellow';
  return 'red';
}
