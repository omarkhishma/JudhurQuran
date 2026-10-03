import { type Change, hash, type Local } from "./engine";

/**
 * A file's records against this browser's (plan B32), kept pure so it can be tested without either: a record new
 * here is added, one with the same value is left alone, one that differs is set aside for the reader to decide.
 * Nothing absent from the file is ever read as deleted.
 */
export function compare(theirs: Local, mine: Local): { add: Change[]; differ: Change[]; same: number } {
  const add: Change[] = [];
  const differ: Change[] = [];
  let same = 0;
  for (const [key, { value }] of theirs) {
    const here = mine.get(key);
    if (!here) add.push({ key, value, deleted: false });
    else if (hash(here.value) === hash(value)) same++;
    else differ.push({ key, value, deleted: false });
  }
  return { add, differ, same };
}
