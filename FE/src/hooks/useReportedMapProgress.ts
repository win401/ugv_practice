import { useLayoutEffect, useRef, useState } from "react";
import { REPORT_INTERVAL } from "../data/controlExample";
import { prefersReducedMapMotion } from "../lib/mapCameraMotion";

const DURATION_MS = REPORT_INTERVAL * 0.9;

/** Animate toward a received position without predicting the next report. */
export function useReportedMapProgress(
  runId: string | undefined,
  target: number,
  canMove: boolean,
) {
  const [pose, setPose] = useState({ runId, progress: target });
  const displayed = useRef(pose);
  const lastTarget = useRef(target);

  useLayoutEffect(() => {
    const changed = target !== lastTarget.current;
    lastTarget.current = target;
    const from = displayed.current.progress;
    const apply = (progress: number) => {
      const next = { runId, progress };
      displayed.current = next;
      setPose(next);
    };

    if (displayed.current.runId !== runId) {
      apply(target);
      return;
    }
    if (!canMove || !changed || from === target) return;
    if (prefersReducedMapMotion()) {
      apply(target);
      return;
    }

    const started = performance.now();
    let frame = requestAnimationFrame(function move(now) {
      const fraction = Math.max(0, Math.min(1, (now - started) / DURATION_MS));
      apply(fraction === 1 ? target : from + (target - from) * fraction);
      if (fraction < 1) frame = requestAnimationFrame(move);
    });
    return () => cancelAnimationFrame(frame);
  }, [runId, target, canMove]);

  return pose.runId === runId ? pose.progress : target;
}
