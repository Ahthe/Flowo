export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "archived"
  | "overdue";
export type ContributionType =
  | "build"
  | "practice"
  | "health"
  | "pipeline"
  | "review";
export type EffortSize = "tiny" | "small" | "medium" | "deep" | "major";

export interface TaskChunk {
  id: string;
  chunk_name: string;
  duration: number;
  completed: boolean;
}

export interface TaskHistory {
  date: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
}

export interface Task {
  id: string;
  description: string;
  skillLevel: string;
  priority: TaskPriority;
  deadline: string;
  estimatedTime: string;
  status: TaskStatus;

  chunks?: TaskChunk[];
  history: TaskHistory[];
  totalTimeSeconds: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  predictedSatisfaction?: number;
  actualSatisfaction?: number;
  pursuitId?: string;
  contributionType?: ContributionType;
  effortSize?: EffortSize;
  xpValue?: number;
  completedAt?: string;
  targetSessionsPerDay?: number;
  minSpacingMinutes?: number;
  instances?: TaskInstance[];
}

export interface TaskInstance {
  id: string;
  start: string;
  end: string;
  status: 'scheduled' | 'completed' | 'missed' | 'skipped';
  actualDurationSeconds?: number;
  isPinned?: boolean;
}

export interface UserPreferences {
  availableHours: { [key: string]: string[] };
  autoSchedule: boolean;
  soundEnabled: boolean;
}

export interface Pursuit {
  id: string;
  title: string;
  why?: string;
  target?: string;
  weeklyFocus?: string;
  weeklyTargetXp?: number;
  category: string;
  deadline?: string;
  status: "active" | "paused" | "completed" | "archived";
  color: "yellow" | "pink" | "blue" | "green" | "orange";
  createdAt?: string;
}

export type JournalEntryType = "thought" | "training";

export interface TrainingExercise {
  id?: string;
  name: string;
  sets: number;
  reps: string;
  weight: string;
  unit: string;
  notes?: string;
}

export interface TrainingData {
  muscleGroup: string;
  currentPounds?: string;
  exercises: TrainingExercise[];
  notes?: string;
}

export interface JournalEntry {
  id: string;
  entryType: JournalEntryType;
  title?: string;
  body?: string;
  mood?: string;
  tags?: string[];
  pursuitId?: string;
  loggedAt: string;
  trainingData?: TrainingData;
  createdAt?: string;
}

export interface SchedulerResult {
  scheduledCount: number;
  unschedulableCount: number;
  unschedulableTasks?: string[];
  schedule: { taskId: string; start: string; end: string }[];
}
