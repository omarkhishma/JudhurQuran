"use client";

import { useEffect } from "react";
import { startClassroomSignals } from "@/lib/classroomSignals";

/** The classroom's listener, started once for the page (P9.2a): nothing is counted outside an open lesson's verses,
 * and nothing is sent for a reader in no class. No copy of its own, so every route group can hold it. */
export function ClassroomSignals() {
  useEffect(() => startClassroomSignals(), []);
  return null;
}
