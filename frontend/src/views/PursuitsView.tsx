import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Calendar, Clock, Edit2, Flame, Plus, Target, Trash2, Trophy, Flag, X } from "lucide-react";
import type { Pursuit, Task } from "../types";

interface PursuitsViewProps {
  pursuits: Pursuit[];
  tasks: Task[];
  onSavePursuit: (pursuit: Partial<Pursuit> & { title: string }) => Promise<Pursuit | undefined>;
  onDeletePursuit: (id: string) => void;
  onTabChange?: (tab: any) => void;
}

const colorClasses: Record<Pursuit["color"], string> = {
  yellow: "bg-highlighter-yellow/50",
  pink: "bg-highlighter-pink/50",
  blue: "bg-highlighter-blue/50",
  green: "bg-highlighter-green/50",
  orange: "bg-highlighter-orange/50",
};

const categoryDefaults: Record<string, { color: Pursuit["color"]; contribution: string }> = {
  startup: { color: "blue", contribution: "Build" },
  health: { color: "green", contribution: "Health" },
  interview: { color: "pink", contribution: "Practice" },
  career: { color: "yellow", contribution: "Pipeline" },
  personal: { color: "orange", contribution: "Review" },
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

const emptyDraft = {
  title: "",
  why: "",
  target: "",
  weeklyFocus: "",
  weeklyTargetXp: "150",
  category: "personal",
  deadline: "",
  color: "orange" as Pursuit["color"],
};

const getWeekStart = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};

const getWeekEnd = (date: Date) => {
  const end = getWeekStart(date);
  end.setDate(end.getDate() + 7);
  return end;
};

const formatTimeLeft = (now: Date, end: Date) => {
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return "resets now";

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};

