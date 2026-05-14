# SkillStamp — Full Feature Documentation

## What Is SkillStamp

SkillStamp is an AI-powered hiring platform built for Ethiopian professionals.
It replaces CVs and resumes with live, verifiable skill performance. Candidates
prove what they can do through AI-generated job simulations. Employers see a
ranked leaderboard of verified performers. The top candidates enter a live
interview session that is cryptographically sealed at the end — tamper-proof
forever. No resume. No upload. Just proof.

---

## Core Philosophy

- A CV tells you what someone claims. SkillStamp shows you what they can do.
- Trust is built through consistent verified performance, not a one-time test.
- Every hiring interaction is timestamped, scored, and sealed.
- Built for Ethiopian reality — Amharic language support, local business context
  in every AI-generated challenge.

---

## Authentication & User Management

- JWT-based authentication with 24-hour token expiry
- Three roles: candidate, employer, admin
- bcrypt password hashing
- Role-based route protection on all backend routes
- Auth persists across page refresh — no blank pages, no flashing login screen
- On refresh, app shows a skeleton loader while verifying the token, then renders
  the correct page
- Role-based redirect on login: candidates go to candidate dashboard, employers
  go to employer dashboard
- Logout clears token and returns to job board

---

## Public Job Board — /jobs

- Visible to everyone, no login required
- Hero section with the core message: "Get hired by what you can do — not what
  is on your CV"
- Live counter showing how many professionals are online right now, updated via
  Socket.io in real time
- Responsive job card grid: 3 columns on desktop, 2 on tablet, 1 on mobile
- Each job card shows: company name, job title, short description, required
  skills as pills, and a live count of how many candidates are currently applying
- "Apply — No CV" button on every card — the CV-free message is impossible to miss
- Skeleton loading states while jobs are being fetched — no blank screens
- Cards lift slightly on hover with a border highlight transition
- If a candidate is not logged in and clicks Apply, they are redirected to
  register with the job ID saved so they return to the same job after registering

---

## Candidate Features

### Registration & Profile
- Register as a candidate with name, email, and password
- Role is set at registration — no confusion about account type
- Profile shows overall verified score as an animated circular progress ring
- Score breakdown into three sub-scores: accuracy, speed, complexity
- Consistency status pill: Verified or Under Review

### Applying to Jobs — The Pre-Screen
- Candidate clicks Apply on any job
- Sees a job overview page with title, company, required skills, and a clear
  banner: "No CV needed — complete the challenges to apply"
- Shows challenge count and estimated time before starting
- Challenges are revealed one at a time after clicking Start Assessment
- Each challenge is an AI-generated real work simulation specific to that job
  and grounded in Ethiopian business context
- Examples: an angry customer complaint in Addis Ababa, a messy Amharic document
  to translate, a billing dispute to resolve
- Each challenge has a 5-minute countdown timer that turns red at 60 seconds and
  auto-submits at zero
- Large textarea for the candidate's response, auto-expanding
- Submit button is disabled until at least 10 characters are entered
- Submit button locks immediately on first click with a loading spinner and
  "Scoring your answer..." text — no double submissions possible
- Answer is sent to the backend where Groq scores it against a rubric generated
  when the job was posted
- Score appears after each challenge before the next one loads
- Paste detection: if the candidate pastes text, a flag is silently set on the
  submission — the candidate sees no warning
- Final screen shows animated checkmark, overall score, per-challenge breakdown,
  and confirmation that the application was submitted
- Candidate is ranked on the employer's leaderboard immediately

### Candidate Dashboard — /candidate/dashboard
- Overall verified score displayed as animated circular progress ring
- Three sub-score bars: accuracy, speed, complexity
- List of all applications with job title, company, status pill, and score
- Status pills: Pending Review, Invited to Session, Rejected, Completed
- If invited to a live session, a pulsing green "Join Session" button appears
- Completed sessions show a verification link with a copy button
- SHA-256 hash preview for each sealed session

### Live Session Room — /session/:id/candidate
- Candidate joins after being invited by the employer
- Header shows job title, countdown timer, and trust meter bar
- Chat interface where messages appear from "Interviewer" — the candidate never
  knows if they are talking to the AI or the employer directly
- Typing indicator: "Interviewer is typing..." with animated dots
- Text input with send button, Enter to send, Shift+Enter for new line
- Paste detection runs silently throughout the session
- On session end: score summary and verification link appear automatically

---

## Employer Features

### Employer Dashboard — /employer/dashboard
- Stat cards: active jobs posted, total applicants this week, sessions completed,
  average applicant score
- List of posted jobs with applicant count, score distribution bar, and top
  scorer preview
