"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type VerseAudio = { key: string; ayah: number; url: string; segments: [number, number, number][] };

type Mode = "surah" | "verse" | "word";

type AudioState = {
  reciter: string;
  follow: boolean;
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
  playSurah: (surah: number, fromAyah: number) => void;
  playVerse: (key: string) => void;
  playWord: (key: string, tokenFrom: number, tokenTo: number) => void;
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
      setReciter: (id) => {
        const { playing, mode, surah, queue, index } = get();
        set({ reciter: id });
        if (playing && mode !== "word" && surah) get().playSurah(surah, queue[index]?.ayah ?? 1);
      },
      setFollow: (v) => set({ follow: v }),
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
      playWord: async (key, tokenFrom, tokenTo) => {
        const r = await fetch(`/api/v1/recitations/${get().reciter}/verses/${key}`);
        if (!r.ok) return;
        const v = (await r.json()) as VerseAudio & { surah: number };
        const segs = v.segments.filter(([pos]) => pos >= tokenFrom && pos <= tokenTo);
        if (!segs.length) return;
        set({
          mode: "word",
          surah: v.surah,
          queue: [v],
          index: 0,
          basmalaUrl: null,
          inBasmala: false,
          slice: { start: Math.min(...segs.map((x) => x[1])), end: Math.max(...segs.map((x) => x[2])) },
          token: null,
          playing: true,
          error: null,
        });
      },
      pause: () => set({ playing: false }),
      resume: () => set({ playing: true }),
      stop: () => set({ playing: false, queue: [], index: 0, token: null, slice: null, surah: null }),
      set: (p) => set(p),
    }),
    { name: "jadhr-audio", partialize: (s) => ({ reciter: s.reciter, follow: s.follow }) },
  ),
);
