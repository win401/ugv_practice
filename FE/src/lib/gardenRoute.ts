function segmentAt(percent: number, route: number[][]) {
  const part = Math.min(
    (Math.max(percent, 0) / 100) * (route.length - 1),
    route.length - 1,
  );
  const i = Math.min(Math.floor(part), route.length - 2);
  return { from: route[i], to: route[i + 1], f: part - i };
}

export function pointAt(percent: number, route: number[][]) {
  const { from, to, f } = segmentAt(percent, route);
  return [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f];
}

/** 현재 구간의 진행 방향. 위쪽이 0도인 시계 방향 각도다. */
export function headingAt(percent: number, route: number[][]) {
  const { from, to } = segmentAt(percent, route);
  return (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI + 90;
}

export function outlineToShape(points: number[][]) {
  return `M${points.map((p) => p.join(" ")).join("L")}Z`;
}

/** 등록한 정원의 예시 경로: 꼭짓점을 구역 안쪽으로 당겨 차례로 잇는다. */
export function outlineToRoute(points: number[][]) {
  const center = [0, 1].map(
    (axis) => points.reduce((sum, p) => sum + p[axis], 0) / points.length,
  );
  return points.map((p) =>
    p.map((value, axis) =>
      Math.round(center[axis] + (value - center[axis]) * 0.7),
    ),
  );
}

/** 이름표를 놓을 위치: 구역에서 가장 위쪽 꼭짓점. */
export function outlineToLabel(points: number[][]) {
  const top = points.reduce((a, b) => (b[1] < a[1] ? b : a));
  return [top[0] - 20, top[1]];
}
