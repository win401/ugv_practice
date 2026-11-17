import type { Run, RunMovement } from "../types/control";

/** 시연 이미지에서의 속도. 실제 주행 속도(m/s)를 나타내지 않는다. */
export const RUN_IMAGE_SPEED = 24;
const MIN_MOVE_MS = 2000;

/** 첫 지점에서는 제자리에 머물고, 이후에는 바로 전 지점부터 이동한다. */
export function createRunMovement(
  route: number[][],
  current: number,
  now: number,
): RunMovement {
  const target = Math.min(Math.max(0, current), Math.max(0, route.length - 1));
  const [toX = 0, toY = 0] = route[target] ?? [];
  const [fromX = toX, fromY = toY] = route[Math.max(0, target - 1)] ?? [];
  return {
    from: [fromX, fromY],
    to: [toX, toY],
    elapsedMs: 0,
    durationMs: Math.max(
      MIN_MOVE_MS,
      (Math.hypot(toX - fromX, toY - fromY) / RUN_IMAGE_SPEED) * 1000,
    ),
    startedAt: now,
  };
}

export function movementElapsed(movement: RunMovement, now: number): number {
  const elapsed =
    movement.elapsedMs +
    (movement.startedAt === null ? 0 : Math.max(0, now - movement.startedAt));
  return Math.min(movement.durationMs, Math.max(0, elapsed));
}

export function freezeRunMovement(
  movement: RunMovement | undefined,
  now: number,
): RunMovement | undefined {
  return movement
    ? {
        ...movement,
        elapsedMs: movementElapsed(movement, now),
        startedAt: null,
      }
    : undefined;
}

export function resumeRunMovement(
  movement: RunMovement | undefined,
  now: number,
): RunMovement | undefined {
  if (!movement || movement.startedAt !== null) return movement;
  return movement.elapsedMs < movement.durationMs
    ? { ...movement, startedAt: now }
    : movement;
}

/** 가상 장비가 보고할 구간별 경로 진행률(0~100). */
export function runMapProgress(run: Run | null, now: number): number {
  if (!run || run.route.length < 2) return 0;
  const last = run.route.length - 1;
  if (run.endReason === "complete") return 100;
  const current = Math.min(last, Math.max(0, run.current));
  const fraction = run.movement
    ? Math.min(
        1,
        movementElapsed(run.movement, now) /
          Math.max(1, run.movement.durationMs),
      )
    : 1;
  const position = current === 0 ? 0 : current - 1 + fraction;
  return (position / last) * 100;
}
