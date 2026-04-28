# Flowo

Flowo is a personal productivity system for turning long-term goals into scheduled work, tracked XP, reflections, and progress insights.

It combines a task canvas, goal/pursuit system, timeline scheduler, journal, training log, insights dashboard, and archive into one workflow.

## What Flowo Solves

Most productivity tools stop at tasks. Flowo connects the full loop:

1. Define what you are pursuing.
2. Break that pursuit into real daily tasks.
3. Schedule the work onto a timeline.
4. Complete the work and earn XP.
5. Review progress through heatmaps, logs, and insights.
6. Keep a record of completed work in the vault.

Example:

- Pursuit: `Reach 180 lbs and become strong`
- Weekly focus: `Hit protein daily and train 4 times`
- Canvas tasks: `Chest workout`, `Meal prep`, `Walk 30 minutes`
- Timeline: scheduled blocks for when the work should happen
- Journal: training logs and personal reflections
- Insights: training count, sets, current pounds, top tags, focus patterns

## Main Features

### Canvas

Canvas is the daily task board. You can create tasks with:

- Due date and duration
- Optional timeline placement
- Priority and skill level
- Pursuit link
- Contribution type: build, practice, health, pipeline, review
- Effort size and XP value
- Optional AI task breakdown

Completing a task can award XP to the linked pursuit and shows a small completion summary.

### Pursuits

Pursuits are long-term goals such as:

- Build an AI voice agent startup
- Reach 180 lbs
- Improve LeetCode skill
- Apply to jobs consistently

Each pursuit supports:

- Why, target, category, deadline
- Weekly focus
- Weekly XP target
- Weekly countdown ending Monday at 12:00 AM local time
- Total XP
- Active task count
- 35-day heatmap based on completed work
- Inactivity warning after 2+ days without completed work

The inactivity warning is intentionally not destructive. It offers actions like add task, edit week, pause, or delete.

### Timeline

Timeline shows scheduled sessions for the day/week.

It supports:

- Manual pinned tasks
- Smart scheduled tasks
- Visual difference between manual and smart blocks
- Early Bird view starting at 4:00 AM
- Smart Schedule feedback showing scheduled, protected, and unscheduled work

Manual timeline blocks are protected when Smart Schedule runs.

### Smart Schedule

Smart Schedule places active tasks into open timeline slots using:

- Priority
- Deadline
- Estimated duration
- Availability windows
- Past focus-session patterns
- Task spacing rules
- Existing pinned/manual sessions

It clears stale unpinned schedule blocks and keeps pinned blocks protected.

### Journal

Journal has two entry types in one unified system:

- Thought entries for writing, notes, ideas, reflections, and tags
- Training entries for gym logs

Training logs support:

- Muscle group
- Current pounds/bodyweight
- Exercise rows
- Sets, reps, weight, unit
- Session notes
- Last logged exercise hint

Journal cards stay short on the main page. Use the View button to read the full entry.

### Insights

Insights currently shows:

- Completed tasks
- Deep work minutes
- Peak focus hour
- Average focus session
- Energy-by-hour chart
- Completion velocity
- Satisfaction scorecard
- Training logs this week
- Sets this week
- Latest current pounds
- Thought count
- Top journal tags

### Vault

Vault is the completed/history area. You can search completed work and export archive data.

### Settings

Settings includes:

- Profile editing
- Sound toggle
- Dark mode
- Danger Zone reset

Reset deletes tasks, pursuits, schedules, progress logs, chunks, and journal entries. Preferences remain.

## Important Current Status

Flowo now uses Supabase email/password authentication and magic-link sign-in. Users can create an account and access the same profile from desktop or phone.

Before public deployment, review production RLS policies and configure your deployed frontend URL in Supabase Auth settings.

## Did We Remove Any README Functionality?

No core productivity functionality from the old README was intentionally removed.

Still present:

- AI task breakdown
- Smart scheduler
- Calendar/timeline layout
- Focus timer
- Progress logs
- Insights
- Archive/Vault
- Supabase-backed backend
- Groq-backed AI endpoint

Changed or updated:

