/** Local-first personal state (device only, never sent anywhere). */
export type Progress = { surah: number; ayah: number; at: number };

export const PROGRESS_KEY = "jadhr-progress";

export function readProgress(): Progress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Progress) : null;
  } catch {
    return null;
  }
}

export function writeProgress(p: Omit<Progress, "at">): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...p, at: Date.now() }));
  } catch {}
}
