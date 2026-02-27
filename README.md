<h1 align="center" style="font-size: 60px;">Vellum</h1>

<p align="center">
  <strong>Second Place Winner — Build4Students Hackathon 2026</strong>
</p>

<p align="center">
  <img src="https://github.com/emanalytic/Vellum/blob/main/image.png" width="700" alt="Vellum Preview"/>
</p>

<p align="center">
  <a href="https://www.vellum.foo/">Try it out here</a> |
  <a href="https://devpost.com/software/vellum-tgv241">Devpost Submission</a>
</p>

A productivity application that helps you plan, schedule, and track your work. It goes beyond a simple to-do list by automatically arranging tasks into your calendar based on when you actually focus best.

_"Vellum" is the high-quality parchment used for historical manuscripts. The name reflects the idea of treating your plans with care like writing on something that is meant to last._(❁´◡`❁)

---

## Table of Contents

- [Overview](#overview)
- [How the Scheduler Works (with example)](#how-the-scheduler-works)
- [Calendar Layout Algorithm](#calendar-layout-algorithm)
- [AI Task Breakdown](#ai-task-breakdown)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Contributing](#contributing)

---

## Overview

Most productivity tools treat all tasks as equal and ignore the fact that your energy changes throughout the day. Vellum addresses this by sitting between your task list and your calendar.

The system does three things:

1. **Breaks down big tasks** into smaller steps using AI, so you know where to start.
2. **Schedules those tasks automatically** into time slots where you historically focus best.
3. **Tracks your focus sessions** so the scheduler gets smarter over time.

---

## How the Scheduler Works

The scheduler lives in `backend/src/scheduler/scheduler.service.ts`. When you press the "Schedule" button, here is exactly what happens, step by step.

### Step 1: Cleanup

Before doing anything, the scheduler clears stale data:

- Any past instances that were never completed get marked as `missed`.
- Any future un-pinned instances get deleted. Pinned instances (ones you manually placed) are left alone.

This means each schedule run starts fresh, without duplicating old entries.

### Step 2: Sort tasks by urgency

All active tasks (not completed, not archived) are sorted. The sort works on two levels:

1. **Priority first.** High (weight 3) before Medium (weight 2) before Low (weight 1).
2. **Deadline second.** If two tasks have the same priority, the one with the earlier deadline goes first.

This means a High-priority task due tomorrow will always be scheduled before a Low-priority task due next week.

### Step 3: Build the energy profile

The scheduler calls a Postgres function (`get_user_peak_hours`) that counts how many focus sessions you have logged at each hour of the day, using your timezone. This produces an array of 24 numbers — one per hour.

For example, if you tend to log work at 10 AM, 11 AM, and 2 PM, those hours will have higher counts. If you have never logged any sessions, all hours are treated equally (score of 5).

### Step 4: Generate and score time slots

For each day (default: 3 days ahead), the scheduler:

1. Reads your availability window for that day of the week (e.g., Monday 9:00–17:00).
2. Breaks that window into 15-minute slots.
3. Scores each slot using the energy profile from Step 3.
4. Sorts slots by score, highest first.

This means the best hours are tried first.

### Step 5: Place each task

For each task, the scheduler walks through the scored slots and tries to place it. A slot is accepted only if **all** of these checks pass:

| Check                 | What it does                                                                           |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Fits in window**    | The task's duration does not run past the end of your availability                     |
| **Before deadline**   | The slot ends before the task's deadline                                               |
| **No collision**      | The slot does not overlap with any already-scheduled instance                          |
| **Spacing respected** | The slot is far enough from the same task's other sessions (default: 60 minutes apart) |

If a slot passes all four checks, the task is placed there. If the task allows multiple sessions per day (`targetSessionsPerDay`), the scheduler continues looking for more slots that same day.

### Walkthrough Example

Imagine you have two tasks:

- **Task A**: "Write essay" — High priority, deadline in 2 days, estimated 60 minutes, 1 session/day.
- **Task B**: "Review notes" — Medium priority, no deadline, estimated 30 minutes, 2 sessions/day.

Your availability is 9:00 AM to 5:00 PM, and your energy profile shows you focus best at 10 AM and 2 PM.

Here is what happens:

```
1. Tasks are sorted: [Task A (high), Task B (medium)]

2. Energy profile scores (simplified):
   10 AM = 8,  2 PM = 7,  9 AM = 3,  11 AM = 4, ...

3. Scored slots for Day 1 (sorted by energy):
   10:00 (score 8), 10:15 (score 8), 10:30 (score 8), 10:45 (score 8),
   14:00 (score 7), 14:15 (score 7), ...

4. Place Task A (60 min, 1 session/day):
   - Try 10:00–11:00 → no collision, no spacing issue → PLACED
   - 1 session done for today, move on.

5. Place Task B (30 min, 2 sessions/day):
   - Try 10:00 → collision with Task A → skip
   - Try 10:15 → collision with Task A → skip
   - ...
   - Try 11:00–11:30 → no collision → PLACED (session 1)
   - Try 14:00–14:30 → no collision, 3 hours from session 1
     (spacing = 60 min, 3 hours > 60 min) → PLACED (session 2)
   - 2 sessions done for today, move on.

Result for Day 1:
  10:00–11:00  Task A "Write essay"
  11:00–11:30  Task B "Review notes"
  14:00–14:30  Task B "Review notes"
```

The same process repeats for Day 2 and Day 3.

### Where to find each part

| What                               | File                   | Function                          |
| ---------------------------------- | ---------------------- | --------------------------------- |
| Entry point                        | `scheduler.service.ts` | `scheduleTasks()`                 |
| Sort tasks by priority/deadline    | `scheduler.service.ts` | `activeTasks.sort(...)` (line 45) |
| Build energy profile from DB       | `scheduler.service.ts` | `buildPeakHoursMap()`             |
| Turn availability into time ranges | `scheduler.service.ts` | `precomputeDayWindows()`          |
| Score and sort 15-min slots        | `scheduler.service.ts` | `generateScoredCandidates()`      |
| Check for time collisions          | `scheduler.service.ts` | `hasCollision()`                  |
| Check spacing between sessions     | `scheduler.service.ts` | `violatesSpacing()`               |
| Parse "60m" or "1.5h" to minutes   | `scheduler.service.ts` | `parseDuration()`                 |
| Save results to DB in one call     | `tasks.service.ts`     | `bulkInsertInstances()`           |

---

## Calendar Layout Algorithm

When you open the calendar day view, the frontend needs to display overlapping events side by side (like Google Calendar does). This is handled by the `positionedInstances` function in `frontend/src/views/CalendarView.tsx`.

### How it works

The algorithm runs in three passes over the day's instances (already sorted by start time):

**Pass 1 — Pre-parse dates.** Every instance's `start` and `end` strings are converted to numbers (milliseconds) once. This avoids creating `new Date()` objects repeatedly inside loops.

**Pass 2 — Build clusters.** Walk through instances in order. If the current instance starts before the running `clusterMaxEnd`, it belongs to the current cluster (it overlaps with something). Otherwise, start a new cluster. The key detail: `clusterMaxEnd` is updated with a simple comparison (`if iEnd > clusterMaxEnd`), not by re-scanning the whole cluster.

**Pass 3 — Assign columns.** For each cluster, assign instances to columns. A column tracks only the end-time of the last item placed in it (a single number, not an array of objects). For each instance, try existing columns. If the instance starts after a column's end-time, it fits in that column. Otherwise, create a new column.

### Performance

| Step            | Time Complexity      | Why                                                          |
| --------------- | -------------------- | ------------------------------------------------------------ |
| Pre-parse dates | O(N)                 | One pass, one `Map.set()` per instance                       |
| Build clusters  | O(N)                 | One pass, one comparison per instance                        |
| Assign columns  | O(N x C)             | N = instances, C = max overlapping columns (usually 2–3)     |
| **Total**       | **O(N)** in practice | C is bounded by screen width, so N x C is effectively linear |

The old version was O(N^2) because it called `Math.max(...cluster.map(ci => new Date(ci.end)))` inside the loop, which re-scanned the entire cluster and created a new `Date` object for every item on every iteration.

### Where to find it

| What                       | File               | Line                           |
| -------------------------- | ------------------ | ------------------------------ |
| Date pre-parsing           | `CalendarView.tsx` | `startTimes` / `endTimes` Maps |
| Cluster building           | `CalendarView.tsx` | `clusterMaxEnd` variable       |
| Column assignment          | `CalendarView.tsx` | `colEnds: number[]` array      |
| Pixel position calculation | `CalendarView.tsx` | `getTaskStyle()`               |

---

## AI Task Breakdown

When you add a task and choose "AI Breakdown", the backend sends your task description to Groq (Llama 3.3 70B) and asks it to split the task into 1–5 smaller steps.

### How the prompt is calibrated

The AI adjusts its time estimates based on the skill level you select:

| Skill Level             | Multiplier    | Chunk Detail                 |
| ----------------------- | ------------- | ---------------------------- |
| Total Novice / Beginner | 1.5x longer   | More detailed, smaller steps |
| Intermediate            | 1x (baseline) | Standard chunking            |
| Advanced / Master       | 0.7x shorter  | Broader, fewer steps         |

### Rate limiting

Each user is limited to **3 AI calls per day**. This is enforced at the database level using a Postgres function (`increment_ai_usage`). The function inserts a usage row, counts today's rows, and raises an exception if the count exceeds 3. This is done atomically to prevent race conditions where two simultaneous requests could both slip through.

### Where to find it

| What                        | File                                                  |
| --------------------------- | ----------------------------------------------------- |
| AI service and prompt       | `backend/src/ai/ai.service.ts`                        |
| Rate limiter (DB function)  | `backend/database/migrations/009_atomic_ai_usage.sql` |
| Frontend hook that calls it | `frontend/src/hooks/useTasks.ts` → `fetchChunks()`    |

---

## Project Structure

```
vellum/
├── backend/
│   └── src/
│       ├── ai/                  # AI task breakdown (Groq/Llama)
│       │   ├── ai.service.ts        # Prompt, parsing, rate limit check
│       │   ├── ai.controller.ts     # POST /ai/classify-task
│       │   └── dto/                 # Request/response shapes
│       ├── scheduler/           # Auto-scheduling engine
│       │   ├── scheduler.service.ts # All scheduling logic
│       │   └── scheduler.controller.ts  # POST /scheduler/schedule
│       ├── tasks/               # Task CRUD and instances
│       │   ├── tasks.service.ts     # Database operations
│       │   ├── tasks.controller.ts  # REST endpoints
│       │   ├── dto/                 # Validation classes
│       │   └── types.ts             # TypeScript interfaces
│       ├── auth/                # JWT guard, user extraction
│       ├── supabase/            # Supabase client factory
│       └── main.ts              # App bootstrap
│
├── frontend/
│   └── src/
│       ├── views/
│       │   ├── CalendarView.tsx      # Day/week calendar with layout algorithm
│       │   ├── JournalView.tsx       # Task list ("sketchbook" style)
│       │   ├── AnalysisView.tsx      # Charts and productivity insights
│       │   ├── ArchiveView.tsx       # Completed/archived tasks
│       │   └── GuideView.tsx         # Onboarding help
│       ├── components/
│       │   ├── tasks/TaskCard.tsx     # Individual task card
│       │   └── tasks/ChunkPanel.tsx   # Sub-task management
│       ├── hooks/
│       │   ├── useTasks.ts           # All task operations (add, update, delete, schedule)
│       │   └── useSound.ts           # UI sound effects
│       ├── services/
│       │   ├── api.ts                # HTTP calls to backend
│       │   └── supabase.ts           # Supabase client
│       ├── types/index.ts            # Shared TypeScript types
│       └── App.tsx                   # Root component, routing, auth
│
└── backend/database/
    └── migrations/               # SQL migrations (run in order)
        ├── 001_add_satisfaction_columns.sql
        ├── 004_task_instances.sql
        ├── 008_get_user_peak_hours.sql
        ├── 009_atomic_ai_usage.sql
        └── ...
```

---

## Database Schema

### Core Tables

| Table              | Purpose                        | Key Columns                                                                                                  |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `tasks`            | Stores every task              | `id`, `description`, `priority`, `skill_level`, `deadline`, `estimated_time`, `status`, `total_time_seconds` |
| `chunks`           | Sub-tasks within a task        | `id`, `task_id`, `chunk_name`, `duration`, `completed`                                                       |
| `task_instances`   | Scheduled calendar slots       | `id`, `task_id`, `user_id`, `start_time`, `end_time`, `status`, `is_pinned`                                  |
| `progress_logs`    | Logged focus sessions          | `id`, `task_id`, `user_id`, `start_time`, `end_time`, `duration_seconds`                                     |
| `user_preferences` | Availability windows, settings | `user_id`, `available_hours` (JSON), `auto_schedule`, `sound_enabled`                                        |
| `ai_usage`         | Tracks daily AI calls          | `user_id`, `created_at`                                                                                      |

### Important Instance Statuses

| Status      | Meaning                                   |
| ----------- | ----------------------------------------- |
| `scheduled` | Placed on calendar, not yet done          |
| `completed` | User finished the session                 |
| `missed`    | The time passed without the user starting |
| `skipped`   | User manually removed it                  |

### Indexes

The `task_instances` table has two indexes for fast lookups:

- `idx_task_instances_user_time` on `(user_id, start_time, end_time)` — used when the scheduler checks for collisions.
- `idx_task_instances_parent_id` on `(task_id)` — used when deleting a task and its instances.

---

## API Reference

All endpoints require a Bearer token in the `Authorization` header. The token comes from Supabase Auth.

### Tasks

| Method | Endpoint     | What it does                                                              |
| ------ | ------------ | ------------------------------------------------------------------------- |
| GET    | `/tasks`     | Get all tasks for the current user, including chunks, logs, and instances |
| POST   | `/tasks`     | Create or update a task (upsert). Send the full task object.              |
| DELETE | `/tasks/:id` | Delete a task and all its related data (chunks, instances, logs)          |

### Chunks (sub-tasks)

| Method | Endpoint           | What it does          |
| ------ | ------------------ | --------------------- |
| DELETE | `/tasks/chunk/:id` | Delete a single chunk |

### Instances (calendar slots)

| Method | Endpoint                  | What it does                         |
| ------ | ------------------------- | ------------------------------------ |
| POST   | `/tasks/instance`         | Create a manually pinned instance    |
| DELETE | `/tasks/instance/:id`     | Remove an instance from the calendar |
| PATCH  | `/tasks/instance/:id/pin` | Pin or unpin an instance             |

### Progress Logs

| Method | Endpoint             | What it does                  |
| ------ | -------------------- | ----------------------------- |
| POST   | `/tasks/log/:taskId` | Log a completed focus session |

### Preferences

| Method | Endpoint             | What it does                             |
| ------ | -------------------- | ---------------------------------------- |
| GET    | `/tasks/preferences` | Get user availability hours and settings |
| POST   | `/tasks/preferences` | Update availability hours and settings   |

### Scheduler

| Method | Endpoint              | What it does                                                   |
| ------ | --------------------- | -------------------------------------------------------------- |
| POST   | `/scheduler/schedule` | Run the auto-scheduler. Accepts `{ timezone, daysToSchedule }` |

### AI

| Method | Endpoint            | What it does                                                          |
| ------ | ------------------- | --------------------------------------------------------------------- |
| POST   | `/ai/classify-task` | Break a task into chunks. Accepts `{ task_description, skill_level }` |

---

## Technology Stack

### Frontend

| Technology    | What it does here                                  |
| ------------- | -------------------------------------------------- |
| React 19      | UI framework                                       |
| TypeScript    | Type safety across the entire frontend             |
| Tailwind CSS  | Custom design system with a "sketchbook" theme     |
| Framer Motion | Page transitions and micro-animations              |
| Recharts      | Focus distribution, velocity, and energy charts    |
| Supabase JS   | Authentication (login, signup, session management) |

### Backend

| Technology | What it does here                                                |
| ---------- | ---------------------------------------------------------------- |
| NestJS     | REST API framework with dependency injection                     |
| TypeScript | Type safety across the entire backend                            |
| Supabase   | PostgreSQL database, Row Level Security, auth token verification |
| Groq SDK   | AI inference (Llama 3.3 70B) for task breakdown                  |
| Luxon      | Timezone-aware date math in the scheduler                        |

---

## Getting Started

### What you need

- Node.js 18 or higher
- A Supabase project (free tier works)
- A Groq API key (for AI features)

### 1. Clone the repository

```bash
git clone https://github.com/emanalytic/vellum.git
cd vellum
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` folder:

```
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
API_KEY=your-groq-api-key
```

Run the SQL migration files (in `backend/database/migrations/`) in order against your Supabase database. You can do this through the Supabase SQL editor.

Start the backend:

```bash
npm run start:dev
```

### 3. Set up the frontend

```bash
cd ../frontend
npm install
```

Create a `.env` file in the `frontend/` folder:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3000
```

Start the frontend:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## Contributing

Contributions are welcome. Here is how to get started:

1. Fork the repository and clone your fork locally.
2. Create a branch for your change (`git checkout -b fix/your-change`).
3. Make your changes. See the table below to find the right files.
4. Test locally run both the backend (`npm run start:dev`) and frontend (`npm run dev`) and make sure nothing is broken.
5. Commit with a clear message describing what you changed and why.
6. Open a pull request against `main`.

### Guidelines

- Keep it simple. Plain code is better than clever code.
- If you add a new backend endpoint, add the matching call in `frontend/src/services/api.ts`.
- If you change a database table, write a new migration file. Do not edit old migration files.
- Run `npx tsc --noEmit` in both `backend/` and `frontend/` before pushing to catch type errors early.

---

Author: Eman Nisar ([@emanalytic](https://github.com/emanalytic))