- Quick links to view leaderboard or start a session for each job

### Posting a Job — /employer/jobs/new
- Two-step form
- Step 1: job title, description (minimum 100 characters with live count),
  required skills as a tag input (type and press Enter to add, click to remove),
  locale toggle between English and Amharic
- Click "Generate Challenges" — backend sends the job details to Groq which
  generates 2 to 3 role-specific interview challenges and a scoring rubric for
  each
- Loading state: "AI is creating your interview challenges..." with animated
  progress bar, takes 3 to 8 seconds
- Step 2: employer reviews the generated challenges before publishing
- Each challenge shows title, scenario text, expected duration, and an
  expandable rubric section
- Regenerate button to request new challenges from Groq
- Publish sends the job live immediately and it appears on the public job board
- Employer is redirected to the applicant leaderboard for that job

### Applicant Leaderboard — /employer/jobs/:id/applicants
- Ranked list of all candidates who completed the challenges for this job
- Page header: "Ranked by verified performance — no CVs"
- Each row shows: rank number, candidate name with avatar initials circle, score
  bar filled to their percentage, sub-score pills for accuracy and speed and
  complexity, status pill
- No resume column. No upload column. Score only.
- Click any candidate row to expand and see their individual answers to each
  challenge
- Invite to Session button turns green on hover — creates a session and notifies
  the candidate
- Reject button turns red on hover — updates status immediately via optimistic UI
- Status updates reflect in real time without page refresh

### Command Center — /employer/sessions (THE CORE FEATURE)
- Split-panel layout: candidate thread list on the left, active chat on the right
- Left panel shows all active candidate sessions as tiles
- Each tile shows: candidate name, avatar initials, trust meter bar colored green
  above 70 / yellow 40 to 70 / red below 40, status badge, last message preview,
  unread message count
- Status badge: "AI Active" (purple) when AI is interviewing that candidate,
  "You're Live" (green pulsing) when employer is active in that thread
- When employer is not in a thread, the AI proxy automatically continues the
  interview using Groq — asking contextual follow-up questions based on the job
  challenges and the conversation so far
- The candidate always sees messages from "Interviewer" — they cannot tell if it
  is the AI or the employer
- When the AI detects an exceptionally strong or weak answer, it highlights the
  candidate tile with a glowing border and shows a ping alert: "Strong answer —
  jump in now"
- Clicking a tile switches the employer into that thread — the AI pauses and
  hands over seamlessly
- The previous thread switches back to AI Active automatically
- Right panel shows the full chat history for the selected candidate
- Session countdown timer in the top right corner, turns red at 2 minutes
- Typing indicator fires to the candidate's room when employer is typing
- Paste detection warning badge appears on the tile if the candidate pastes
- "End & Seal" button in the top right corner

---

## AI Integration — Groq with Llama 3.3 70B

- Challenge generation: reads job title, description, required skills, and
  locale, produces 2 to 3 realistic work simulations grounded in Ethiopian
  business context with a scoring rubric for each
- Answer scoring: evaluates each candidate response against the rubric on three
  dimensions — accuracy (did they address the core problem), speed proxy (was the
  answer direct and efficient), complexity (did they show nuanced thinking) —
  returns scores 0 to 100 on each dimension plus one sentence of specific feedback
- AI proxy interviewer: conducts live text interviews when employer is in another
  thread, asks one contextual question at a time, never reveals it is an AI,
  responds in the candidate's locale
- Fallback challenges are stored in the codebase — if Groq API fails or is slow,
  the system uses pre-written challenges so the app never crashes
- All Groq calls are wrapped in try/catch for robustness

---

## Real-Time Features — Socket.io

- Online users counter: total connected users broadcast to all clients, visible
  in navbar and hero section, updates live
- Per-job applying count: each job card shows how many candidates are currently
  applying, updates in real time
- Live session messaging: instant bidirectional chat between employer and
  candidate with no page refresh
- Typing indicators: "Interviewer is typing..." fires to candidate when employer
  types, "Candidate is typing..." fires to employer
- Trust meter updates: score recalculated after each candidate message and pushed
  to employer's command center live
- AI ping alerts: when AI detects a high-value response, a socket event
  highlights the candidate tile for the employer
- Paste detection events: silent flag sent to employer's command center when
  candidate pastes text
- Session sealed event: when employer ends a session, sealed confirmation with
  hash is pushed to both parties simultaneously

---

## Anti-Cheat & Trust Engine

- Paste detection: monitors for paste events throughout the apply flow and live
  session, silently flags without alerting the candidate
- Lexical complexity tracking: measures unique word ratio (Amharic) and
  type-token ratio (English) per message
