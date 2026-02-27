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
  timeSpent: number;
  totalTimeSeconds: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  predictedSatisfaction?: number;
  actualSatisfaction?: number;
  targetSessionsPerDay?: number;
  minSpacingMinutes?: number;
  chunks?: TaskChunk[];
  instances?: TaskInstance[];
  history?: TaskHistory[];
}

export interface UserPreferences {
  availableHours: Record<string, [string, string]>;
  autoSchedule: boolean;
  soundEnabled: boolean;
}
