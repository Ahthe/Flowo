import type {
  Task,
  TaskHistory,
  UserPreferences,
  SchedulerResult,
  Pursuit,
  JournalEntry,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// AUTH BYPASS: Use static dev token instead of real Supabase session
async function getHeaders() {
  return {
    Authorization: `Bearer dev-bypass-token`,
    "Content-Type": "application/json",
  };
}

async function assertOk(res: Response, fallback: string) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).message || `${fallback} (${res.status})`);
  }
}

export const api = {
  async getTasks(): Promise<Task[]> {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks`, { headers });
    await assertOk(res, "Failed to fetch tasks");
    return res.json();
  },

  async getPursuits(): Promise<Pursuit[]> {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/pursuits`, { headers });
    await assertOk(res, "Failed to fetch pursuits");
    return res.json();
  },

  async upsertPursuit(pursuit: Partial<Pursuit> & { title: string }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/pursuits`, {
      method: "POST",
      headers,
      body: JSON.stringify(pursuit),
    });
    await assertOk(res, "Failed to save pursuit");
    return res.json();
  },

  async deletePursuit(pursuitId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/pursuits/${pursuitId}`, {
      method: "DELETE",
      headers,
    });
    await assertOk(res, "Failed to delete pursuit");
  },

  async getJournalEntries(): Promise<JournalEntry[]> {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/journal-entries`, { headers });
    await assertOk(res, "Failed to fetch journal entries");
    return res.json();
  },

  async upsertJournalEntry(entry: Partial<JournalEntry> & { entryType: JournalEntry["entryType"] }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/journal-entries`, {
      method: "POST",
      headers,
      body: JSON.stringify(entry),
    });
    await assertOk(res, "Failed to save journal entry");
    return res.json();
  },

  async deleteJournalEntry(entryId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/journal-entries/${entryId}`, {
      method: "DELETE",
      headers,
    });
    await assertOk(res, "Failed to delete journal entry");
  },

  async resetAll() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/reset-all`, {
      method: "DELETE",
      headers,
    });
    await assertOk(res, "Failed to reset workspace");
  },

  async upsertTask(task: Partial<Task> & { id: string }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify(task),
    });
    await assertOk(res, "Failed to save task");
    return res.json();
  },

  async deleteTask(taskId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/${taskId}`, {
      method: "DELETE",
      headers,
    });
    await assertOk(res, "Failed to delete task");
  },
  
  async deleteChunk(chunkId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/chunk/${chunkId}`, {
      method: "DELETE",
      headers,
    });
    await assertOk(res, "Failed to delete chunk");
  },

  async createInstance(payload: { taskId: string, start: string, end: string, isPinned: boolean }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/instance`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    await assertOk(res, "Failed to create instance");
    return res.json();
  },

  async deleteInstance(instanceId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/instance/${instanceId}`, {
      method: "DELETE",
      headers,
    });
    await assertOk(res, "Failed to remove instance");
  },

  async pinInstance(instanceId: string, isPinned: boolean) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/instance/${instanceId}/pin`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ isPinned }),
    });
    await assertOk(res, "Failed to pin instance");
  },

  async createProgressLog(taskId: string, log: TaskHistory) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/log/${taskId}`, {
      method: "POST",
      headers,
      body: JSON.stringify(log),
    });
    await assertOk(res, "Failed to log progress");
  },

  async getPreferences(): Promise<UserPreferences | null> {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/preferences`, { headers });
    if (res.status === 404) return null;
    await assertOk(res, "Failed to fetch preferences");
    return res.json();
  },

  async updatePreferences(prefs: UserPreferences) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/tasks/preferences`, {
      method: "POST",
      headers,
      body: JSON.stringify(prefs),
    });
    await assertOk(res, "Failed to update preferences");
  },

  async runSmartSchedule(): Promise<SchedulerResult> {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/scheduler/schedule`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    await assertOk(res, "Scheduling failed");
    return res.json();
  },

  async classifyTask(description: string, skillLevel: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/ai/classify-task`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        task_description: description,
        skill_level: skillLevel,
      }),
    });
    await assertOk(res, "AI classification failed");
    return res.json();
  },
};
