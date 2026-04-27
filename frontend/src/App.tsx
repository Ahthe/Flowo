import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "./services/supabase";
import { api } from "./services/api";
import Sidebar from "./components/layout/Sidebar";
import ChunkPanel from "./components/tasks/ChunkPanel";
import CalendarView from "./views/CalendarView";
import AnalysisView from "./views/AnalysisView";
import SettingsModal from "./components/layout/SettingsModal";
import type {
  Task,
  TaskPriority,
  UserPreferences,
} from "./types";


import {
  Archive,
  Activity,
  Smile,
  Cloud,
  Sun,
  BookOpen,
  Calendar,
  ChevronRight,
  Lightbulb,
  LayoutDashboard,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";

import type { Session, User } from "@supabase/supabase-js";
import FloatingTimer from "./components/common/FloatingTimer";
import ArchiveView from "./views/ArchiveView";
import { useToast } from "./context/ToastContext";
import { useTasks } from "./hooks/useTasks";
import JournalView from "./views/JournalView";
import JournalLogsView from "./views/JournalLogsView";
import GuideView from "./views/GuideView";
import PursuitsView from "./views/PursuitsView";
import { useSound } from "./hooks/useSound";

function App() {
  const { playClick, playTabs, playPop } = useSound();
  const { showToast } = useToast();
  // AUTH BYPASS: Create a fake session so the app loads without Google OAuth
  const fakeUser: User = {
    id: '11111111-1111-1111-1111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'dev@vellum.local',
    app_metadata: {},
    user_metadata: { full_name: 'Dev User', avatar_url: '' },
    created_at: new Date().toISOString(),
  } as User;
  const fakeSession: Session = {
    access_token: 'dev-bypass-token',
    refresh_token: 'dev-bypass-refresh',
    expires_in: 999999,
    expires_at: Math.floor(Date.now() / 1000) + 999999,
    token_type: 'bearer',
    user: fakeUser,
  };
  const [session, setSession] = useState<Session | null>(fakeSession);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("vellum_dark_mode") === "true";
  });
  const [activeTab, setActiveTab] = useState<
    "journal" | "pursuits" | "calendar" | "logs" | "analysis" | "archive" | "guide"
  >("guide");

  const {
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
  } = useTasks(session);

  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    availableHours: {
      Monday: ["09:00", "17:00"],
      Tuesday: ["09:00", "17:00"],
      Wednesday: ["09:00", "17:00"],
      Thursday: ["09:00", "17:00"],
      Friday: ["09:00", "17:00"],
      Saturday: ["10:00", "14:00"],
      Sunday: ["10:00", "12:00"],
    },
    autoSchedule: false,
    soundEnabled: true,
  });
  const [moodIndex, setMoodIndex] = useState(0);
  const moods = [
    {
      icon: <Sun size={24} className="text-highlighter-yellow" />,
      label: "Radiant",
    },
    { icon: <Cloud size={24} className="text-ink-light" />, label: "Cloudy" },
    {
      icon: <Lightbulb size={24} className="text-highlighter-pink" />,
      label: "Charged",
    },
    { icon: <Smile size={24} className="text-green-500" />, label: "Content" },
  ];
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const editingTask = editingTaskId ? tasks.find(t => t.id === editingTaskId) ?? null : null;

  const taskStartTimeRef = React.useRef<number | null>(null);
  const sessionBaseTimeRef = React.useRef<number>(0);

  const runningTaskId = useMemo(
    () => tasks.find((t) => t.status === "running")?.id ?? null,
    [tasks]
  );

  const overdueCount = useMemo(
    () => tasks.filter(t => t.status === 'overdue').length,
    [tasks]
  );

  const todaySummary = useMemo(() => {
    const today = new Date().toDateString();
    const activeTasks = tasks.filter(
      (t) => t.status !== "completed" && t.status !== "archived",
    );
    const scheduledTaskIds = new Set<string>();
    const dueTaskIds = new Set<string>();

    activeTasks.forEach((task) => {
      if (task.deadline && new Date(task.deadline).toDateString() === today) {
        dueTaskIds.add(task.id);
      }

      (task.instances || []).forEach((instance) => {
        if (
          instance.status !== "completed" &&
          new Date(instance.start).toDateString() === today
        ) {
          scheduledTaskIds.add(task.id);
        }
      });
    });

    const plannedTaskIds = new Set([...dueTaskIds, ...scheduledTaskIds]);
    const plannedTasks = activeTasks.filter((task) => plannedTaskIds.has(task.id));
    const pursuitIds = new Set(
      plannedTasks.map((task) => task.pursuitId).filter(Boolean),
    );

    return {
      tasksToday: plannedTaskIds.size,
      scheduledToday: scheduledTaskIds.size,
      plannedXp: plannedTasks.reduce((sum, task) => sum + (task.xpValue || 0), 0),
      pursuitsTouched: pursuitIds.size,
    };
  }, [tasks]);

  useEffect(() => {
    if (overdueCount > 0) {
      showToast(`You have ${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}!`, "error");
    }
  }, [overdueCount === 0]); // Toast when first detected or when it change from 0 to something

  useEffect(() => {
    document.body.classList.toggle("vellum-dark-mode", isDarkMode);
    localStorage.setItem("vellum_dark_mode", String(isDarkMode));
    return () => document.body.classList.remove("vellum-dark-mode");
  }, [isDarkMode]);

  useEffect(() => {
    if (!completionSummary) return;
    const timer = window.setTimeout(() => setCompletionSummary(null), 6500);
    return () => window.clearTimeout(timer);
  }, [completionSummary, setCompletionSummary]);


  useEffect(() => {
    const interval = setInterval(() => {
      setTasks((prevTasks) => {
        const runningTask = prevTasks.find((t) => t.status === "running");
        if (!runningTask || taskStartTimeRef.current === null) return prevTasks;

        const now = Date.now();
        const sessionElapsedSeconds = Math.floor(
          (now - taskStartTimeRef.current) / 1000,
        );
        const newTotal = sessionBaseTimeRef.current + sessionElapsedSeconds;

        if (runningTask.totalTimeSeconds === newTotal) return prevTasks;

        return prevTasks.map((t) =>
          t.id === runningTask.id
            ? { ...t, totalTimeSeconds: newTotal }
            : t,
        );
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [setTasks]);

  useEffect(() => {
    const runningTask = tasksRef.current.find((t) => t.status === "running");

    if (runningTask) {
      if (activeTaskId !== runningTask.id) {
        setSessionStartTime(new Date().toISOString());
        setActiveTaskId(runningTask.id);
        taskStartTimeRef.current = Date.now();
        sessionBaseTimeRef.current = runningTask.totalTimeSeconds || 0;
      }
    } else {
      if (activeTaskId && sessionStartTime) {
        const endTime = new Date().toISOString();
        const duration = Math.max(1, Math.floor(
          (new Date(endTime).getTime() - new Date(sessionStartTime).getTime()) /
            1000,
        ));

        if (duration > 0) {
          handleSaveLog(activeTaskId, {
            date: new Date().toISOString().split("T")[0],
            startTime: sessionStartTime,
            endTime: endTime,
            durationSeconds: duration,
          });

          const taskToUpdate = tasksRef.current.find(
            (t) => t.id === activeTaskId,
          );
          if (taskToUpdate) {
            api
              .upsertTask(taskToUpdate)
              .catch((e) => console.error("Final time save error:", e));
          }
        }
      }
      setSessionStartTime(null);
      setActiveTaskId(null);
      taskStartTimeRef.current = null;
      sessionBaseTimeRef.current = 0;
    }
  }, [runningTaskId, activeTaskId, sessionStartTime, handleSaveLog, tasksRef]);

  // Periodic database sync (10s) for running tasks
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const runningTask = tasksRef.current.find((t) => t.status === "running");
      if (runningTask && session) {
        api
          .upsertTask(runningTask)
          .catch((e) => console.error("Sync error:", e));
      }
    }, 10000);
    return () => clearInterval(syncInterval);
  }, [session, tasksRef]);

  // Sync on page leave — uses fetch+keepalive to include auth headers
  useEffect(() => {
    const handleUnload = () => {
      const runningTask = tasksRef.current.find((t) => t.status === "running");
      if (runningTask && session) {
        const apiUrl = import.meta.env.VITE_API_URL;
        fetch(`${apiUrl}/tasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(runningTask),
          keepalive: true,
        });
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [session, tasksRef]);

  const [isLoadingSession] = useState(false);

  // AUTH BYPASS: Skip Supabase auth listener, just init preferences
  useEffect(() => {
    initPreferences();
  }, []);

  const initPreferences = async () => {
    try {
      const dbPrefs = await api.getPreferences();
      if (dbPrefs) {
        setPreferences(dbPrefs);
        localStorage.setItem('vellum_sound_enabled', String(dbPrefs.soundEnabled ?? true));
      }
    } catch (e) {
      console.error("Error loading preferences:", e);
    }
  };



  const handlePreferenceChange = async (newPrefs: UserPreferences) => {
    if (!session) return;
    setPreferences(newPrefs);
    localStorage.setItem('vellum_sound_enabled', String(newPrefs.soundEnabled));
    try {
      await api.updatePreferences(newPrefs);
    } catch (e) {
      console.error("Error updating preferences:", e);
    }
  };

  const handleUpdateProfile = async (name: string, avatarUrl: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name, avatar_url: avatarUrl },
      });
      if (error) throw error;

      const {
        data: { session: newSession },
      } = await supabase.auth.refreshSession();
      setSession(newSession);
      showToast("Identity updated successfully.", "success");
    } catch (e: any) {
      console.error("Error updating profile:", e);
      showToast("Failed to update profile: " + e.message, "error");
    }
  };

  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-paper-bg flex items-center justify-center">
        <div className="font-marker text-4xl animate-pulse">Opening your sketchbook...</div>
      </div>
    );
  }

  // AUTH BYPASS: Skip login check
  // if (!session) return <Login />;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-transparent text-ink selection:bg-highlighter-yellow/30 font-type overflow-x-hidden">
      <Sidebar
        user={{
          name: (session.user.user_metadata?.full_name as string) || "Human",
          email: session.user.email || "",
          avatar: (session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture) as string,
        }}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onLogout={() => supabase.auth.signOut()}
        onSettings={() => setIsSettingsOpen(true)}
        overdueCount={overdueCount}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={{
          name: (session.user.user_metadata?.full_name as string) || "Human",
          email: session.user.email || "",
          avatar: (session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture) as string,
        }}
        onUpdateProfile={handleUpdateProfile}
        preferences={preferences}
        onUpdatePreferences={handlePreferenceChange}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((enabled) => !enabled)}
        onResetEverything={resetAllData}
      />

      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? "lg:ml-72" : "ml-0"}`}
      >
        <nav className="flex flex-col md:flex-row items-center justify-between px-4 md:px-12 py-6 border-b-2 border-ink border-dashed bg-white/30 gap-6">
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
            <button
              onClick={() => { playTabs(); setActiveTab("journal"); }}
              className={`flex items-center gap-2 font-hand text-xl md:text-2xl transition-all ${activeTab === "journal" ? "text-ink scale-110 underline decoration-wavy decoration-highlighter-yellow underline-offset-4" : "opacity-50 hover:opacity-100"}`}
            >
              <LayoutDashboard size={20} /> Canvas
            </button>
            <button
              onClick={() => { playTabs(); setActiveTab("pursuits"); }}
              className={`flex items-center gap-2 font-hand text-xl md:text-2xl transition-all ${activeTab === "pursuits" ? "text-ink scale-110 underline decoration-wavy decoration-highlighter-yellow underline-offset-4" : "opacity-50 hover:opacity-100"}`}
            >
              <Target size={20} /> Pursuits
            </button>
            <button
              onClick={() => { playTabs(); setActiveTab("calendar"); }}
              className={`flex items-center gap-2 font-hand text-xl md:text-2xl transition-all ${activeTab === "calendar" ? "text-ink scale-110 underline decoration-wavy decoration-highlighter-yellow underline-offset-4" : "opacity-50 hover:opacity-100"}`}
            >
              <Calendar size={20} /> Timeline
            </button>
            <button
              onClick={() => { playTabs(); setActiveTab("logs"); }}
              className={`flex items-center gap-2 font-hand text-xl md:text-2xl transition-all ${activeTab === "logs" ? "text-ink scale-110 underline decoration-wavy decoration-highlighter-yellow underline-offset-4" : "opacity-50 hover:opacity-100"}`}
            >
              <BookOpen size={20} /> Journal
            </button>
            <button
              onClick={() => { playTabs(); setActiveTab("analysis"); }}
              className={`flex items-center gap-2 font-hand text-xl md:text-2xl transition-all ${activeTab === "analysis" ? "text-ink scale-110 underline decoration-wavy decoration-highlighter-yellow underline-offset-4" : "opacity-50 hover:opacity-100"}`}
            >
              <Activity size={20} /> Insights
            </button>
            <button
              onClick={() => { playTabs(); setActiveTab("archive"); }}
              className={`flex items-center gap-2 font-hand text-xl md:text-2xl transition-all ${activeTab === "archive" ? "text-ink scale-110 underline decoration-wavy decoration-highlighter-yellow underline-offset-4" : "opacity-50 hover:opacity-100"}`}
            >
              <Archive size={20} /> Vault
            </button>
            <button
              onClick={() => { playTabs(); setActiveTab("guide"); }}
              className={`flex items-center gap-2 font-hand text-xl md:text-2xl transition-all ${activeTab === "guide" ? "text-ink scale-110 underline decoration-wavy decoration-highlighter-yellow underline-offset-4" : "opacity-50 hover:opacity-100"}`}
            >
              <Sparkles size={20} /> Guide
            </button>
          </div>
          <button
            onClick={() => { playClick(); handleSmartSchedule(); }}
            disabled={isScheduling}
            className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2 sketch-border bg-ink text-white font-marker text-xl hover:bg-highlighter-yellow hover:text-ink transition-all ${isScheduling ? "animate-pulse" : ""}`}
          >
            <Lightbulb size={18} />{" "}
            {isScheduling ? "Thinking..." : "Smart Schedule"}
          </button>
        </nav>

        <main className="flex-1 overflow-y-auto p-2 md:p-4 lg:p-6 relative scroll-smooth bg-transparent">
          <div className="max-w-[1550px] mx-auto">
            {smartScheduleSummary && (
              <div className="mb-6 sketch-border bg-white p-4 md:p-5 shadow-lg border-dashed">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <h3 className="marker-text text-2xl flex items-center gap-2">
                      <Lightbulb className="text-highlighter-yellow" size={20} />
                      Schedule Result
                    </h3>
                    <p className="font-hand text-sm opacity-60 mt-1">
                      Smart sessions were rebuilt. Manual timeline blocks stayed protected.
                    </p>
                  </div>
                  <button
                    onClick={() => setSmartScheduleSummary(null)}
                    className="font-hand text-lg opacity-50 hover:opacity-100 hover:underline self-start"
                  >
                    dismiss
                  </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                  <div className="bg-highlighter-blue/10 sketch-border border-dashed px-3 py-2">
                    <span className="font-sketch text-[10px] uppercase opacity-40">Scheduled</span>
                    <div className="marker-text text-2xl">{smartScheduleSummary.scheduledCount}</div>
                  </div>
                  <div className="bg-highlighter-pink/10 sketch-border border-dashed px-3 py-2">
                    <span className="font-sketch text-[10px] uppercase opacity-40">Protected</span>
                    <div className="marker-text text-2xl">{smartScheduleSummary.protectedPinnedCount}</div>
                  </div>
                  <div className="bg-highlighter-yellow/10 sketch-border border-dashed px-3 py-2">
                    <span className="font-sketch text-[10px] uppercase opacity-40">Couldn’t Fit</span>
                    <div className="marker-text text-2xl">{smartScheduleSummary.unschedulableCount}</div>
                  </div>
                  <div className="bg-highlighter-green/10 sketch-border border-dashed px-3 py-2">
                    <span className="font-sketch text-[10px] uppercase opacity-40">Top Hours</span>
                    <div className="font-hand text-xl truncate">
                      {smartScheduleSummary.topHours.length > 0
                        ? smartScheduleSummary.topHours.join(", ")
                        : "No new slots"}
                    </div>
                  </div>
                </div>
                {smartScheduleSummary.unschedulableTasks.length > 0 && (
                  <p className="font-hand text-sm mt-4 opacity-70">
                    Couldn’t fit: {smartScheduleSummary.unschedulableTasks.join(", ")}
                  </p>
                )}
              </div>
            )}
            {activeTab === "journal" && (
              <>
                <header className="mb-12">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
                    <div className="w-full md:w-auto text-center md:text-left">
                      <h2 className="marker-text text-4xl md:text-5xl inline-block px-6 py-2 bg-highlighter-yellow -rotate-1">
                        Today's Canvas
                      </h2>
                      <p className="font-sketch text-lg md:text-xl text-ink-light mt-4 max-w-sm mx-auto md:ml-0">
                        Today’s tasks and focused work.
                      </p>
                    </div>
                    <div className="flex flex-col items-center md:items-end gap-4 w-full md:w-auto">
                      <div className="tape-effect bg-white sketch-border px-4 py-2 rotate-1 text-right flex flex-col items-end">
                        <span className="font-hand text-lg">Current Vibe</span>
                        <button
                          onClick={() => {
                            playClick();
                            setMoodIndex((prev) => (prev + 1) % moods.length);
                          }}
                          className="flex items-center gap-2 mt-1 hover:scale-110 transition-transform"
                        >
                          {moods[moodIndex].icon}
                          <span className="font-marker text-xl">
                            {moods[moodIndex].label}
                          </span>
                        </button>
                      </div>
                      <div className="sketch-border bg-white px-4 py-1 -rotate-2">
                        <span className="font-hand font-bold text-xl uppercase tracking-widest">
                          {new Date().toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                    <div className="sketch-border bg-white px-4 py-3">
                      <span className="font-sketch text-[10px] uppercase opacity-40">Today</span>
                      <div className="marker-text text-2xl md:text-3xl">{todaySummary.tasksToday}</div>
                      <p className="font-hand text-xs opacity-50">due or scheduled</p>
                    </div>
                    <div className="sketch-border bg-white px-4 py-3 -rotate-1">
                      <span className="font-sketch text-[10px] uppercase opacity-40">Timeline</span>
                      <div className="marker-text text-2xl md:text-3xl">{todaySummary.scheduledToday}</div>
                      <p className="font-hand text-xs opacity-50">sessions placed</p>
                    </div>
                    <div className="sketch-border bg-white px-4 py-3 rotate-1">
                      <span className="font-sketch text-[10px] uppercase opacity-40">Planned XP</span>
                      <div className="marker-text text-2xl md:text-3xl">{todaySummary.plannedXp}</div>
                      <p className="font-hand text-xs opacity-50">from today’s work</p>
                    </div>
                    <div className="sketch-border bg-white px-4 py-3">
                      <span className="font-sketch text-[10px] uppercase opacity-40">Pursuits</span>
                      <div className="marker-text text-2xl md:text-3xl">{todaySummary.pursuitsTouched}</div>
                      <p className="font-hand text-xs opacity-50">touched today</p>
                    </div>
                  </div>
                </header>
                  <JournalView
                  tasks={tasks}
                  pursuits={pursuits}
                  onAddTask={async (deck) => {
                    const newTask = await addTask(deck);
                    if (newTask && newTask.chunks && newTask.chunks.length > 0) {
                      setSelectedTask(newTask);
                    }
                    return newTask;
                  }}
                  onUpdateTask={updateTask}
                  onDeleteTask={deleteTask}
                  onSelectTask={setSelectedTask}
                  onEditTask={(task: Task) => setEditingTaskId(task.id)}
                  isClassifying={isClassifying}
                  onTabChange={setActiveTab}
                />
              </>
            )}

            {activeTab === "pursuits" && (
              <PursuitsView
                pursuits={pursuits}
                tasks={tasks}
                onSavePursuit={savePursuit}
                onDeletePursuit={deletePursuit}
                onTabChange={setActiveTab}
              />
            )}

            {activeTab === "calendar" && (
              <CalendarView
                tasks={tasks}
                preferences={preferences}
                onUpdatePreferences={handlePreferenceChange}
                onAddTaskAtTime={(date: Date, hour: number) => {
                  console.log("Add task at", date, hour);
                  // This could be improved to open Journal with pre-filled date
                  setActiveTab("journal");
                }}
                onTaskClick={(task: Task) => setEditingTaskId(task.id)}
                onScheduleTask={addPinnedInstance}
                onRemoveInstance={removeInstance}
                onTabChange={setActiveTab}
              />
            )}

            {activeTab === "logs" && (
              <JournalLogsView
                entries={journalEntries}
                error={journalEntriesError}
                pursuits={pursuits}
                onSaveEntry={saveJournalEntry}
                onDeleteEntry={deleteJournalEntry}
              />
            )}

            {activeTab === "analysis" && <AnalysisView tasks={tasks} journalEntries={journalEntries} />}
            {activeTab === "archive" && (
              <ArchiveView
                tasks={tasks}
                onDelete={deleteTask}
                onUpdate={updateTask}
              />
            )}
            {activeTab === "guide" && <GuideView />}
          </div>
        </main>
      </div>

      <FloatingTimer
        task={tasks.find((t) => t.status === "running") || null}
        onUpdate={updateTask}
      />

      {completionSummary && (
        <div className="fixed bottom-5 right-5 left-5 md:left-auto md:w-[360px] z-[95]">
          <div className="sketch-border bg-white p-4 shadow-2xl border-highlighter-pink animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 sketch-border bg-highlighter-pink/40 flex items-center justify-center shrink-0">
                  <Trophy size={22} className="text-highlighter-pink" />
                </div>
                <div className="min-w-0">
                  <div className="font-sketch text-[10px] uppercase tracking-widest opacity-50">
                    XP Logged
                  </div>
                  <div className="marker-text text-2xl leading-none mt-1">
                    +{completionSummary.xpValue}{" "}
                    {completionSummary.contributionType
                      ? `${completionSummary.contributionType} XP`
                      : "XP"}
                  </div>
                  <p className="font-hand text-base opacity-70 truncate mt-1">
                    {completionSummary.pursuitTitle
                      ? `Added to ${completionSummary.pursuitTitle}`
                      : "Task completed"}
                  </p>
                  <p className="font-sketch text-xs opacity-40 truncate">
                    {completionSummary.taskTitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCompletionSummary(null)}
                className="p-1 opacity-40 hover:opacity-100 hover:text-highlighter-pink transition-colors"
                aria-label="Dismiss XP summary"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-ink/70 backdrop-blur-md">
          <div className="max-w-2xl w-full max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="sketch-border p-6 md:p-8 bg-white transform -rotate-1 relative shadow-2xl m-4">
              <button
                onClick={() => { playPop(); setEditingTaskId(null); }}
                className="absolute -top-2 -right-4 bg-ink text-white p-2 sketch-border hover:bg-highlighter-pink hover:text-ink transition-all"
              >
                <ChevronRight className="rotate-180" size={24} />
              </button>

              <h3 className="marker-text text-4xl mb-8 flex items-center gap-4">
                <Lightbulb className="text-highlighter-yellow" />
                Refine Task
              </h3>

              <div className="space-y-6">
                {/* Description */}
                <div className="flex flex-col">
                  <label className="font-sketch text-xs uppercase opacity-40 ml-1">
                    The Goal
                  </label>
                  <input
                    value={editingTask.description}
                    onChange={(e) =>
                      updateTask(editingTask.id, {
                        description: e.target.value,
                      })
                    }
                    className="w-full text-3xl font-hand p-2 border-b-2 border-ink focus:outline-none focus:border-highlighter-pink bg-transparent"
                  />
                </div>

                {/* Deadline + Estimated Time */}
                <div className="grid grid-cols-2 gap-8">
                  <div className="flex flex-col">
                    <label className="font-sketch text-xs uppercase opacity-40 ml-1">
                      Due By
                    </label>
                    <input
                      type="datetime-local"
                      value={editingTask.deadline ? new Date(editingTask.deadline)
                        .toISOString()
                        .slice(0, 16) : ''}
                      onChange={(e) => {
                        const selectedDate = new Date(e.target.value);
                        const now = new Date();
                        if (selectedDate <= now) {
                          showToast("Deadline must be in the future!", "error");
                          return;
                        }
                        updateTask(editingTask.id, { deadline: e.target.value });
                      }}
                      className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="font-sketch text-xs uppercase opacity-40 ml-1">
                      Estimated Time (mins)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={parseInt(editingTask.estimatedTime) || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val < 1 || isNaN(val)) {
                          showToast("Duration must be at least 1 minute.", "error");
                          return;
                        }
                        updateTask(editingTask.id, {
                          estimatedTime: `${e.target.value}m`,
                        });
                      }}
                      className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Skill Level */}
                <div className="flex flex-col">
                  <label className="font-sketch text-xs uppercase opacity-40 ml-1">
                    Current Mastery
                  </label>
                  <select
                    value={editingTask.skillLevel}
                    onChange={(e) => {
                      playClick();
                      updateTask(editingTask.id, { skillLevel: e.target.value });
                    }}
                    className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent appearance-none cursor-pointer"
                  >
                    <option value="total_novice">Total Novice</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="master">Master</option>
                  </select>
                </div>

                {/* Priority */}
                <div className="flex flex-col">
                  <label className="font-sketch text-xs uppercase opacity-40 ml-1 mb-2">
                    Priority
                  </label>
                  <div className="flex gap-4">
                    {(["low", "medium", "high"] as TaskPriority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          playClick();
                          updateTask(editingTask.id, { priority: p });
                        }}
                        className={`px-4 py-1 sketch-border font-hand text-lg capitalize transition-all ${editingTask.priority === p ? "bg-highlighter-yellow scale-110 shadow-lg" : "bg-white opacity-40"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scheduling Params */}
                <div className="pt-4 border-t border-ink/10 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col">
                    <label className="font-sketch text-xs uppercase opacity-40 ml-1">
                      Pursuit
                    </label>
                    <select
                      value={editingTask.pursuitId || ""}
                      onChange={(e) => {
                        playClick();
                        updateTask(editingTask.id, { pursuitId: e.target.value || undefined });
                      }}
                      className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent appearance-none cursor-pointer"
                    >
                      <option value="">No pursuit</option>
                      {pursuits.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="font-sketch text-xs uppercase opacity-40 ml-1">
                      Contribution
                    </label>
                    <select
                      value={editingTask.contributionType || "practice"}
                      onChange={(e) => {
                        playClick();
                        updateTask(editingTask.id, { contributionType: e.target.value as any });
                      }}
                      className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent appearance-none cursor-pointer"
                    >
                      <option value="practice">Practice</option>
                      <option value="build">Build</option>
                      <option value="health">Health</option>
                      <option value="pipeline">Pipeline</option>
                      <option value="review">Review</option>
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="font-sketch text-xs uppercase opacity-40 ml-1">
                      Effort
                    </label>
                    <select
                      value={editingTask.effortSize || "medium"}
                      onChange={(e) => {
                        playClick();
                        updateTask(editingTask.id, { effortSize: e.target.value as any });
                      }}
                      className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent appearance-none cursor-pointer"
                    >
                      <option value="tiny">Tiny - 5 XP</option>
                      <option value="small">Small - 10 XP</option>
                      <option value="medium">Medium - 25 XP</option>
                      <option value="deep">Deep - 50 XP</option>
                      <option value="major">Major - 100 XP</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-ink/10 grid grid-cols-2 gap-8">
                  <div className="flex flex-col">
                    <label className="font-sketch text-xs uppercase opacity-40 ml-1">
                      Daily Repeats ({editingTask.targetSessionsPerDay || 1}x)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={editingTask.targetSessionsPerDay || 1}
                      onChange={(e) => {
                        playClick();
                        updateTask(editingTask.id, {
                          targetSessionsPerDay: parseInt(e.target.value),
                        });
                      }}
                      className="accent-ink cursor-pointer mt-2"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="font-sketch text-xs uppercase opacity-40 ml-1">
                      Min Spacing ({editingTask.minSpacingMinutes || 60}m)
                    </label>
                    <input
                      type="range"
                      min="15"
                      max="480"
                      step="15"
                      value={editingTask.minSpacingMinutes || 60}
                      onChange={(e) => {
                        playClick();
                        updateTask(editingTask.id, {
                          minSpacingMinutes: parseInt(e.target.value),
                        });
                      }}
                      className="accent-ink cursor-pointer mt-2"
                    />
                  </div>
                </div>

                {/* Predicted Satisfaction */}
                <div className="pt-4 border-t border-ink/10">
                  <label className="font-sketch text-xs uppercase opacity-40 ml-1 block mb-2">
                    Predicted Satisfaction ({editingTask.predictedSatisfaction ?? 50}%)
                  </label>
                  <div className="flex items-center gap-4">
                    <span className="font-hand text-sm opacity-50">Meh</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={editingTask.predictedSatisfaction ?? 50}
                      onChange={(e) => {
                        playClick();
                        updateTask(editingTask.id, {
                          predictedSatisfaction: parseInt(e.target.value),
                        });
                      }}
                      className="w-full accent-highlighter-pink cursor-pointer"
                    />
                    <span className="font-hand text-sm opacity-50">Joy!</span>
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex justify-between items-center pt-6 border-t border-ink/10">
                  <button
                    onClick={() => {
                      playClick();
                      deleteTask(editingTask.id);
                      setEditingTaskId(null);
                    }}
                    className="text-red-500 font-hand text-lg hover:underline underline-offset-4 opacity-60 hover:opacity-100"
                  >
                    Delete Task
                  </button>
                  <button
                    onClick={() => { playClick(); setEditingTaskId(null); }}
                    className="px-6 py-2 md:px-10 md:py-3 sketch-border bg-ink text-white font-marker text-xl md:text-2xl hover:bg-highlighter-yellow hover:text-ink transition-all shadow-[4px_4px_0_rgba(0,0,0,0.5)]"
                  >
                    Save  
                  </button>
                </div>

                {(editingTask.scheduledStart || editingTask.scheduledEnd) && (
                  <div className="pt-4 border-t-2 border-dashed border-ink/10 flex justify-end">
                    <button
                      onClick={() => {
                        playClick();
                        updateTask(editingTask.id, {
                          scheduledStart: undefined,
                          scheduledEnd: undefined,
                        });
                        setEditingTaskId(null);
                        showToast("Task removed from the timeline.", "success");
                      }}
                      className="text-red-500 font-hand text-lg hover:underline underline-offset-4 opacity-60 hover:opacity-100 flex items-center gap-2"
                    >
                      Remove from Schedule
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ChunkPanel
        task={tasks.find((t) => t.id === selectedTask?.id) || null}
        onClose={() => setSelectedTask(null)}
        onUpdateChunk={updateChunk}
        onAddChunk={addChunk}
        onDeleteChunk={deleteChunk}
        onAIExpand={handleAIExpand}
        isClassifying={isClassifying}
      />
    </div>
  );
}

export default App;
