import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  UpsertJournalEntryDto,
  UpsertPursuitDto,
  UpsertTaskDto,
} from './dto/task.dto';
import { LogProgressDto } from './dto/log-progress.dto';
import { PreferencesDto } from './dto/preferences.dto';
import {
  Task,
  UserPreferences,
  TaskChunk,
  TaskInstance,
  TaskHistory,
} from './types';

@Injectable()
export class TasksService {
  private readonly XP_BY_EFFORT: Record<string, number> = {
    tiny: 5,
    small: 10,
    medium: 25,
    deep: 50,
    major: 100,
  };

  constructor(private readonly supabase: SupabaseService) {}

  private getClient(token: string) {
    return this.supabase.getUserClient(token);
  }

  async findAll(token: string, userId: string): Promise<Task[]> {
    await this.markOverdueTasks(token, userId);

    const { data: tasksData, error } = await this.getClient(token)
      .from('tasks')
      .select(`*, chunks (*), progress_logs (*), task_instances (*)`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Tasks findAll error:', error.message);
      throw new InternalServerErrorException('Failed to retrieve tasks');
    }

    return (tasksData || []).map((t: any) => ({
      id: t.id,
      description: t.description,
      skillLevel: t.skill_level,
      priority: t.priority,
      deadline: t.deadline,
      estimatedTime: t.estimated_time,
      status: t.status,
      totalTimeSeconds: t.total_time_seconds || 0,
      scheduledStart: t.scheduled_start,
      scheduledEnd: t.scheduled_end,
      predictedSatisfaction: t.predicted_satisfaction,
      actualSatisfaction: t.actual_satisfaction,
      pursuitId: t.pursuit_id,
      contributionType: t.contribution_type,
      effortSize: t.effort_size,
      xpValue: t.xp_value,
      completedAt: t.completed_at,
      targetSessionsPerDay: t.target_sessions_per_day || 1,
      minSpacingMinutes: t.min_spacing_minutes || 60,
      chunks: (t.chunks || []).map((c: any) => ({
        id: c.id,
        chunk_name: c.chunk_name,
        duration: c.duration,
        completed: c.completed,
      })),
      history: (t.progress_logs || []).map((l: any) => ({
        date: l.created_at,
        startTime: l.start_time,
        endTime: l.end_time,
        durationSeconds: l.duration_seconds,
      })),
      instances: (t.task_instances || []).map((inst: any) => ({
        id: inst.id,
        taskId: inst.task_id,
        start: inst.start_time,
        end: inst.end_time,
        status: inst.status,
        actualDurationSeconds: inst.actual_duration_seconds,
        isPinned: inst.is_pinned || false,
      })),
    }));
  }

  async upsert(token: string, userId: string, dto: UpsertTaskDto) {
    const client = this.getClient(token);
    const effortSize = dto.effortSize || 'medium';
    const computedXp = this.XP_BY_EFFORT[effortSize] ?? this.XP_BY_EFFORT.medium;

    const taskPayload: any = {
      user_id: userId,
      description: dto.description,
      skill_level: dto.skillLevel,
      priority: dto.priority,
      deadline: dto.deadline,
      estimated_time: dto.estimatedTime,
      status: dto.status,
      total_time_seconds: dto.totalTimeSeconds ?? 0,
      scheduled_start: dto.scheduledStart,
      scheduled_end: dto.scheduledEnd,
      predicted_satisfaction: dto.predictedSatisfaction,
      actual_satisfaction: dto.actualSatisfaction,
      pursuit_id: dto.pursuitId || null,
      contribution_type: dto.contributionType || null,
      effort_size: effortSize,
      xp_value: dto.xpValue ?? computedXp,
      completed_at: dto.completedAt,
      target_sessions_per_day: dto.targetSessionsPerDay ?? 1,
      min_spacing_minutes: dto.minSpacingMinutes ?? 60,
    };

    if (dto.status === 'completed' && !dto.completedAt) {
      taskPayload.completed_at = new Date().toISOString();
    } else if (dto.status && dto.status !== 'completed') {
      taskPayload.completed_at = null;
    }

    if (dto.id) {
      taskPayload.id = dto.id;
    }

    const { data: taskData, error: taskError } = await client
      .from('tasks')
      .upsert(taskPayload)
      .select()
      .single();

    if (taskError) {
      console.error('Task upsert error:', taskError.message);
      throw new InternalServerErrorException('Failed to save task');
    }

    if (dto.chunks && dto.chunks.length > 0) {
      const chunksToUpsert = dto.chunks.map((c) => ({
        id: c.id || undefined,
        task_id: taskData.id,
        chunk_name: c.chunk_name,
        duration: c.duration,
        completed: c.completed ?? false,
      }));

      const { error: chunkError } = await client
        .from('chunks')
        .upsert(chunksToUpsert);

      if (chunkError) {
        console.error('Chunk upsert error:', chunkError.message);
        throw new InternalServerErrorException('Failed to save task chunks');
      }
    }

    if (dto.status === 'completed') {
      await this.clearFutureScheduledInstances(token, userId, taskData.id);
    }

    return taskData;
  }

