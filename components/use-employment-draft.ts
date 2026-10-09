"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApplicationDraft } from "@/lib/employment";
import {
  employmentDraftKey,
  draftLifetime,
  draftDebounce,
  decodeEmploymentDraft,
  hasApplicationProgress,
  writeEmploymentDraft,
  removeEmploymentDraft,
  type SavedEmploymentDraft,
} from "@/lib/employment-draft";

type Phase = "loading" | "recovery" | "ready";
export function useEmploymentDraft(
  draft: ApplicationDraft,
  step: number,
  available: boolean,
  success: boolean,
) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [saved, setSaved] = useState<SavedEmploymentDraft | null>(null);
  const [status, setStatus] = useState("");
  const [confirmationNeeded, setConfirmationNeeded] = useState(false);
  const createdAt = useRef<number | null>(null);
  const unconfirmed = useRef(false);
  const completed = useRef(false);
  const current = useRef({ draft, step, phase, success });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    current.current = { draft, step, phase, success };
  }, [draft, step, phase, success]);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const clear = useCallback(() => {
    clearTimer();
    current.current = { ...current.current, phase: "loading" };
    try {
      const ok = removeEmploymentDraft(window.localStorage);
      setStatus(
        ok
          ? "Draft discarded from this device."
          : "Device storage is unavailable. Clear this site's browser data to remove any saved draft.",
      );
    } catch {
      setStatus(
        "Device storage is unavailable. Clear this site's browser data to remove any saved draft.",
      );
    }
    createdAt.current = null;
    unconfirmed.current = false;
    setSaved(null);
    setConfirmationNeeded(false);
  }, [clearTimer]);

  useEffect(() => {
    if (!available) return;
    let active = true;
    // Browser-only read after hydration; no server render accesses device storage.
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = window.localStorage.getItem(employmentDraftKey);
        const record = raw ? decodeEmploymentDraft(raw) : null;
        if (raw && !record) removeEmploymentDraft(window.localStorage);
        setSaved(record);
        setPhase(record ? "recovery" : "ready");
      } catch {
        setStatus(
          "Draft saving is unavailable on this device. Keep this tab open until you finish.",
        );
        setPhase("ready");
      }
    });
    return () => {
      active = false;
    };
  }, [available]);

  const persist = useCallback(() => {
    const latest = current.current;
    if (
      completed.current ||
      latest.success ||
      latest.phase !== "ready" ||
      !hasApplicationProgress(latest.draft, latest.step)
    )
      return;
    const now = Date.now();
    if (createdAt.current && now - createdAt.current >= draftLifetime) {
      try {
        removeEmploymentDraft(window.localStorage);
      } catch {
        /* Unavailable device storage. */
      }
      setStatus(
        "This device draft has expired. Your entries remain in this open tab, but cannot be recovered after leaving.",
      );
      return;
    }
    let ok = false;
    try {
      ok = writeEmploymentDraft(window.localStorage, {
        version: 1,
        createdAt: createdAt.current ?? now,
        savedAt: now,
        draft: latest.draft,
        step: latest.step,
        submissionUnconfirmed: unconfirmed.current,
      });
    } catch {
      /* Form remains usable. */
    }
    if (ok) createdAt.current ??= now;
    setStatus(
      ok
        ? "Draft saved on this device"
        : "Draft saving is unavailable on this device. Keep this tab open until you finish.",
    );
  }, []);

  useEffect(() => {
    if (success) {
      completed.current = true;
      clearTimer();
      // Keep a stale draft out of recovery even if removal is denied but writes work.
      queueMicrotask(() => {
        try {
          if (!removeEmploymentDraft(window.localStorage))
            window.localStorage.setItem(employmentDraftKey, "null");
        } catch {
          setStatus(
            "Your application was saved, but device storage could not be cleared. Clear this site's browser data on shared devices.",
          );
        }
      });
      return;
    }
    if (phase !== "ready") return;
    timer.current = setTimeout(persist, draftDebounce);
    return clearTimer;
  }, [draft, step, phase, success, persist, clearTimer]);

  useEffect(() => {
    const flush = () => {
      clearTimer();
      persist();
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
      clearTimer();
      // Covers client-side navigation/unmount as well as tab/page lifecycle events.
      persist();
    };
  }, [clearTimer, persist]);

  return {
    phase,
    saved,
    status,
    confirmationNeeded,
    continueDraft() {
      if (!saved) return null;
      if (!decodeEmploymentDraft(JSON.stringify(saved))) {
        clear();
        setPhase("ready");
        return null;
      }
      createdAt.current = saved.createdAt;
      unconfirmed.current = saved.submissionUnconfirmed;
      setConfirmationNeeded(saved.submissionUnconfirmed);
      setSaved(null);
      setPhase("ready");
      return saved;
    },
    startNew() {
      clear();
      setPhase("ready");
    },
    discard: clear,
    markSubmission() {
      unconfirmed.current = true;
      clearTimer();
      persist();
    },
  };
}
