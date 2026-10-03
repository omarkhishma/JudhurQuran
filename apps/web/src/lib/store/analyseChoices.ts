"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "@/lib/store/safeStorage";

/** The Analyser: which candidate the reader chose for a written form (ANA-Q04), kept on this device. */
type Choices = { choices: Record<string, number>; choose: (key: string, i: number) => void };

export const useAnalyseChoices = create<Choices>()(
  persist(
    (set) => ({
      choices: {},
      choose: (key, i) => set((s) => ({ choices: { ...s.choices, [key]: i } })),
    }),
    { name: "jadhr-analyse-choices", storage: safeJSONStorage, version: 1 },
  ),
);