const PursuitsView: React.FC<PursuitsViewProps> = ({
  pursuits,
  tasks,
  onSavePursuit,
  onDeletePursuit,
  onTabChange,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingPursuitId, setEditingPursuitId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState(emptyDraft);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const completedByPursuit = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      if (!task.pursuitId || task.status !== "completed") return;
      const list = map.get(task.pursuitId) || [];
      list.push(task);
      map.set(task.pursuitId, list);
    });
    return map;
  }, [tasks]);

  const activeByPursuit = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      if (!task.pursuitId || task.status === "completed" || task.status === "archived") return;
      const list = map.get(task.pursuitId) || [];
      list.push(task);
      map.set(task.pursuitId, list);
    });
    return map;
  }, [tasks]);

  const heatDays = useMemo(() => {
    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (34 - index));
      return date;
    });
  }, []);

  const handleCategoryChange = (category: string) => {
    const preset = categoryDefaults[category] || categoryDefaults.personal;
    setDraft({ ...draft, category, color: preset.color });
  };

  const resetForm = () => {
    setDraft(emptyDraft);
    setEditingPursuitId(null);
    setShowForm(false);
  };

  const openNewForm = () => {
    if (showForm && !editingPursuitId) {
      resetForm();
      return;
    }
    setDraft(emptyDraft);
    setEditingPursuitId(null);
    setShowForm(true);
  };

  const openEditForm = (pursuit: Pursuit, weeklyOnly = false) => {
    setDraft({
      title: pursuit.title,
      why: pursuit.why || "",
      target: pursuit.target || "",
      weeklyFocus: pursuit.weeklyFocus || "",
      weeklyTargetXp: String(pursuit.weeklyTargetXp || 150),
      category: pursuit.category,
      deadline: pursuit.deadline ? pursuit.deadline.slice(0, 10) : "",
      color: pursuit.color,
    });
    setEditingPursuitId(pursuit.id);
    setShowForm(true);
    if (weeklyOnly) {
      window.setTimeout(() => {
        document.getElementById("weekly-focus-input")?.focus();
      }, 0);
    }
  };

  const updatePursuitStatus = async (pursuit: Pursuit, status: Pursuit["status"]) => {
    await onSavePursuit({
      id: pursuit.id,
      title: pursuit.title,
      why: pursuit.why || "",
      target: pursuit.target || "",
      weeklyFocus: pursuit.weeklyFocus || "",
      weeklyTargetXp: pursuit.weeklyTargetXp || 150,
      category: pursuit.category,
      deadline: pursuit.deadline,
      color: pursuit.color,
      status,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;

    const existing = pursuits.find((p) => p.id === editingPursuitId);

    const saved = await onSavePursuit({
      id: editingPursuitId || undefined,
      title: draft.title.trim(),
      why: draft.why.trim(),
      target: draft.target.trim(),
      weeklyFocus: draft.weeklyFocus.trim(),
      weeklyTargetXp: parseInt(draft.weeklyTargetXp) || 0,
      category: draft.category,
      deadline: draft.deadline ? new Date(draft.deadline).toISOString() : undefined,
      color: draft.color,
      status: existing?.status || "active",
    });

    if (saved) {
      resetForm();
    }
  };

  const totalXp = tasks
    .filter((task) => task.status === "completed" && task.pursuitId)
    .reduce((sum, task) => sum + (task.xpValue || 0), 0);
  const weekStart = useMemo(() => getWeekStart(now), [now]);
  const weekEnd = useMemo(() => getWeekEnd(now), [now]);
  const weekLeft = formatTimeLeft(now, weekEnd);

  return (
    <div className="space-y-10 pb-24">
      <header className="flex flex-col lg:flex-row justify-between gap-6 lg:items-end">
        <div>
          <h2 className="marker-text text-4xl md:text-5xl inline-block px-6 py-2 bg-highlighter-blue -rotate-1">
            Pursuits
          </h2>
          <p className="font-sketch text-lg md:text-xl text-ink-light mt-4 max-w-2xl">
            Long-term goals and weekly progress.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
          <div className="sketch-border bg-white px-4 py-3 text-center">
            <span className="font-sketch text-[10px] uppercase opacity-40">Active</span>
            <div className="marker-text text-2xl">{pursuits.filter((p) => p.status === "active").length}</div>
          </div>
          <div className="sketch-border bg-white px-4 py-3 text-center">
            <span className="font-sketch text-[10px] uppercase opacity-40">XP</span>
            <div className="marker-text text-2xl">{totalXp}</div>
          </div>
          <button
            onClick={openNewForm}
            className="sketch-border bg-ink text-white px-4 py-3 flex items-center justify-center gap-2 hover:bg-highlighter-yellow hover:text-ink transition-all"
          >
            <Plus size={18} />
            <span className="font-marker text-lg">New</span>
          </button>
        </div>
      </header>

      {showForm && (
        <form onSubmit={handleSubmit} className="sketch-border bg-white p-5 md:p-8 shadow-xl space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="marker-text text-2xl md:text-3xl">
                {editingPursuitId ? "Edit Pursuit" : "New Pursuit"}
              </h3>
              <p className="font-hand text-sm opacity-60 mt-1">
                Weekly focus resets every Monday at 12:00 AM. Editing keeps the same pursuit history.
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="p-2 opacity-40 hover:opacity-100 hover:text-highlighter-pink transition-colors"
              aria-label="Close pursuit form"
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col md:col-span-2">
              <label className="font-sketch text-xs uppercase opacity-40 ml-1">Pursuit Name</label>
              <input
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Build AI voice agent for dental clinics"
                className="w-full text-2xl md:text-3xl font-hand p-2 border-b-2 border-ink focus:outline-none focus:border-highlighter-blue bg-transparent"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-sketch text-xs uppercase opacity-40 ml-1">Why</label>
              <textarea
                value={draft.why}
                onChange={(e) => setDraft({ ...draft, why: e.target.value })}
                placeholder="The reason this matters."
                rows={3}
                className="font-hand text-lg p-2 border-2 border-dashed border-ink/30 focus:outline-none focus:border-ink bg-transparent resize-none"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-sketch text-xs uppercase opacity-40 ml-1">Target</label>
              <textarea
                value={draft.target}
                onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                placeholder="What proof would mean this is working?"
                rows={3}
                className="font-hand text-lg p-2 border-2 border-dashed border-ink/30 focus:outline-none focus:border-ink bg-transparent resize-none"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-sketch text-xs uppercase opacity-40 ml-1">This Week</label>
              <textarea
                id="weekly-focus-input"
                value={draft.weeklyFocus}
                onChange={(e) => setDraft({ ...draft, weeklyFocus: e.target.value })}
                placeholder="Example: hit protein daily + lift 4 times"
                rows={3}
                className="font-hand text-lg p-2 border-2 border-dashed border-ink/30 focus:outline-none focus:border-ink bg-transparent resize-none"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-sketch text-xs uppercase opacity-40 ml-1">Weekly XP Target</label>
              <input
                type="number"
                min="0"
                value={draft.weeklyTargetXp}
                onChange={(e) => setDraft({ ...draft, weeklyTargetXp: e.target.value })}
                className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-sketch text-xs uppercase opacity-40 ml-1">Category</label>
              <select
                value={draft.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent appearance-none cursor-pointer"
              >
                <option value="startup">Startup</option>
                <option value="health">Health</option>
                <option value="interview">Interview Prep</option>
                <option value="career">Career Pipeline</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="font-sketch text-xs uppercase opacity-40 ml-1">Deadline</label>
              <input
                type="date"
                value={draft.deadline}
                onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
                className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={resetForm}
              className="font-hand text-xl opacity-60 hover:opacity-100 hover:underline"
            >
              nevermind
            </button>
            <button
              type="submit"
              className="px-6 py-2 sketch-border bg-ink text-white font-marker text-xl hover:bg-highlighter-blue hover:text-ink transition-all"
            >
              {editingPursuitId ? "Save Changes" : "Save Pursuit"}
            </button>
          </div>
        </form>
      )}

      {pursuits.length === 0 ? (
        <div className="min-h-[45vh] flex flex-col items-center justify-center text-center opacity-60">
          <Target size={56} className="mb-5 text-highlighter-blue" />
          <div className="font-marker text-5xl mb-4 -rotate-2">no pursuits yet</div>
          <p className="font-hand text-2xl max-w-xl">
            Create one big outcome, then link Canvas tasks to it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {pursuits.map((pursuit, index) => {
            const completed = completedByPursuit.get(pursuit.id) || [];
            const active = activeByPursuit.get(pursuit.id) || [];
            const xp = completed.reduce((sum, task) => sum + (task.xpValue || 0), 0);
            const contribution = categoryDefaults[pursuit.category]?.contribution || "Review";
            const dailyXp = new Map<string, number>();

            completed.forEach((task) => {
              const when = task.completedAt || task.history?.[task.history.length - 1]?.endTime;
              if (!when) return;
              const key = dayKey(new Date(when));
              dailyXp.set(key, (dailyXp.get(key) || 0) + (task.xpValue || 0));
            });
            const weeklyXp = completed.reduce((sum, task) => {
              const when = task.completedAt || task.history?.[task.history.length - 1]?.endTime;
              if (!when || new Date(when) < weekStart) return sum;
              return sum + (task.xpValue || 0);
            }, 0);
            const weeklyTarget = pursuit.weeklyTargetXp || 150;
            const weeklyPercent = weeklyTarget > 0 ? Math.min(100, Math.round((weeklyXp / weeklyTarget) * 100)) : 0;
            const lastCompletedAt = completed.reduce<Date | null>((latest, task) => {
              const when = task.completedAt || task.history?.[task.history.length - 1]?.endTime;
              if (!when) return latest;
              const date = new Date(when);
              return !latest || date > latest ? date : latest;
            }, null);
            const ageStart = lastCompletedAt || (pursuit.createdAt ? new Date(pursuit.createdAt) : new Date());
            const daysSinceActivity = Math.floor((now.getTime() - ageStart.getTime()) / 86400000);
            const isInactive = daysSinceActivity >= 2 && pursuit.status === "active";

            return (
              <article
                key={pursuit.id}
                className={`sketch-border bg-white p-5 md:p-6 shadow-xl relative overflow-hidden ${
                  index % 2 === 0 ? "rotate-1" : "-rotate-1"
                } hover:rotate-0 transition-transform`}
              >
                <div className={`absolute top-0 left-0 right-0 h-3 ${colorClasses[pursuit.color] || colorClasses.yellow}`} />
                <div className="flex justify-between gap-4 items-start pt-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-sketch text-[10px] uppercase opacity-40 tracking-widest">
                        {pursuit.category}
                      </span>
                      <span className="font-mono text-[10px] bg-ink text-white px-1.5 py-0.5">
                        {contribution} XP
                      </span>
                    </div>
                    <h3 className="marker-text text-2xl md:text-3xl leading-tight wrap-break-word">
                      {pursuit.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditForm(pursuit)}
                      className="p-2 opacity-40 hover:opacity-100 hover:text-highlighter-blue transition-all"
                      title="Edit pursuit"
                    >
                      <Edit2 size={17} />
                    </button>
                    <button
                      onClick={() => onDeletePursuit(pursuit.id)}
                      className="p-2 opacity-30 hover:opacity-100 hover:text-highlighter-pink transition-all"
                      title="Remove pursuit"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-5">
                  <div className="border-b-2 border-dashed border-ink/10 pb-2">
                    <span className="font-sketch text-[10px] uppercase opacity-40 flex items-center gap-1">
                      <Trophy size={11} /> XP
                    </span>
                    <div className="marker-text text-2xl">{xp}</div>
                  </div>
                  <div className="border-b-2 border-dashed border-ink/10 pb-2">
                    <span className="font-sketch text-[10px] uppercase opacity-40 flex items-center gap-1">
                      <Activity size={11} /> Active
                    </span>
                    <div className="marker-text text-2xl">{active.length}</div>
                  </div>
                  <div className="border-b-2 border-dashed border-ink/10 pb-2">
                    <span className="font-sketch text-[10px] uppercase opacity-40 flex items-center gap-1">
                      <Calendar size={11} /> Due
                    </span>
                    <div className="font-hand text-lg truncate">
                      {pursuit.deadline
                        ? new Date(pursuit.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "Open"}
                    </div>
                  </div>
                </div>

                {isInactive && (
                  <div className="mt-4 sketch-border border-dashed bg-highlighter-pink/10 p-3 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-highlighter-pink shrink-0 mt-1" />
                    <div>
                      <div className="font-marker text-sm">Needs attention</div>
                      <p className="font-hand text-sm opacity-70">
                        No completed work in {daysSinceActivity} days. I kept it here instead of auto-deleting it.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => onTabChange?.("journal")}
                          className="font-hand text-sm underline hover:text-highlighter-pink"
                        >
                          add task
                        </button>
                        <button
                          onClick={() => openEditForm(pursuit, true)}
                          className="font-hand text-sm underline hover:text-highlighter-pink"
                        >
                          edit week
                        </button>
                        <button
                          onClick={() => updatePursuitStatus(pursuit, "paused")}
                          className="font-hand text-sm underline hover:text-highlighter-pink"
                        >
                          pause
                        </button>
                        <button
                          onClick={() => onDeletePursuit(pursuit.id)}
                          className="font-hand text-sm underline text-highlighter-pink"
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-5 sketch-border bg-highlighter-pink/10 border-dashed p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0">
                      <span className="font-sketch text-[10px] uppercase opacity-40 flex items-center gap-1">
                        <Flag size={12} /> This Week
                      </span>
                      <p className="font-hand text-lg leading-tight wrap-break-word">
                        {pursuit.weeklyFocus || "No weekly focus set."}
                      </p>
                      <div className="font-sketch text-xs opacity-50 mt-2 flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {weekLeft}
                        </span>
                        <span>
                          Resets {weekEnd.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at 12:00 AM
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="font-mono text-xs bg-ink text-white px-2 py-1">
                        {weeklyXp}/{weeklyTarget} XP
                      </div>
                      <button
                        onClick={() => openEditForm(pursuit, true)}
                        className="font-hand text-sm opacity-60 hover:opacity-100 hover:underline"
                      >
                        edit week
                      </button>
                    </div>
                  </div>
                  <div className="h-4 sketch-border bg-white overflow-hidden p-1">
                    <div
                      className="h-full bg-highlighter-pink transition-all"
                      style={{ width: `${weeklyPercent}%` }}
                    />
                  </div>
                </div>

                {(pursuit.why || pursuit.target) && (
                  <div className="grid md:grid-cols-2 gap-4 mt-5 font-hand text-sm leading-relaxed text-ink/70">
                    {pursuit.why && (
                      <p>
                        <span className="font-sketch text-[10px] uppercase opacity-40 block">Why</span>
                        {pursuit.why}
                      </p>
                    )}
                    {pursuit.target && (
                      <p>
                        <span className="font-sketch text-[10px] uppercase opacity-40 block">Target</span>
                        {pursuit.target}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-sketch text-[10px] uppercase opacity-40 flex items-center gap-1">
                      <Flame size={12} /> Last 35 days
                    </span>
                    <button
                      onClick={() => onTabChange?.("journal")}
                      className="font-hand text-sm opacity-50 hover:opacity-100 hover:underline"
                    >
                      add tasks
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {heatDays.map((date) => {
                      const amount = dailyXp.get(dayKey(date)) || 0;
                      const level =
                        amount >= 75
                          ? "bg-green-700"
                          : amount >= 50
                            ? "bg-green-600"
                            : amount >= 25
                              ? "bg-green-400"
                              : amount > 0
                                ? "bg-green-200"
                                : "bg-ink/5";
                      return (
                        <div
                          key={`${pursuit.id}-${dayKey(date)}`}
                          title={`${date.toLocaleDateString()}: ${amount} XP`}
                          className={`aspect-square border border-ink/10 ${level}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PursuitsView;
