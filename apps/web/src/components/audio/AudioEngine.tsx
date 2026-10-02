"use client";

import { useEffect, useRef } from "react";
import { useAudio } from "@/lib/store/audio";

/**
 * The single <audio> element of the app. Plays the queue (basmala first when a surah starts at ayah 1),
 * follows the word timings to mark the word being recited in the text, and scrolls it into view when
 * "follow" is on. Word mode plays only the word's slice of the verse recitation.
 */
export function AudioEngine() {
  const el = useRef<HTMLAudioElement>(null);
  const raf = useRef<number | null>(null);
  const { playing, queue, index, inBasmala, basmalaUrl, slice, mode, speed } = useAudio();
  const current = queue[index];
  const src = inBasmala ? basmalaUrl : current?.url;

  // Load + play / pause.
  useEffect(() => {
    const a = el.current;
    if (!a) return;
    if (!src) {
      a.pause();
      return;
    }
    if (a.dataset.src !== src) {
      a.dataset.src = src;
      a.src = src;
      if (slice) a.currentTime = slice.start / 1000;
    } else if (slice && Math.abs(a.currentTime * 1000 - slice.start) > 50 && !playing) {
      a.currentTime = slice.start / 1000;
    }
    if (playing) void a.play().catch((e) => useAudio.getState().set({ playing: false, error: String(e) }));
    else a.pause();
  }, [src, playing, slice]);

  // Speed applies to the element itself, so the word timings stay exact at any rate.
  useEffect(() => {
    if (el.current) el.current.playbackRate = speed;
  }, [speed, src]);

  // Follow along: mark the recited word.
  useEffect(() => {
    function clear() {
      document.querySelectorAll(".w.is-reading").forEach((n) => n.classList.remove("is-reading"));
    }
    function tick() {
      const a = el.current;
      const st = useAudio.getState();
      const v = st.queue[st.index];
      if (a && v && !st.inBasmala) {
        const ms = a.currentTime * 1000;
        if (st.slice && ms >= st.slice.end) {
          a.pause();
          useAudio.getState().set({ playing: false, token: null });
          clear();
          return;
        }
        const seg = v.segments.find(([, s, e]) => ms >= s && ms <= e);
        const token = seg ? seg[0] : null;
        if (token !== st.token) {
          clear();
          if (token != null) {
            const span = document.querySelector<HTMLElement>(`[data-verse="${CSS.escape(v.key)}"] .w[data-t="${token}"]`);
            if (span) {
              span.classList.add("is-reading");
              if (st.follow && st.mode !== "word") span.scrollIntoView({ block: "center", behavior: "smooth" });
            }
          }
          useAudio.getState().set({ token });
        }
      }
      raf.current = requestAnimationFrame(tick);
    }
    if (playing) raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (!playing) clear();
    };
  }, [playing]);

  function onEnded() {
    const st = useAudio.getState();
    if (st.inBasmala) return st.set({ inBasmala: false });
    if (st.repeat && st.mode !== "word" && el.current) {
      el.current.currentTime = 0;
      void el.current.play();
      return;
    }
    if (st.mode === "surah" && st.index + 1 < st.queue.length) return st.set({ index: st.index + 1, token: null });
    st.set({ playing: false, token: null });
    document.querySelectorAll(".w.is-reading").forEach((n) => n.classList.remove("is-reading"));
  }

  return <audio ref={el} preload="none" onEnded={onEnded} hidden data-mode={mode} />;
}