  async findPursuits(token: string, userId: string) {
    const { data, error } = await this.getClient(token)
      .from('pursuits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Pursuits findAll error:', error.message);
      throw new InternalServerErrorException('Failed to retrieve pursuits');
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      why: p.why,
      target: p.target,
      weeklyFocus: p.weekly_focus,
      weeklyTargetXp: p.weekly_target_xp,
      category: p.category,
      deadline: p.deadline,
      status: p.status,
      color: p.color,
      createdAt: p.created_at,
    }));
  }

  async upsertPursuit(token: string, userId: string, dto: UpsertPursuitDto) {
    const payload: any = {
      user_id: userId,
      title: dto.title,
      why: dto.why || '',
      target: dto.target || '',
      weekly_focus: dto.weeklyFocus || '',
      weekly_target_xp: dto.weeklyTargetXp ?? 150,
      category: dto.category || 'personal',
      deadline: dto.deadline || null,
      status: dto.status || 'active',
      color: dto.color || 'yellow',
      updated_at: new Date().toISOString(),
    };

    if (dto.id) payload.id = dto.id;

    const { data, error } = await this.getClient(token)
      .from('pursuits')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.error('Pursuit upsert error:', error.message);
      throw new InternalServerErrorException('Failed to save pursuit');
    }

    return {
      id: data.id,
      title: data.title,
      why: data.why,
      target: data.target,
      weeklyFocus: data.weekly_focus,
      weeklyTargetXp: data.weekly_target_xp,
      category: data.category,
      deadline: data.deadline,
      status: data.status,
      color: data.color,
      createdAt: data.created_at,
    };
  }

  async removePursuit(token: string, userId: string, pursuitId: string) {
    const client = this.getClient(token);

    const { error: unlinkError } = await client
      .from('tasks')
      .update({ pursuit_id: null })
      .eq('user_id', userId)
      .eq('pursuit_id', pursuitId);

    if (unlinkError) {
      console.error('Pursuit unlink error:', unlinkError.message);
      throw new InternalServerErrorException('Failed to unlink pursuit tasks');
    }

    const { error } = await client
      .from('pursuits')
      .delete()
      .eq('id', pursuitId)
      .eq('user_id', userId);

    if (error) {
      console.error('Pursuit delete error:', error.message);
      throw new InternalServerErrorException('Failed to delete pursuit');
    }

    return { success: true };
  }

  async findJournalEntries(token: string, userId: string) {
    const { data, error } = await this.getClient(token)
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false });

    if (error) {
      console.error('Journal entries findAll error:', error.message);
      if (error.message?.includes('journal_entries')) {
        throw new InternalServerErrorException(
          'Journal table is missing. Run the Supabase journal_entries migration.',
        );
      }
      throw new InternalServerErrorException(
        'Failed to retrieve journal entries',
      );
    }

    return (data || []).map((entry: any) => ({
      id: entry.id,
      entryType: entry.entry_type,
      title: entry.title,
      body: entry.body,
      mood: entry.mood,
      tags: entry.tags || [],
      pursuitId: entry.pursuit_id,
      loggedAt: entry.logged_at,
      trainingData: entry.training_data,
      createdAt: entry.created_at,
    }));
  }

  async upsertJournalEntry(
    token: string,
    userId: string,
    dto: UpsertJournalEntryDto,
  ) {
    const payload: any = {
      user_id: userId,
      entry_type: dto.entryType,
      title: dto.title || '',
      body: dto.body || '',
      mood: dto.mood || '',
      tags: dto.tags || [],
      pursuit_id: dto.pursuitId || null,
      logged_at: dto.loggedAt || new Date().toISOString(),
      training_data: dto.entryType === 'training' ? dto.trainingData || {} : null,
      updated_at: new Date().toISOString(),
    };

    if (dto.id) payload.id = dto.id;

    const { data, error } = await this.getClient(token)
      .from('journal_entries')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.error('Journal entry upsert error:', error.message);
      throw new InternalServerErrorException('Failed to save journal entry');
    }

    return {
      id: data.id,
      entryType: data.entry_type,
      title: data.title,
      body: data.body,
      mood: data.mood,
      tags: data.tags || [],
      pursuitId: data.pursuit_id,
      loggedAt: data.logged_at,
      trainingData: data.training_data,
      createdAt: data.created_at,
    };
  }

  async removeJournalEntry(token: string, userId: string, entryId: string) {
    const { error } = await this.getClient(token)
      .from('journal_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) {
      console.error('Journal entry delete error:', error.message);
      throw new InternalServerErrorException('Failed to delete journal entry');
    }

    return { success: true };
  }

  async resetAll(token: string, userId: string) {
    const client = this.getClient(token);

    const { data: taskRows, error: taskFetchError } = await client
      .from('tasks')
      .select('id')
      .eq('user_id', userId);

    if (taskFetchError) {
      console.error('Reset task fetch error:', taskFetchError.message);
      throw new InternalServerErrorException('Failed to reset workspace');
    }

    const taskIds = (taskRows || []).map((task: any) => task.id);

    const deleteResults = await Promise.all([
      client.from('journal_entries').delete().eq('user_id', userId),
      client.from('task_instances').delete().eq('user_id', userId),
      client.from('progress_logs').delete().eq('user_id', userId),
      taskIds.length > 0
        ? client.from('chunks').delete().in('task_id', taskIds)
        : Promise.resolve({ error: null }),
      client.from('tasks').delete().eq('user_id', userId),
      client.from('pursuits').delete().eq('user_id', userId),
    ]);

    const errorResult = deleteResults.find((result: any) => result.error);
    if (errorResult && (errorResult as any).error) {
      console.error('Reset workspace error:', (errorResult as any).error.message);
      throw new InternalServerErrorException('Failed to reset workspace');
    }

    return { success: true };
  }

  async remove(token: string, userId: string, id: string) {
    const client = this.getClient(token);

    const [instancesResult, logsResult, chunksResult] = await Promise.all([
      client
        .from('task_instances')
        .delete()
        .eq('task_id', id)
        .eq('user_id', userId),
      client
        .from('progress_logs')
        .delete()
        .eq('task_id', id)
        .eq('user_id', userId),
      client.from('chunks').delete().eq('task_id', id),
    ]);

    if (instancesResult.error)
      console.error('Delete instances error:', instancesResult.error.message);
    if (logsResult.error)
      console.error('Delete logs error:', logsResult.error.message);
    if (chunksResult.error)
      console.error('Delete chunks error:', chunksResult.error.message);

    const { error } = await client
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Task delete error:', error.message);
      throw new InternalServerErrorException('Failed to delete task');
    }
    return { success: true };
  }

  async logProgress(
    token: string,
    userId: string,
    taskId: string,
    dto: LogProgressDto,
  ) {
    const client = this.getClient(token);

    const { data: task, error: taskError } = await client
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (taskError || !task) {
      throw new InternalServerErrorException(
        'Task not found or you do not have access',
      );
    }

    const { error } = await client.from('progress_logs').insert({
      user_id: userId,
      task_id: taskId,
      start_time: dto.startTime,
      end_time: dto.endTime,
      duration_seconds: dto.durationSeconds,
    });

    if (error) {
      console.error('Progress log error:', error.message);
      throw new InternalServerErrorException('Failed to save progress log');
    }
    return { success: true };
  }

  async removeChunk(token: string, userId: string, chunkId: string) {
    const client = this.getClient(token);
    const { error } = await client.from('chunks').delete().eq('id', chunkId);

    if (error) {
      console.error('Chunk delete error:', error.message);
      throw new InternalServerErrorException('Failed to delete chunk');
    }
    return { success: true };
  }

  async removeInstance(token: string, userId: string, instanceId: string) {
    const client = this.getClient(token);

    if (instanceId.startsWith('legacy-')) {
      const taskId = instanceId.replace('legacy-', '');
      const { error } = await client
        .from('tasks')
        .update({ scheduled_start: null, scheduled_end: null })
        .eq('id', taskId)
        .eq('user_id', userId);

      if (error) {
        console.error('Legacy instance remove error:', error.message);
        throw new InternalServerErrorException(
          'Failed to remove legacy instance',
        );
      }
      return { success: true };
    }

    const { error } = await client
      .from('task_instances')
      .delete()
      .eq('id', instanceId)
      .eq('user_id', userId);

    if (error) {
      console.error('Instance delete error:', error.message);
      throw new InternalServerErrorException('Failed to remove instance');
    }
    return { success: true };
  }

  async createInstance(
    token: string,
    userId: string,
    payload: { taskId: string; start: string; end: string; isPinned: boolean },
  ) {
    const client = this.getClient(token);

    const { data, error } = await client
      .from('task_instances')
      .insert({
        user_id: userId,
        task_id: payload.taskId,
        start_time: payload.start,
        end_time: payload.end,
        status: 'scheduled',
        is_pinned: payload.isPinned,
      })
      .select()
      .single();

    if (error) {
      console.error('Create instance error:', error.message);
      throw new InternalServerErrorException('Failed to create instance');
    }

    return { success: true, instanceId: data.id };
  }

  async getPreferences(token: string, userId: string) {
    const { data, error } = await this.getClient(token)
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Preferences fetch error:', error.message);
      throw new InternalServerErrorException('Failed to fetch preferences');
    }

    if (!data) return null;

    return {
      availableHours: data.available_hours || {},
      autoSchedule: data.auto_schedule || false,
      soundEnabled: data.sound_enabled ?? true,
    };
  }

  async updatePreferences(token: string, userId: string, dto: PreferencesDto) {
    const { error } = await this.getClient(token)
      .from('user_preferences')
      .upsert({
        user_id: userId,
        available_hours: dto.availableHours,
        auto_schedule: dto.autoSchedule,
        sound_enabled: dto.soundEnabled,
      });

    if (error) {
      console.error('Preferences update error:', error.message);
      throw new InternalServerErrorException('Failed to update preferences');
    }
    return { success: true };
  }

  async closePastScheduledInstances(token: string, userId: string) {
    const now = new Date().toISOString();
    const { error } = await this.getClient(token)
      .from('task_instances')
      .update({ status: 'missed' })
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .lt('end_time', now);

    if (error) {
      console.error('Close past instances error:', error.message);
    }
  }

  async markOverdueTasks(token: string, userId: string) {
    const now = new Date().toISOString();
    const { error } = await this.getClient(token)
      .from('tasks')
      .update({ status: 'overdue' })
      .eq('user_id', userId)
      .in('status', ['idle', 'running', 'paused'])
      .lt('deadline', now);

    if (error) {
      console.error('Mark overdue tasks error:', error.message);
    }
  }

  async pinInstance(
    token: string,
    userId: string,
    instanceId: string,
    isPinned: boolean,
  ) {
    const { error } = await this.getClient(token)
      .from('task_instances')
      .update({ is_pinned: isPinned })
      .eq('id', instanceId)
      .eq('user_id', userId);

    if (error) {
      console.error('Pin instance error:', error.message);
      throw new InternalServerErrorException('Failed to pin instance');
    }
    return { success: true };
  }

  async clearFutureScheduledInstances(
    token: string,
    userId: string,
    taskId?: string,
  ) {
    const now = new Date().toISOString();
    let query = this.getClient(token)
      .from('task_instances')
      .delete()
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .eq('is_pinned', false)
      .gte('start_time', now);

    if (taskId) {
      query = query.eq('task_id', taskId);
    }

    const { error } = await query;

    if (error) {
      console.error('Clear instances error:', error.message);
      if (error.code === '42703') {
        console.warn(
          'is_pinned column does not exist. Please run migration 007.',
        );
      } else {
        throw new InternalServerErrorException('Failed to clear old schedule');
      }
    }
  }

  async bulkInsertInstances(token: string, userId: string, instances: any[]) {
    if (instances.length === 0) return;

    const payload = instances.map((inst) => ({
      user_id: userId,
      task_id: inst.taskId,
      start_time: inst.start,
      end_time: inst.end,
      status: 'scheduled',
    }));

    const { error } = await this.getClient(token)
      .from('task_instances')
      .insert(payload);

    if (error) {
      console.error('Bulk insert instances error:', error.message);
      throw new InternalServerErrorException('Failed to save new schedule');
    }
  }
}
