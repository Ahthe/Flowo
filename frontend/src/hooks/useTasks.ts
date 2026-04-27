import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "../services/api";
import type { JournalEntry, Task, TaskHistory, TaskChunk, Pursuit } from "../types";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import type { Session } from "@supabase/supabase-js";

const XP_BY_EFFORT = {
  tiny: 5,
  small: 10,
  medium: 25,
  deep: 50,
  major: 100,
} as const;

export interface SmartScheduleSummary {
  scheduledCount: number;
  unschedulableCount: number;
  unschedulableTasks: string[];
  protectedPinnedCount: number;
  topHours: string[];
}

export interface CompletionSummary {
  taskTitle: string;
  xpValue: number;
  contributionType?: Task["contributionType"];
  pursuitTitle?: string;
}

export const useTasks = (session: Session | null) => {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pursuits, setPursuits] = useState<Pursuit[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalEntriesError, setJournalEntriesError] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [smartScheduleSummary, setSmartScheduleSummary] = useState<SmartScheduleSummary | null>(null);
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const tasksRef = useRef<Task[]>([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const fetchTasks = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const dbTasks = await api.getTasks();
      setTasks(dbTasks);
    } catch (e) {
      console.error("Error fetching tasks:", e);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const fetchPursuits = useCallback(async () => {
    if (!session) return;
    try {
      const dbPursuits = await api.getPursuits();
      setPursuits(dbPursuits);
    } catch (e) {
      console.error("Error fetching pursuits:", e);
    }
  }, [session]);

  const fetchJournalEntries = useCallback(async () => {
    if (!session) return;
    try {
      const dbEntries = await api.getJournalEntries();
      setJournalEntries(dbEntries);
      setJournalEntriesError(null);
    } catch (e) {
      console.error("Error fetching journal entries:", e);
      setJournalEntriesError(
        e instanceof Error
          ? e.message
          : "Journal entries could not be loaded.",
      );
    }
  }, [session]);

  const fetchChunks = useCallback(async (description: string, skill: string) => {
    const data = await api.classifyTask(description, skill);
    return (data.suggested_chunks || []).map((c: { chunk_name?: string; title?: string; estimated_duration_min: number }) => ({
      id: crypto.randomUUID(),
      chunk_name: c.chunk_name || c.title,
      duration: c.estimated_duration_min,
      completed: false,
    }));
  }, []);

  useEffect(() => {
    if (session) {
      fetchTasks();
      fetchPursuits();
      fetchJournalEntries();
    } else {
      setTasks([]);
      setPursuits([]);
      setJournalEntries([]);
      setJournalEntriesError(null);
    }
  }, [session, fetchTasks, fetchPursuits, fetchJournalEntries]);

  const addTask = async (deck: {
    description: string;
    skillLevel: string;
    priority: string;
    deadline: string;
    estimatedTime: string;
    wantsChunks: boolean;
    predictedSatisfaction?: number;
    targetSessionsPerDay?: number;
    minSpacingMinutes?: number;
    pursuitId?: string;
    contributionType?: Task["contributionType"];
    effortSize?: Task["effortSize"];
    scheduleOnTimeline?: boolean;
    scheduledStart?: string;
  }) => {
    if (!session) return;
    if (!deck.deadline && !deck.scheduleOnTimeline) {
      showToast("A deadline is essential to your journey.", "error");
      return;
    }

    if (deck.scheduleOnTimeline && !deck.scheduledStart) {
      showToast("Pick a start time for the timeline.", "error");
      return;
    }

    const durationMin = parseInt(deck.estimatedTime) || 60;
    const scheduledStart = deck.scheduledStart ? new Date(deck.scheduledStart) : null;
    if (deck.scheduleOnTimeline && scheduledStart && scheduledStart <= new Date()) {
      showToast("Timeline start must be in the future.", "error");
      return;
    }

    const scheduledEnd = scheduledStart
      ? new Date(scheduledStart.getTime() + durationMin * 60000)
      : null;

    setIsClassifying(true);
    try {
      let chunks: TaskChunk[] = [];
      let aiLimitReached = false;

      if (deck.wantsChunks) {
        try {
          chunks = await fetchChunks(deck.description, deck.skillLevel);
        } catch (e: any) {
          if (e.message?.includes("Daily AI limit reached") || e.message?.includes("(429)")) {
            aiLimitReached = true;
          } else {
            throw e; 
          }
        }
      }

      const newTask: Task = {
        id: crypto.randomUUID(),
        description: deck.description,
        skillLevel: deck.skillLevel,
        priority: deck.priority as any,
        deadline: deck.deadline
          ? new Date(deck.deadline).toISOString()
          : scheduledEnd!.toISOString(),
        estimatedTime: `${deck.estimatedTime}m`,
        status: "idle",
        totalTimeSeconds: 0,
        chunks: chunks,
        history: [],
        predictedSatisfaction: deck.predictedSatisfaction,
        targetSessionsPerDay: deck.targetSessionsPerDay || 1,
        minSpacingMinutes: deck.minSpacingMinutes || 60,
        pursuitId: deck.pursuitId || undefined,
        contributionType: deck.contributionType,
        effortSize: deck.effortSize || "medium",
        xpValue: XP_BY_EFFORT[deck.effortSize || "medium"],
      };

      await api.upsertTask(newTask);

      let timelineCreated = false;
      if (deck.scheduleOnTimeline && scheduledStart && scheduledEnd) {
        try {
          const result = await api.createInstance({
            taskId: newTask.id,
            start: scheduledStart.toISOString(),
            end: scheduledEnd.toISOString(),
            isPinned: true,
          });
          timelineCreated = true;
          newTask.instances = [{
            id: result.instanceId,
            start: scheduledStart.toISOString(),
            end: scheduledEnd.toISOString(),
            status: "scheduled",
            isPinned: true,
          }];
        } catch (e) {
          console.error("Timeline placement error:", e);
        }
      }

      setTasks(prev => [newTask, ...prev]);
      
      if (aiLimitReached) {
        showToast("Task saved manually. (Daily AI limit reached)", "success");
      } else {
        showToast(
          deck.scheduleOnTimeline
            ? timelineCreated
              ? "Task added to the timeline!"
              : "Task saved, but timeline placement failed."
            : "Task added!",
          timelineCreated || !deck.scheduleOnTimeline ? "success" : "info",
        );
      }
      return newTask;
    } catch (e: any) {
      console.error("Error adding task:", e);
      showToast("Failed to save task: " + (e.message || "Something went wrong."), "error");
    } finally {
      setIsClassifying(false);
    }
  };

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    // Client-side validation before sending
    if (updates.deadline) {
      const deadlineDate = new Date(updates.deadline);
      if (deadlineDate <= new Date()) {
        showToast("Deadline must be in the future.", "error");
        return;
      }
    }

    if (updates.estimatedTime) {
      const mins = parseInt(updates.estimatedTime);
      if (isNaN(mins) || mins < 1) {
        showToast("Duration must be at least 1 minute.", "error");
        return;
      }
    }

    const xpUpdates = updates.effortSize && updates.xpValue === undefined
      ? { ...updates, xpValue: XP_BY_EFFORT[updates.effortSize] }
      : updates;
    const normalizedUpdates = xpUpdates.status === "completed" && !xpUpdates.completedAt
      ? { ...xpUpdates, completedAt: new Date().toISOString() }
      : xpUpdates.status && xpUpdates.status !== "completed"
        ? { ...xpUpdates, completedAt: undefined }
        : xpUpdates;

    const originalTasks = [...tasksRef.current];
    const originalTask = originalTasks.find(t => t.id === id);
    const shouldShowCompletionSummary =
      normalizedUpdates.status === "completed" && originalTask?.status !== "completed";
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...normalizedUpdates } : t));

    if (session) {
      try {
        const taskToUpdate = tasksRef.current.find(t => t.id === id);
        if (taskToUpdate) {
          const finalTask = { ...taskToUpdate, ...normalizedUpdates };
          const { instances, ...cleanTask } = finalTask as any; 
          await api.upsertTask(cleanTask);
          if (shouldShowCompletionSummary) {
            const pursuit = pursuits.find(p => p.id === finalTask.pursuitId);
            setCompletionSummary({
              taskTitle: finalTask.description,
              xpValue: finalTask.xpValue || XP_BY_EFFORT[finalTask.effortSize || "medium"],
              contributionType: finalTask.contributionType,
              pursuitTitle: pursuit?.title,
            });
          }
        }
      } catch (e: any) {
        console.error("Update error:", e);
        setTasks(originalTasks);
        const msg = e.message || "Something went wrong.";
        showToast(`Failed to save: ${msg}`, "error");
      }
    } else if (shouldShowCompletionSummary && originalTask) {
      const finalTask = { ...originalTask, ...normalizedUpdates };
      const pursuit = pursuits.find(p => p.id === finalTask.pursuitId);
      setCompletionSummary({
        taskTitle: finalTask.description,
        xpValue: finalTask.xpValue || XP_BY_EFFORT[finalTask.effortSize || "medium"],
        contributionType: finalTask.contributionType,
        pursuitTitle: pursuit?.title,
      });
    }
  }, [session, showToast, pursuits]);

  const deleteTask = useCallback(async (id: string) => {
    const taskToDelete = tasksRef.current.find(t => t.id === id);
    if (!taskToDelete) return;

    const confirmed = await confirm({
      title: 'Wanna Burn this?',
      message: `Are you sure you want to erase "${taskToDelete.description}" forever?`,
      confirmText: 'Burn It',
      cancelText: 'Keep It',
      type: 'danger'
    });

    if (confirmed) {
      const originalTasks = [...tasksRef.current];
      setTasks(prev => prev.filter(t => t.id !== id));
      if (session) {
        try {
          await api.deleteTask(id);
          showToast("Task erased.", "info");
        } catch (e) {
          console.error("Delete error:", e);
          setTasks(originalTasks);
          showToast("Failed to erase task.", "error");
        }
      }
    }
  }, [session, confirm, showToast]);

  const handleAIExpand = useCallback(async (task: Task) => {
    setIsClassifying(true);
    try {
      const chunks = await fetchChunks(task.description, task.skillLevel);
      if (chunks.length > 0) {
        await updateTask(task.id, { chunks });
        showToast("AI breakdown complete!", "success");
      } else {
        showToast("AI couldn't find any logical steps to add.", "info");
      }
    } catch (e: any) {
      console.error("AI breakdown error:", e);
      const message = e.message?.includes("Daily AI limit reached")
        ? "Cannot expand: Daily AI limit reached (3/3)."
        : "AI service is temporarily unavailable. Try again?";
      showToast(message, "error");
    } finally {
      setIsClassifying(false);
    }
  }, [fetchChunks, updateTask, showToast]);

  const deleteChunk = useCallback(async (taskId: string, chunkId: string) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task || !task.chunks) return;

    if (session) {
      try {
        await api.deleteChunk(chunkId);
        const newChunks = task.chunks.filter(c => c.id !== chunkId);
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, chunks: newChunks } : t));
      } catch (e) {
        console.error("Delete chunk error:", e);
        showToast("Ink ran out. Couldn't delete chunk.", "error");
      }
    }
  }, [session, showToast]);

  const updateChunk = useCallback(async (taskId: string, chunkId: string, updates: Partial<TaskChunk>) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task || !task.chunks) return;

    const newChunks = task.chunks.map(c => c.id === chunkId ? { ...c, ...updates } : c);
    await updateTask(taskId, { chunks: newChunks });
  }, [updateTask]);

  const removeInstance = useCallback(async (taskId: string, instanceId: string) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task) return;

    if (session) {
      try {
        await api.deleteInstance(instanceId);
        
        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            if (instanceId.startsWith('legacy-')) {
              return { ...t, scheduledStart: undefined, scheduledEnd: undefined };
            } else if (t.instances) {
              return { ...t, instances: t.instances.filter(i => i.id !== instanceId) };
            }
          }
          return t;
        }));
        showToast("Removed from schedule.", "info");
      } catch (e) {
        console.error("Remove instance error:", e);
        showToast("Failed to remove from schedule.", "error");
      }
    }
  }, [session, showToast]);

  const addPinnedInstance = useCallback(async (taskId: string, date: Date, hour: number) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task) return;

    const durationMin = parseInt(task.estimatedTime.replace("m", "")) || 60;
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + durationMin * 60000);

    const payload = {
      taskId,
      start: start.toISOString(),
      end: end.toISOString(),
      isPinned: true
    };

    if (session) {
      try {
        const result = await api.createInstance(payload);
        
        // Optimistically add to UI
        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            const newInst = {
              id: result.instanceId,
              start: payload.start,
              end: payload.end,
              status: 'scheduled' as any,
              isPinned: true
            };
            return { ...t, instances: [...(t.instances || []), newInst] };
          }
          return t;
        }));
        showToast("Task scheduled successfully.", "success");
      } catch (e) {
        console.error("Add instance error:", e);
        showToast("Failed to schedule task.", "error");
      }
    }
  }, [session, showToast]);

  const addChunk = useCallback(async (taskId: string, name: string, duration: number) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task) return;

    const newChunk: TaskChunk = {
      id: crypto.randomUUID(),
      chunk_name: name,
      duration,
      completed: false
    };

    const newChunks = [...(task.chunks || []), newChunk];
    await updateTask(taskId, { chunks: newChunks });
  }, [updateTask]);

  const savePursuit = useCallback(async (pursuit: Partial<Pursuit> & { title: string }) => {
    if (!session) return;
    try {
      const saved = await api.upsertPursuit(pursuit);
      setPursuits(prev => {
        const exists = prev.some(p => p.id === saved.id);
        return exists ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev];
      });
      showToast("Pursuit saved.", "success");
      return saved as Pursuit;
    } catch (e: any) {
      console.error("Pursuit save error:", e);
      showToast("Failed to save pursuit: " + (e.message || "Something went wrong."), "error");
    }
  }, [session, showToast]);

  const deletePursuit = useCallback(async (pursuitId: string) => {
    const pursuit = pursuits.find(p => p.id === pursuitId);
    const confirmed = await confirm({
      title: 'Archive this pursuit?',
      message: pursuit ? `Remove "${pursuit.title}" and unlink its tasks?` : "Remove this pursuit?",
      confirmText: 'Remove',
      cancelText: 'Keep It',
      type: 'danger'
    });

    if (!confirmed || !session) return;

    const originalPursuits = [...pursuits];
    const originalTasks = [...tasksRef.current];
    setPursuits(prev => prev.filter(p => p.id !== pursuitId));
    setTasks(prev => prev.map(t => t.pursuitId === pursuitId ? { ...t, pursuitId: undefined } : t));

    try {
      await api.deletePursuit(pursuitId);
      showToast("Pursuit removed.", "info");
    } catch (e) {
      console.error("Pursuit delete error:", e);
      setPursuits(originalPursuits);
      setTasks(originalTasks);
      showToast("Failed to remove pursuit.", "error");
    }
  }, [session, pursuits, confirm, showToast]);

  const saveJournalEntry = useCallback(async (entry: Partial<JournalEntry> & { entryType: JournalEntry["entryType"] }) => {
    if (!session) return;
    try {
      const saved = await api.upsertJournalEntry(entry);
      setJournalEntries(prev => {
        const exists = prev.some(item => item.id === saved.id);
        const next = exists ? prev.map(item => item.id === saved.id ? saved : item) : [saved, ...prev];
        return next.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
      });
      showToast(entry.entryType === "training" ? "Training log saved." : "Journal entry saved.", "success");
      return saved as JournalEntry;
    } catch (e: any) {
      console.error("Journal entry save error:", e);
      showToast("Failed to save journal entry: " + (e.message || "Something went wrong."), "error");
    }
  }, [session, showToast]);

  const deleteJournalEntry = useCallback(async (entryId: string) => {
    const entry = journalEntries.find(item => item.id === entryId);
    const confirmed = await confirm({
      title: "Delete this entry?",
      message: entry?.title ? `Remove "${entry.title}" from your journal?` : "Remove this journal entry?",
      confirmText: "Delete",
      cancelText: "Keep It",
      type: "danger",
    });

    if (!confirmed || !session) return;

    const originalEntries = [...journalEntries];
    setJournalEntries(prev => prev.filter(item => item.id !== entryId));

    try {
      await api.deleteJournalEntry(entryId);
      showToast("Journal entry deleted.", "info");
    } catch (e) {
      console.error("Journal entry delete error:", e);
      setJournalEntries(originalEntries);
      showToast("Failed to delete journal entry.", "error");
    }
  }, [session, journalEntries, confirm, showToast]);

  const resetAllData = useCallback(async () => {
    const confirmed = await confirm({
      title: "Reset everything?",
      message: "This permanently deletes all tasks, pursuits, schedules, progress logs, and journal entries. Settings stay intact.",
      confirmText: "Reset All",
      cancelText: "Cancel",
      type: "danger",
    });

    if (!confirmed || !session) return;

    const originalTasks = [...tasksRef.current];
    const originalPursuits = [...pursuits];
    const originalEntries = [...journalEntries];

    setTasks([]);
    setPursuits([]);
    setJournalEntries([]);

    try {
      await api.resetAll();
      showToast("Workspace reset.", "info");
    } catch (e: any) {
      console.error("Reset workspace error:", e);
      setTasks(originalTasks);
      setPursuits(originalPursuits);
      setJournalEntries(originalEntries);
      showToast("Failed to reset workspace: " + (e.message || "Something went wrong."), "error");
    }
  }, [session, pursuits, journalEntries, confirm, showToast]);


  const handleSaveLog = useCallback(async (taskId: string, log: TaskHistory) => {
    if (!session) return;
    try {      const { date, ...cleanLog } = log as any;
      await api.createProgressLog(taskId, cleanLog);
      
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            history: [...(t.history || []), log]
          };
        }
        return t;
      }));
    } catch (e: any) {
      console.error("Log save error:", e);
      showToast("Failed to save progress log.", "error");
    }
  }, [session, showToast]);

  const handleSmartSchedule = useCallback(async () => {
    if (!session) return;
    setIsScheduling(true);
    try {
      const now = new Date();
      const protectedPinnedCount = tasksRef.current.reduce((count, task) => {
        return count + (task.instances || []).filter((instance) => {
          return instance.isPinned && instance.status === "scheduled" && new Date(instance.start) >= now;
        }).length;
      }, 0);
      const result = await api.runSmartSchedule();
      await fetchTasks();
      const hourCounts = new Map<number, number>();
      result.schedule.forEach((slot) => {
        const hour = new Date(slot.start).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      });
      const topHours = Array.from(hourCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) =>
          new Date(2000, 0, 1, hour).toLocaleTimeString([], {
            hour: "numeric",
            hour12: true,
          }),
        );
      setSmartScheduleSummary({
        scheduledCount: result.scheduledCount,
        unschedulableCount: result.unschedulableCount,
        unschedulableTasks: result.unschedulableTasks || [],
        protectedPinnedCount,
        topHours,
      });
      if (result.scheduledCount > 0) {
        showToast(`Scheduled ${result.scheduledCount} session${result.scheduledCount > 1 ? 's' : ''}!`, "success");
      } else {
        showToast("No new sessions to schedule.", "info");
      }
      if (result.unschedulableCount > 0) {
        const names = result.unschedulableTasks?.join(', ') || `${result.unschedulableCount} task(s)`;
        showToast(`Couldn't fit: ${names}`, "info");
      }
    } catch (e) {
      console.error("Scheduling error:", e);
      showToast("The scheduler is overwhelmed. Try again?", "error");
    } finally {
      setIsScheduling(false);
    }
  }, [session, showToast, fetchTasks]);

  return {
    tasks,
    pursuits,
    journalEntries,
    journalEntriesError,
    smartScheduleSummary,
    setSmartScheduleSummary,
    completionSummary,
    setCompletionSummary,
    setTasks,
    tasksRef,
    isLoading,
    isScheduling,
    isClassifying,
    addTask,
    savePursuit,
    deletePursuit,
    saveJournalEntry,
    deleteJournalEntry,
    resetAllData,
    updateTask,
    deleteTask,
    handleSaveLog,
    handleSmartSchedule,
    handleAIExpand,
    updateChunk,
    addChunk,
    deleteChunk,
    removeInstance,
    addPinnedInstance,
    fetchTasks,
    fetchPursuits,
    fetchJournalEntries
  };
};

