export interface TaskInstance {
  id: string;
  taskId: string;
  start: string;
  end: string;
  status: string;
  actualDurationSeconds?: number;
}

export interface TaskChunk {
  id: string;
  taskId: string;
  chunkName: string;
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
  priority: string;
  deadline?: string;
  estimatedTime: string;
  status: string;
  totalTimeSeconds: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  predictedSatisfaction?: number;
  actualSatisfaction?: number;
  pursuitId?: string;
  contributionType?: string;
  effortSize?: string;
  xpValue?: number;
  completedAt?: string;
  targetSessionsPerDay?: number;
  minSpacingMinutes?: number;
  chunks?: TaskChunk[];
  instances?: TaskInstance[];
  history?: TaskHistory[];
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
  status: string;
  color: string;
  createdAt?: string;
}

export interface JournalEntry {
  id: string;
  entryType: 'thought' | 'training';
  title?: string;
  body?: string;
  mood?: string;
  tags?: string[];
  pursuitId?: string;
  loggedAt: string;
  trainingData?: any;
  createdAt?: string;
}

export interface UserPreferences {
  availableHours: Record<string, [string, string]>;
  autoSchedule: boolean;
  soundEnabled: boolean;
}
