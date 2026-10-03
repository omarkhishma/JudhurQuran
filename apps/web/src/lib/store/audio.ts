"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "@/lib/store/safeStorage";
import type { WordAudio } from "@/lib/types";

export type VerseAudio = { key: string; ayah: number; url: string; segments: [number, number, number][]; slice?: { start: number; end: number }; item?: HearItem };
/** One occurrence in a playlist (B4, "hear the root"): the word's slice of the word recitation, with where it is. */
export type HearItem = { location: string; verse_key: string; surah: { number: number; name_ar: string; name_translit: string }; ayah: number; surface: string; lemma: { slug: string; ar: string } | null; audio: WordAudio };

type Mode = "surah" | "verse" | "word" | "playlist";

export const SPEEDS = [1, 0.75, 0.5] as const; // the prototype's control, mapped to real recitation (RDR-554)
export type Speed = (typeof SPEEDS)[number];

type AudioState = {
  reciter: string;
  follow: boolean;
  speed: Speed;
  repeat: boolean; // repeat the current verse (memorisation)
  // playback
  playing: boolean;
  mode: Mode;
  surah: number | null;
  queue: VerseAudio[];
  index: number; // position in queue
  basmalaUrl: string | null;
  inBasmala: boolean;
  slice: { start: number; end: number } | null; // word mode, ms
  token: number | null; // display token being recited
  error: string | null;
  setReciter: (id: string) => void;
  setFollow: (v: boolean) => void;
  cycleSpeed: () => void;
  setRepeat: (v: boolean) => void;
  playSurah: (surah: number, fromAyah: number) => void;
  playVerse: (key: string) => void;
  /** a word's slice of the word-audio recitation (D10), whatever reciter the verses play in */
  playSlice: (key: string, audio: WordAudio) => void;
  /** every occurrence of a root or a word, slice after slice (B4); `list` names it, so its player knows its own */
  playList: (list: string, items: HearItem[], start?: number) => void;
  /** the playlist's next or previous slice */
  stepList: (dir: 1 | -1) => void;
  list: string | null;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  set: (p: Partial<AudioState>) => void;
};

async function fetchSurah(reciter: string, surah: number) {
  const r = await fetch(`/api/v1/recitations/${reciter}/surahs/${surah}`);
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as { basmala_url: string | null; verses: VerseAudio[] };
}

export const useAudio = create<AudioState>()(
  persist(
    (set, get) => ({
      reciter: "alafasy",
      follow: true,
      speed: 1,
      repeat: false,
      playing: false,
      mode: "surah",
      surah: null,
      queue: [],
      index: 0,
      basmalaUrl: null,
      inBasmala: false,
      slice: null,
      token: null,
      error: null,
      list: null,
      setReciter: (id) => {
        const { playing, mode, surah, queue, index } = get();
        set({ reciter: id });
        if (playing && mode !== "word" && mode !== "playlist" && surah) get().playSurah(surah, queue[index]?.ayah ?? 1);
      },
      setFollow: (v) => set({ follow: v }),
      cycleSpeed: () => set((s) => ({ speed: SPEEDS[(SPEEDS.indexOf(s.speed) + 1) % SPEEDS.length] })),
      setRepeat: (v) => set({ repeat: v }),
      playSurah: async (surah, fromAyah) => {
        try {
          const data = await fetchSurah(get().reciter, surah);
          const index = Math.max(0, data.verses.findIndex((v) => v.ayah === fromAyah));
          set({
            mode: "surah",
            surah,
            queue: data.verses,
            index,
            basmalaUrl: data.basmala_url,
            inBasmala: !!data.basmala_url && fromAyah === 1,
            slice: null,
            token: null,
            playing: true,
            error: null,
          });
        } catch (e) {
          set({ error: String(e), playing: false });
        }
      },
      playVerse: async (key) => {
        const [s, a] = key.split(":").map(Number);
        try {
          const data = await fetchSurah(get().reciter, s);
          const index = data.verses.findIndex((v) => v.ayah === a);
          set({ mode: "verse", surah: s, queue: data.verses, index, basmalaUrl: null, inBasmala: false, slice: null, token: null, playing: true, error: null });
        } catch (e) {
          set({ error: String(e), playing: false });
        }
      },
      playSlice: (key, audio) => {
        const [s, a] = key.split(":").map(Number);
        set({
          mode: "word",
          surah: s,
          queue: [{ key, ayah: a, url: audio.url, segments: [] }],
          index: 0,
          basmalaUrl: null,
          inBasmala: false,
          slice: { start: audio.start_ms, end: audio.end_ms },
          token: null,
          playing: true,
          error: null,
        });
      },
      playList: (list, items, start = 0) => {
        const queue: VerseAudio[] = items.map((x) => ({ key: x.verse_key, ayah: x.ayah, url: x.audio.url, segments: [], slice: { start: x.audio.start_ms, end: x.audio.end_ms }, item: x }));
        if (!queue.length) return;
        const i = Math.min(Math.max(0, start), queue.length - 1);
        set({ mode: "playlist", list, surah: null, queue, index: i, basmalaUrl: null, inBasmala: false, slice: queue[i].slice ?? null, token: null, playing: true, error: null });
      },
      stepList: (dir) => {
        const { queue, index, mode } = get();
        const i = index + dir;
        if (mode !== "playlist" || i < 0 || i >= queue.length) return;
        set({ index: i, slice: queue[i].slice ?? null, token: null, playing: true });
      },
      pause: () => set({ playing: false }),
      resume: () => set({ playing: true }),
      stop: () => set({ playing: false, queue: [], index: 0, token: null, slice: null, surah: null, list: null }),
      set: (p) => set(p),
    }),
    { name: "jadhr-audio", storage: safeJSONStorage, partialize: (s) => ({ reciter: s.reciter, follow: s.follow, speed: s.speed, repeat: s.repeat }) },
  ),
);