- The product name changed from Vellum to Flowo.
- The app is now much broader than the original README: Pursuits, XP, heatmaps, Journal, Training logs, dark mode, reset flow, and weekly pursuit focus were added.
- The old Google OAuth flow was replaced with Supabase email/password and magic-link authentication.
- Old hackathon/live-link wording was removed because it described the original Vellum project, not this current Flowo version.

## Project Structure

```text
Flowo/
├── backend/
│   ├── supabase_schema.sql
│   └── src/
│       ├── ai/                 # AI task breakdown using Groq
│       ├── scheduler/          # Smart scheduling engine
│       ├── tasks/              # Tasks, pursuits, journal entries, preferences
│       ├── supabase/           # Supabase clients and guard
│       └── main.ts
│
├── frontend/
│   └── src/
│       ├── views/
│       │   ├── JournalView.tsx      # Canvas/task board
│       │   ├── PursuitsView.tsx     # Long-term goals and XP
│       │   ├── CalendarView.tsx     # Timeline
│       │   ├── JournalLogsView.tsx  # Thought journal and training log
│       │   ├── AnalysisView.tsx     # Insights
│       │   ├── ArchiveView.tsx      # Vault
│       │   └── GuideView.tsx
│       ├── components/
│       ├── hooks/
│       ├── services/
│       ├── types/
│       └── App.tsx
```

## Database Tables

The Supabase schema is in:

```text
backend/supabase_schema.sql
```

Core tables:

| Table | Purpose |
| --- | --- |
| `tasks` | Canvas tasks and pursuit XP metadata |
| `pursuits` | Long-term goals and weekly focus |
| `journal_entries` | Thought journal and training logs |
| `chunks` | AI/manual task subtasks |
| `task_instances` | Timeline schedule blocks |
| `progress_logs` | Focus-session logs |
| `user_preferences` | Availability, sound, and settings |
| `ai_usage` | Daily AI usage tracking |

Run the schema in Supabase before using the app.

## API Overview

All backend routes live under the NestJS API.

### Tasks

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/tasks` | Fetch tasks with chunks, logs, and instances |
| POST | `/tasks` | Create/update task |
| DELETE | `/tasks/:id` | Delete task |

### Pursuits

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/tasks/pursuits` | Fetch pursuits |
| POST | `/tasks/pursuits` | Create/update pursuit |
| DELETE | `/tasks/pursuits/:pursuitId` | Delete pursuit and unlink tasks |

### Journal

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/tasks/journal-entries` | Fetch journal/training entries |
| POST | `/tasks/journal-entries` | Create/update entry |
| DELETE | `/tasks/journal-entries/:entryId` | Delete entry |

### Timeline

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/tasks/instance` | Create pinned timeline block |
| DELETE | `/tasks/instance/:instanceId` | Remove timeline block |
| PATCH | `/tasks/instance/:instanceId/pin` | Pin/unpin timeline block |

### Scheduler and AI

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/scheduler/schedule` | Run Smart Schedule |
| POST | `/ai/classify-task` | AI task breakdown |

### Preferences and Reset

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/tasks/preferences` | Fetch preferences |
| POST | `/tasks/preferences` | Update preferences |
| DELETE | `/tasks/reset-all` | Reset workspace data |

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Framer Motion
- Lucide React
- Supabase JS

### Backend

- NestJS
- TypeScript
- Supabase/Postgres
- Groq SDK
- Luxon

## Local Setup

### 1. Clone

```bash
git clone git@github.com:Ahthe/Flowo.git
cd Flowo
```

### 2. Supabase

Create a Supabase project, then run:

```text
backend/supabase_schema.sql
```

in the Supabase SQL Editor.

### 3. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
API_KEY=your-groq-api-key
```

Start backend:

```bash
npm run start:dev
```

### 4. Frontend

```bash
cd ../frontend
npm install
```

Create `frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3000
```

Start frontend:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

## Deployment Notes

Recommended Vercel setup:

- Deploy `frontend/` as a Vite app.
- Deploy `backend/` as a NestJS backend project.
- Set `VITE_API_URL` in the frontend project to the deployed backend URL.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in the backend environment variables.

Before public deployment:

- Configure Supabase Auth redirect URLs for your deployed frontend.
- Review RLS policies for production.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in the backend environment variables.

## Development Commands

Frontend:

```bash
cd frontend
npm run build
```

Backend:

```bash
cd backend
npm run build
```