- Z-score analysis: detects anomalous spikes in complexity or response speed
  that deviate more than 2 standard deviations from the candidate's baseline
- Trust score formula: starts at 100, minus 15 per paste detected, minus 10 per
  anomaly detected, clamped to 0 to 100
- Trust meter displayed live in the command center with color coding
- Contamination flag: if paste is detected, session is marked as contaminated in
  the database

---

## Session Sealing & Verification

- When employer clicks "End & Seal", the backend collects every message with its
  timestamp, the trust score, and the session metadata
- SHA-256 hash is generated from the complete transcript — any alteration to any
  message would produce a completely different hash
- Hash and session data are stored in MongoDB
- A modal appears showing: large green checkmark, "Session Sealed", the full
  64-character SHA-256 hash in monospace font, and a copy verification link button
- Optional Polygonscan link for blockchain verification

### Public Verification Page — /verify/:sessionId
- No login required — anyone with the link can verify
- Shows: candidate name, employer and job title, date, duration, full SHA-256
  hash with copy button
- Green shield: "Verified Authentic" if the session exists and hash matches
- Red X: "Session Not Found or Tampered" if invalid
- This link is what both employer and candidate keep as permanent proof of the
  hiring interaction

---

## Frontend & UX

- Dark theme throughout: near-black base (#0A0A0F), dark cards (#13131A)
- Accent color: purple (#6C63FF) for all primary actions
- Success color: teal (#1D9E75) for scores, verified states, positive indicators
- Typography: Space Grotesk for headings, Inter for body text, JetBrains Mono
  for hashes and code
- Skeleton loading states on every async fetch — no blank screens anywhere
- Toast notifications via Sonner for all errors and confirmations
- Smooth transitions on all interactive elements (0.15s ease)
- Cards lift on hover with border highlight
- Responsive layout: works on desktop, tablet, and mobile
- Sticky navbar with backdrop blur so content scrolls behind it
- PWA installable: manifest.json with icons, service worker, add to home screen
  on mobile

---

## Backend & Performance

- Express with TypeScript
- All MongoDB read queries use .lean() and .select() for performance
- All insert operations use findOneAndUpdate with upsert to prevent duplicate
  key errors
- React Query on the frontend with staleTime configured per query type — auth
  cached forever, jobs cached 5 minutes — no redundant API calls
- /api/auth/me called exactly once per session regardless of navigation
- All API responses follow consistent shape: success true with data, or success
  false with error message
- TypeScript strict mode passes on both client and server
- Production build succeeds with npm run build

---

## Database Models

- User: id, name, email, password hash, role, locale preference
- Job: id, employer, title, description, required skills, challenges with rubrics,
  published status, locale
- Application: id, job, candidate, answers with individual scores, overall score,
  status, paste detected flag, submitted timestamp
- Session: id, job, employer, candidate, full message history with sender and
  timestamp and label, trust score, paste detected, anomaly count, SHA-256 hash,
  blockchain TX hash, status, start time, end time, duration
- Verification: session reference, hash, timestamp, public verification payload

---

## Seed Data

Running npm run seed from the server folder creates:

Employers:
- hr@techcorp.et / password123 — TechCorp Ethiopia
- hr@addishr.et / password123 — AddisHR Solutions

Candidates:
- dawit@example.et / password123 — Dawit Bekele, verified score 87
- sara@example.et / password123 — Sara Hailu, verified score 72
- mikias@example.et / password123 — Mikias Alemu, verified score 61

Jobs:
- Customer Support Representative at TechCorp Ethiopia with pre-generated
  challenges and applications from all three candidates with realistic scores
- Amharic-English Translator at AddisHR Solutions with pre-generated challenges
  and applications from all three candidates with realistic scores

One pre-sealed session between TechCorp Ethiopia and Dawit Bekele with a real
SHA-256 hash stored and a verification link ready to demo

---

## What Is Not Built (Roadmap)

- Audio and video sessions (WebRTC) — described in pitch deck
- Live Polygon blockchain submission — hash is stored, pre-seeded TX link shown
- Full 30-day behavioral history graphs — seed data populates demo profiles
- Mobile swipe gesture (TikTok-style) — responsive grid used instead
- Admin panel, email notifications, payment system

---

## How To Run

Install dependencies from root folder:
   npm install

Create environment file:
   cd server
   cp .env.example .env
   Fill in MONGODB_URI, JWT_SECRET, GROQ_API_KEY

Seed demo data:
   cd server
   npm run seed

Start the app from root folder:
   npm run dev

Server: http://localhost:5000
Client: http://localhost:5173
