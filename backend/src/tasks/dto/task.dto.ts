import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TaskStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
  OVERDUE = 'overdue',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum SkillLevel {
  TOTAL_NOVICE = 'total_novice',
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  MASTER = 'master',
}

export enum ContributionType {
  BUILD = 'build',
  PRACTICE = 'practice',
  HEALTH = 'health',
  PIPELINE = 'pipeline',
  REVIEW = 'review',
}

export enum EffortSize {
  TINY = 'tiny',
  SMALL = 'small',
  MEDIUM = 'medium',
  DEEP = 'deep',
  MAJOR = 'major',
}

export enum JournalEntryType {
  THOUGHT = 'thought',
  TRAINING = 'training',
}

export class TaskChunkDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  chunk_name: string;

  @IsInt()
  @Min(0)
  duration: number;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}

export class UpsertTaskDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  skillLevel?: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsString()
  @IsOptional()
  estimatedTime?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  totalTimeSeconds?: number;

  @IsDateString()
  @IsOptional()
  scheduledStart?: string;

  @IsDateString()
  @IsOptional()
  scheduledEnd?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskChunkDto)
  @IsOptional()
  chunks?: TaskChunkDto[];

  @IsInt()
  @Min(0)
  @IsOptional()
  predictedSatisfaction?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  actualSatisfaction?: number;

  @IsString()
  @IsOptional()
  pursuitId?: string;

  @IsEnum(ContributionType)
  @IsOptional()
  contributionType?: ContributionType;

  @IsEnum(EffortSize)
  @IsOptional()
  effortSize?: EffortSize;

  @IsInt()
  @Min(0)
  @IsOptional()
  xpValue?: number;

  @IsDateString()
  @IsOptional()
  completedAt?: string;

  @IsArray()
  @IsOptional()
  history?: any[];

  @IsInt()
  @Min(1)
  @IsOptional()
  targetSessionsPerDay?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  minSpacingMinutes?: number;
}

export class UpsertPursuitDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  why?: string;

  @IsString()
  @IsOptional()
  target?: string;

  @IsString()
  @IsOptional()
  weeklyFocus?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  weeklyTargetXp?: number;

  @IsString()
  @IsOptional()
  category?: string;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  color?: string;
}

export class UpsertJournalEntryDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsEnum(JournalEntryType)
  entryType: JournalEntryType;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  mood?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  pursuitId?: string;

  @IsDateString()
  @IsOptional()
  loggedAt?: string;

  @IsOptional()
  trainingData?: any;
}
