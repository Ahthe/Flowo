import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Dumbbell,
  Edit2,
  Eye,
  Filter,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type {
  JournalEntry,
  JournalEntryType,
  Pursuit,
  TrainingExercise,
} from "../types";

interface JournalLogsViewProps {
  entries: JournalEntry[];
  error?: string | null;
  pursuits: Pursuit[];
  onSaveEntry: (
    entry: Partial<JournalEntry> & { entryType: JournalEntryType },
  ) => Promise<JournalEntry | undefined>;
  onDeleteEntry: (id: string) => void;
}

const toDateTimeLocal = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const newExercise = (): TrainingExercise => ({
  id: crypto.randomUUID(),
  name: "",
  sets: 3,
  reps: "8-12",
  weight: "",
  unit: "lb",
  notes: "",
});

const previewText = (value = "", max = 260) => {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trim()}...`;
};

const emptyDraft = () => ({
  id: undefined as string | undefined,
  entryType: "thought" as JournalEntryType,
  title: "",
  body: "",
  tags: "",
  pursuitId: "",
  loggedAt: toDateTimeLocal(),
  muscleGroup: "Chest",
  currentPounds: "",
  exercises: [newExercise()],
  trainingNotes: "",
});

const JournalLogsView: React.FC<JournalLogsViewProps> = ({
  entries,
  error,
  pursuits,
  onSaveEntry,
  onDeleteEntry,
}) => {
  const [draft, setDraft] = useState(emptyDraft);
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | JournalEntryType>("all");
  const [pursuitFilter, setPursuitFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const stats = useMemo(() => {
    const thoughtCount = entries.filter((entry) => entry.entryType === "thought").length;
    const trainingCount = entries.filter((entry) => entry.entryType === "training").length;
    const totalSets = entries.reduce((sum, entry) => {
      if (entry.entryType !== "training") return sum;
      return sum + (entry.trainingData?.exercises || []).reduce((setSum, exercise) => setSum + (exercise.sets || 0), 0);
    }, 0);
    return { thoughtCount, trainingCount, totalSets };
  }, [entries]);

  const selectedPursuit = pursuits.find((p) => p.id === draft.pursuitId);

  const displayedEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (typeFilter !== "all" && entry.entryType !== typeFilter) return false;
      if (pursuitFilter !== "all" && (entry.pursuitId || "") !== pursuitFilter) return false;
      if (!query) return true;

      const exerciseText = (entry.trainingData?.exercises || [])
        .map((exercise) => `${exercise.name} ${exercise.weight} ${exercise.reps}`)
        .join(" ");
      const searchable = [
        entry.title,
        entry.body,
        entry.trainingData?.muscleGroup,
        entry.trainingData?.currentPounds,
        exerciseText,
        ...(entry.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [entries, pursuitFilter, searchQuery, typeFilter]);

  const findLastExercise = (name: string) => {
    const needle = name.trim().toLowerCase();
    if (!needle) return null;

    for (const entry of entries) {
      if (entry.id === draft.id || entry.entryType !== "training") continue;
      const match = (entry.trainingData?.exercises || []).find(
        (exercise) => exercise.name.trim().toLowerCase() === needle,
      );
      if (match) {
        return {
          exercise: match,
          loggedAt: entry.loggedAt,
        };
      }
    }

    return null;
  };

  const resetDraft = () => setDraft(emptyDraft());

  const updateExercise = (
    id: string | undefined,
    updates: Partial<TrainingExercise>,
  ) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === id ? { ...exercise, ...updates } : exercise,
      ),
    }));
  };

  const removeExercise = (id: string | undefined) => {
    setDraft((current) => ({
      ...current,
      exercises:
        current.exercises.length > 1
          ? current.exercises.filter((exercise) => exercise.id !== id)
          : current.exercises,
    }));
  };

  const editEntry = (entry: JournalEntry) => {
    const exercises = entry.trainingData?.exercises?.length
      ? entry.trainingData.exercises.map((exercise) => ({
          ...exercise,
          id: exercise.id || crypto.randomUUID(),
        }))
      : [newExercise()];

    setDraft({
      id: entry.id,
      entryType: entry.entryType,
      title: entry.title || "",
      body: entry.body || "",
      tags: (entry.tags || []).join(", "),
      pursuitId: entry.pursuitId || "",
      loggedAt: toDateTimeLocal(entry.loggedAt),
      muscleGroup: entry.trainingData?.muscleGroup || "Chest",
      currentPounds: entry.trainingData?.currentPounds || "",
      exercises,
      trainingNotes: entry.trainingData?.notes || "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = draft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const isTraining = draft.entryType === "training";
    const saved = await onSaveEntry({
      id: draft.id,
      entryType: draft.entryType,
      title:
        draft.title.trim() ||
        (isTraining ? `${draft.muscleGroup} training` : "Untitled entry"),
      body: isTraining ? draft.trainingNotes.trim() : draft.body.trim(),
      tags,
      pursuitId: draft.pursuitId || undefined,
      loggedAt: new Date(draft.loggedAt).toISOString(),
      trainingData: isTraining
        ? {
            muscleGroup: draft.muscleGroup,
            currentPounds: draft.currentPounds.trim(),
            exercises: draft.exercises
              .filter((exercise) => exercise.name.trim())
              .map((exercise) => ({
                ...exercise,
                name: exercise.name.trim(),
                sets: Number(exercise.sets) || 0,
                reps: exercise.reps.trim(),
                weight: exercise.weight.trim(),
                unit: exercise.unit.trim() || "lb",
                notes: exercise.notes?.trim(),
              })),
            notes: draft.trainingNotes.trim(),
          }
        : undefined,
    });

    if (saved) resetDraft();
  };

  return (
    <div className="space-y-10 pb-24">
      <header className="flex flex-col lg:flex-row justify-between gap-6 lg:items-end">
        <div>
          <h2 className="marker-text text-4xl md:text-5xl inline-block px-6 py-2 bg-highlighter-orange -rotate-1">
            Journal
          </h2>
          <p className="font-sketch text-lg md:text-xl text-ink-light mt-4 max-w-2xl">
            Thoughts and training logs.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
          <div className="sketch-border bg-white px-4 py-3 text-center">
            <span className="font-sketch text-[10px] uppercase opacity-40">Thoughts</span>
            <div className="marker-text text-2xl">{stats.thoughtCount}</div>
          </div>
          <div className="sketch-border bg-white px-4 py-3 text-center">
            <span className="font-sketch text-[10px] uppercase opacity-40">Training</span>
            <div className="marker-text text-2xl">{stats.trainingCount}</div>
          </div>
          <div className="sketch-border bg-white px-4 py-3 text-center">
            <span className="font-sketch text-[10px] uppercase opacity-40">Sets</span>
            <div className="marker-text text-2xl">{stats.totalSets}</div>
          </div>
        </div>
      </header>

      {error && (
        <div className="sketch-border bg-highlighter-pink/10 border-dashed p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-highlighter-pink shrink-0 mt-1" />
          <div>
            <div className="font-marker text-lg">Journal setup needed</div>
            <p className="font-hand text-sm opacity-70">
              {error.includes("Journal table")
                ? "Run the journal_entries SQL migration in Supabase, then refresh this page."
                : error}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="sketch-border bg-white p-5 md:p-8 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-2">
            {(["thought", "training"] as JournalEntryType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, entryType: type }))}
                className={`px-4 py-2 sketch-border font-hand text-xl flex items-center gap-2 transition-all ${
                  draft.entryType === type
                    ? "bg-ink text-white"
                    : "bg-white opacity-60 hover:opacity-100 hover:bg-highlighter-orange/20"
                }`}
              >
                {type === "thought" ? <BookOpen size={18} /> : <Dumbbell size={18} />}
                {type === "thought" ? "Thought" : "Training"}
              </button>
            ))}
          </div>
          {draft.id && (
            <button
              type="button"
              onClick={resetDraft}
              className="font-hand text-lg opacity-60 hover:opacity-100 hover:underline flex items-center gap-1"
            >
              <X size={16} /> clear edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col md:col-span-2">
            <label className="font-sketch text-xs uppercase opacity-40 ml-1">Title</label>
            <input
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={draft.entryType === "training" ? "Chest session" : "What is on your mind?"}
              className="w-full text-2xl md:text-3xl font-hand p-2 border-b-2 border-ink focus:outline-none focus:border-highlighter-orange bg-transparent"
            />
          </div>
          <div className="flex flex-col">
            <label className="font-sketch text-xs uppercase opacity-40 ml-1">Logged At</label>
            <input
              type="datetime-local"
              value={draft.loggedAt}
              onChange={(e) => setDraft({ ...draft, loggedAt: e.target.value })}
              className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent"
            />
          </div>
          <div className="flex flex-col">
            <label className="font-sketch text-xs uppercase opacity-40 ml-1">Pursuit</label>
            <select
              value={draft.pursuitId}
              onChange={(e) => setDraft({ ...draft, pursuitId: e.target.value })}
              className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent appearance-none cursor-pointer"
            >
              <option value="">No pursuit</option>
              {pursuits.map((pursuit) => (
                <option key={pursuit.id} value={pursuit.id}>
                  {pursuit.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="font-sketch text-xs uppercase opacity-40 ml-1">Tags</label>
            <input
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              placeholder="idea, family, gym"
              className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent"
            />
          </div>
        </div>

        {draft.entryType === "thought" ? (
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="Write freely."
            rows={7}
            className="w-full font-hand text-xl p-4 sketch-border bg-paper-bg/30 focus:outline-none focus:bg-highlighter-orange/10 resize-y"
          />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col">
                <label className="font-sketch text-xs uppercase opacity-40 ml-1">Muscle Group</label>
                <input
                  value={draft.muscleGroup}
                  onChange={(e) => setDraft({ ...draft, muscleGroup: e.target.value })}
                  className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent"
                />
              </div>
              <div className="flex flex-col">
                <label className="font-sketch text-xs uppercase opacity-40 ml-1">Current Pounds</label>
                <input
                  value={draft.currentPounds}
                  onChange={(e) => setDraft({ ...draft, currentPounds: e.target.value })}
                  placeholder="180"
                  className="font-hand text-xl p-2 border-b-2 border-ink focus:outline-none bg-transparent"
                />
              </div>
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      exercises: [...current.exercises, newExercise()],
                    }))
                  }
                  className="w-full md:w-auto px-4 py-2 sketch-border bg-white hover:bg-highlighter-orange/30 transition-all font-hand text-lg flex items-center justify-center gap-2"
                >
                  <Plus size={17} /> Add Exercise
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {draft.exercises.map((exercise, index) => (
                <div
                  key={exercise.id}
                  className="grid grid-cols-1 md:grid-cols-[1.4fr_0.5fr_0.7fr_0.8fr_0.7fr_auto] gap-3 sketch-border bg-paper-bg/30 p-3 items-end"
                >
                  <div className="flex flex-col">
                    <label className="font-sketch text-[10px] uppercase opacity-40 ml-1">
                      Exercise {index + 1}
                    </label>
                    <input
                      value={exercise.name}
                      onChange={(e) => updateExercise(exercise.id, { name: e.target.value })}
                      placeholder="Bench press"
                      className="font-hand text-lg p-2 border-b-2 border-ink/30 focus:border-ink focus:outline-none bg-transparent"
                    />
                    {(() => {
                      const last = findLastExercise(exercise.name);
                      if (!last) return null;
                      return (
                        <span className="font-sketch text-[10px] opacity-45 mt-1">
                          Last: {last.exercise.sets} x {last.exercise.reps}
                          {last.exercise.weight ? ` @ ${last.exercise.weight}${last.exercise.unit}` : ""} on{" "}
                          {new Date(last.loggedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex flex-col">
                    <label className="font-sketch text-[10px] uppercase opacity-40 ml-1">Sets</label>
                    <input
                      type="number"
                      min="1"
                      value={exercise.sets}
                      onChange={(e) => updateExercise(exercise.id, { sets: Number(e.target.value) })}
                      className="font-hand text-lg p-2 border-b-2 border-ink/30 focus:border-ink focus:outline-none bg-transparent"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="font-sketch text-[10px] uppercase opacity-40 ml-1">Reps</label>
                    <input
                      value={exercise.reps}
                      onChange={(e) => updateExercise(exercise.id, { reps: e.target.value })}
                      className="font-hand text-lg p-2 border-b-2 border-ink/30 focus:border-ink focus:outline-none bg-transparent"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="font-sketch text-[10px] uppercase opacity-40 ml-1">Weight</label>
                    <input
                      value={exercise.weight}
                      onChange={(e) => updateExercise(exercise.id, { weight: e.target.value })}
                      placeholder="35"
                      className="font-hand text-lg p-2 border-b-2 border-ink/30 focus:border-ink focus:outline-none bg-transparent"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="font-sketch text-[10px] uppercase opacity-40 ml-1">Unit</label>
                    <input
                      value={exercise.unit}
                      onChange={(e) => updateExercise(exercise.id, { unit: e.target.value })}
                      placeholder="lb DB each"
                      className="font-hand text-lg p-2 border-b-2 border-ink/30 focus:border-ink focus:outline-none bg-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExercise(exercise.id)}
                    className="p-2 opacity-40 hover:opacity-100 hover:text-highlighter-pink transition-colors"
                    title="Remove exercise"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>

            <textarea
              value={draft.trainingNotes}
              onChange={(e) => setDraft({ ...draft, trainingNotes: e.target.value })}
              placeholder="Session notes."
              rows={3}
              className="w-full font-hand text-lg p-4 sketch-border bg-paper-bg/30 focus:outline-none focus:bg-highlighter-orange/10 resize-y"
            />
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
          <div className="font-hand text-sm opacity-60 truncate">
            {selectedPursuit ? `Linked to ${selectedPursuit.title}` : "Not linked to a pursuit"}
          </div>
          <button
            type="submit"
            className="px-6 py-2 sketch-border bg-ink text-white font-marker text-xl hover:bg-highlighter-orange hover:text-ink transition-all flex items-center justify-center gap-2"
          >
            <Save size={18} /> {draft.id ? "Save Changes" : "Save Entry"}
          </button>
        </div>
      </form>

      <div className="sketch-border bg-white p-4 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex flex-col md:flex-row gap-3 flex-1">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-35" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries, tags, exercises..."
              className="w-full pl-10 pr-4 py-3 bg-paper-bg/30 sketch-border font-hand text-lg focus:outline-none focus:bg-highlighter-orange/10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | JournalEntryType)}
            className="px-3 py-3 bg-white sketch-border font-hand text-lg focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="thought">Thoughts</option>
            <option value="training">Training</option>
          </select>
          <select
            value={pursuitFilter}
            onChange={(e) => setPursuitFilter(e.target.value)}
            className="px-3 py-3 bg-white sketch-border font-hand text-lg focus:outline-none"
          >
            <option value="all">All Pursuits</option>
            {pursuits.map((pursuit) => (
              <option key={pursuit.id} value={pursuit.id}>
                {pursuit.title}
              </option>
            ))}
          </select>
        </div>
        <div className="font-sketch text-xs uppercase opacity-40 flex items-center gap-1">
          <Filter size={13} /> {displayedEntries.length} shown
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {displayedEntries.map((entry, index) => {
          const pursuit = pursuits.find((p) => p.id === entry.pursuitId);
          const isTraining = entry.entryType === "training";
          const exercises = entry.trainingData?.exercises || [];
          return (
            <article
              key={entry.id}
              className={`sketch-border bg-white p-5 shadow-lg relative ${
                index % 2 === 0 ? "rotate-1" : "-rotate-1"
              } hover:rotate-0 transition-transform`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-[10px] bg-ink text-white px-1.5 py-0.5 uppercase">
                      {isTraining ? "training" : "thought"}
                    </span>
                    <span className="font-sketch text-xs opacity-50">
                      {new Date(entry.loggedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {pursuit && (
                      <span className="font-sketch text-xs bg-highlighter-blue/20 px-2 py-0.5">
                        {pursuit.title}
                      </span>
                    )}
                  </div>
                  <h3 className="marker-text text-2xl leading-tight vellum-prose">
                    {entry.title || (isTraining ? entry.trainingData?.muscleGroup : "Untitled")}
                  </h3>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setViewEntry(entry)}
                    className="p-2 opacity-40 hover:opacity-100 hover:text-highlighter-orange transition-colors"
                    title="View entry"
                  >
                    <Eye size={17} />
                  </button>
                  <button
                    onClick={() => editEntry(entry)}
                    className="p-2 opacity-40 hover:opacity-100 hover:text-highlighter-blue transition-colors"
                    title="Edit entry"
                  >
                    <Edit2 size={17} />
                  </button>
                  <button
                    onClick={() => onDeleteEntry(entry.id)}
                    className="p-2 opacity-30 hover:opacity-100 hover:text-highlighter-pink transition-colors"
                    title="Delete entry"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>

              {isTraining ? (
                <div className="mt-4 space-y-3">
                  <div className="font-sketch text-xs uppercase opacity-40">
                    {entry.trainingData?.muscleGroup || "Training"}
                    {entry.trainingData?.currentPounds ? ` • ${entry.trainingData.currentPounds} lb` : ""}
                  </div>
                  {exercises.map((exercise) => (
                    <div
                      key={exercise.id || `${exercise.name}-${exercise.sets}`}
                      className="grid grid-cols-[1fr_auto] gap-3 border-b border-dashed border-ink/10 pb-2"
                    >
                      <div className="font-hand text-lg vellum-prose">{exercise.name}</div>
                      <div className="font-mono text-xs bg-highlighter-orange/20 px-2 py-1 vellum-prose text-right">
                        {exercise.sets} x {exercise.reps}
                        {exercise.weight ? ` @ ${exercise.weight}${exercise.unit}` : ""}
                      </div>
                    </div>
                  ))}
                  {entry.body && (
                    <p className="font-hand text-base opacity-70 vellum-prose">
                      {previewText(entry.body, 180)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-hand text-lg leading-relaxed mt-4 text-ink/80 vellum-prose">
                  {previewText(entry.body, 280)}
                </p>
              )}

              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-dashed border-ink/10">
                  {(entry.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="font-sketch text-xs opacity-60 flex items-center gap-1"
                    >
                      <Tag size={11} /> {tag}
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {viewEntry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-ink/70 backdrop-blur-md">
          <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto custom-scrollbar">
            <div className="sketch-border bg-white p-5 md:p-8 shadow-2xl relative -rotate-1">
              <button
                onClick={() => setViewEntry(null)}
                className="absolute top-3 right-3 p-2 sketch-border bg-ink text-white hover:bg-highlighter-pink transition-all z-10"
                aria-label="Close entry"
              >
                <X size={20} />
              </button>
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b-2 border-dashed border-ink/10 pb-5">
                <div>
                  <span className="font-mono text-[10px] bg-ink text-white px-2 py-1 uppercase">
                    {viewEntry.entryType}
                  </span>
                  <h3 className="marker-text text-3xl md:text-4xl mt-4 leading-tight vellum-prose pr-12">
                    {viewEntry.title || "Untitled"}
                  </h3>
                  <p className="font-sketch text-sm opacity-50 mt-2">
                    {new Date(viewEntry.loggedAt).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => {
                    editEntry(viewEntry);
                    setViewEntry(null);
                  }}
                  className="px-4 py-2 sketch-border bg-white hover:bg-highlighter-orange/30 transition-all font-hand text-lg flex items-center gap-2"
                >
                  <Edit2 size={17} /> Edit
                </button>
              </div>

              {viewEntry.entryType === "training" ? (
                <div className="mt-6 space-y-5">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="sketch-border border-dashed p-3 bg-highlighter-orange/10">
                      <span className="font-sketch text-[10px] uppercase opacity-40">Muscle</span>
                      <div className="marker-text text-xl">{viewEntry.trainingData?.muscleGroup || "Training"}</div>
                    </div>
                    <div className="sketch-border border-dashed p-3 bg-highlighter-pink/10">
                      <span className="font-sketch text-[10px] uppercase opacity-40">Current Pounds</span>
                      <div className="marker-text text-xl">{viewEntry.trainingData?.currentPounds || "Not set"}</div>
                    </div>
                    <div className="sketch-border border-dashed p-3 bg-highlighter-blue/10">
                      <span className="font-sketch text-[10px] uppercase opacity-40">Exercises</span>
                      <div className="marker-text text-xl">{viewEntry.trainingData?.exercises?.length || 0}</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {(viewEntry.trainingData?.exercises || []).map((exercise) => (
                      <div key={exercise.id || exercise.name} className="sketch-border bg-paper-bg/30 p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <div className="font-hand text-2xl vellum-prose">{exercise.name}</div>
                          <div className="font-mono text-xs bg-ink text-white px-2 py-1 self-start md:self-auto vellum-prose">
                            {exercise.sets} x {exercise.reps}
                            {exercise.weight ? ` @ ${exercise.weight}${exercise.unit}` : ""}
                          </div>
                        </div>
                        {exercise.notes && <p className="font-hand text-sm opacity-60 mt-2 vellum-prose">{exercise.notes}</p>}
                      </div>
                    ))}
                  </div>
                  {viewEntry.body && (
                    <p className="font-hand text-lg leading-relaxed whitespace-pre-wrap text-ink/80 vellum-prose">
                      {viewEntry.body}
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-hand text-xl leading-relaxed mt-6 whitespace-pre-wrap text-ink/80 vellum-prose">
                  {viewEntry.body}
                </p>
              )}

              {viewEntry.tags && viewEntry.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t-2 border-dashed border-ink/10">
                  {viewEntry.tags.map((tag) => (
                    <span key={tag} className="font-sketch text-xs opacity-60 flex items-center gap-1">
                      <Tag size={11} /> {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {displayedEntries.length === 0 && (
        <div className="min-h-[30vh] flex flex-col items-center justify-center text-center opacity-60">
          <BookOpen size={54} className="text-highlighter-orange mb-4" />
          <div className="font-marker text-4xl -rotate-2">
            {entries.length === 0 ? "empty pages" : "nothing found"}
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalLogsView;
