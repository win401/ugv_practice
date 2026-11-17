import type { Point } from "../api/gardenDetail";

export interface ZoneBoundaryHandle {
  id: string;
  point: Point;
  kind: "anchor" | "control";
  /** Endpoint joined to this curve control handle. */
  anchor?: Point;
}

export type CommandKind = "M" | "L" | "C" | "Q" | "Z";
export type ZonePathCommand = { kind: CommandKind; points: Point[] };
const COUNTS: Record<CommandKind, number> = { M: 1, L: 1, C: 3, Q: 2, Z: 0 };
const LIMIT = 256;
const equal = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.00001;
const clone = (p: Point): Point => [p[0], p[1]];
const fail = (): never => {
  throw new Error(
    "구역 경계 형식이 올바르지 않습니다. 원래 경계를 다시 불러와 주세요.",
  );
};

/** Only the absolute, explicitly closed SVG commands used by the seed are accepted. */
export function parseZonePath(shape: string): ZonePathCommand[] {
  if (typeof shape !== "string" || !shape.trim() || shape.length > 20000)
    fail();
  const token = /[MLCQZ]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
  const values: string[] = [];
  let end = 0;
  for (const match of shape.matchAll(token)) {
    if (!/^[\s,]*$/.test(shape.slice(end, match.index))) fail();
    values.push(match[0]);
    end = match.index + match[0].length;
  }
  if (!/^[\s,]*$/.test(shape.slice(end))) fail();
  const commands: ZonePathCommand[] = [];
  let open = false;
  let segments = 0;
  for (let i = 0; i < values.length; ) {
    const kind = values[i++] as CommandKind;
    if (!Object.prototype.hasOwnProperty.call(COUNTS, kind)) fail();
    if (kind === "M") {
      if (open) fail();
      open = true;
      segments = 0;
    } else if (!open) fail();
    if (kind === "Z") {
      if (segments < 1) fail();
      open = false;
    } else if (kind !== "M") segments++;
    const points: Point[] = [];
    for (let p = 0; p < COUNTS[kind]; p++) {
      const x = Number(values[i++]);
      const y = Number(values[i++]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) fail();
      points.push([x, y]);
    }
    commands.push({ kind, points });
    if (commands.length > LIMIT) fail();
  }
  if (open || !commands.length) fail();
  return commands;
}

const endpoint = (command: ZonePathCommand): Point => command.points.at(-1)!;
function subpathStart(commands: ZonePathCommand[], index: number) {
  while (index > 0 && commands[index].kind !== "M") index--;
  return index;
}
function subpathEnd(commands: ZonePathCommand[], index: number) {
  while (index < commands.length && commands[index].kind !== "Z") index++;
  return index;
}
function isClosingDuplicate(commands: ZonePathCommand[], index: number) {
  const command = commands[index];
  return (
    command.kind !== "M" &&
    command.kind !== "Z" &&
    commands[index + 1]?.kind === "Z" &&
    equal(endpoint(command), endpoint(commands[subpathStart(commands, index)]))
  );
}

export function getZoneBoundaryHandles(shape: string): ZoneBoundaryHandle[] {
  const commands = parseZonePath(shape);
  const handles: ZoneBoundaryHandle[] = [];
  let previous: Point = [0, 0];
  commands.forEach((command, index) => {
    if (command.kind === "Z") return;
    command.points.forEach((point, p) => {
      const anchorPoint = p === command.points.length - 1;
      if (anchorPoint && isClosingDuplicate(commands, index)) return;
      handles.push({
        id: `${index}:${p}`,
        point: clone(point),
        kind: anchorPoint ? "anchor" : "control",
        ...(anchorPoint
          ? {}
          : {
              anchor: clone(
                command.kind === "C" && p === 1 ? endpoint(command) : previous,
              ),
            }),
      });
    });
    previous = endpoint(command);
  });
  return handles;
}

export function moveZoneBoundaryHandle(
  shape: string,
  id: string,
  point: Point,
): string {
  if (
    !Array.isArray(point) ||
    point.length !== 2 ||
    !point.every(Number.isFinite)
  )
    fail();
  const commands = parseZonePath(shape);
  const match = /^(\d+):(\d+)$/.exec(id);
  if (!match) return fail();
  const index = Number(match[1]);
  const p = Number(match[2]);
  const command = commands[index];
  if (
    !command?.points[p] ||
    !getZoneBoundaryHandles(shape).some((handle) => handle.id === id)
  )
    fail();
  const old = command.points[p];
  if (equal(old, point)) return shape;
  const delta: Point = [point[0] - old[0], point[1] - old[1]];
  const moving = new Set<string>([id]);
  const moveIncoming = (at: number) => {
    const c = commands[at];
    if (c.kind === "C") moving.add(`${at}:1`);
    if (c.kind === "Q") moving.add(`${at}:0`);
  };
  const moveOutgoing = (at: number) => {
    const c = commands[at];
    if (c?.kind === "C" || c?.kind === "Q") moving.add(`${at}:0`);
  };
  if (p === command.points.length - 1) {
    moveIncoming(index);
    moveOutgoing(index + 1);
    if (command.kind === "M") {
      const last = subpathEnd(commands, index) - 1;
      if (last > index && isClosingDuplicate(commands, last)) {
        moving.add(`${last}:${commands[last].points.length - 1}`);
        moveIncoming(last);
      }
    }
  }
  for (const key of moving) {
    const [c, v] = key.split(":").map(Number);
    const q = commands[c].points[v];
    commands[c].points[v] = [q[0] + delta[0], q[1] + delta[1]];
  }
  return serializeZonePath(commands);
}

export interface ZoneBoundarySegment {
  /** Index of the destination SVG command; IDs change when a point is inserted. */
  id: string;
  kind: "L" | "C" | "Q" | "Z";
  start: Point;
  controls: Point[];
  end: Point;
  /** A standalone open SVG path for hit testing this one boundary segment. */
  shape: string;
}

const pointText = (point: Point) => point.join(" ");
export const serializeZonePath = (commands: ZonePathCommand[]) =>
  commands
    .map((command) => command.kind + command.points.map(pointText).join(" "))
    .join(" ");

export function getZoneBoundarySegments(shape: string): ZoneBoundarySegment[] {
  const commands = parseZonePath(shape);
  const segments: ZoneBoundarySegment[] = [];
  let previous: Point = [0, 0];
  let first: Point = [0, 0];
  commands.forEach((command, index) => {
    if (command.kind === "M") {
      first = endpoint(command);
      previous = first;
      return;
    }
    const end = command.kind === "Z" ? first : endpoint(command);
    if (command.kind === "Z" && equal(previous, end)) return;
    const controls = command.points.slice(0, -1).map(clone);
    segments.push({
      id: String(index),
      kind: command.kind,
      start: clone(previous),
      controls,
      end: clone(end),
      shape: `M${pointText(previous)} ${command.kind === "Z" ? "L" : command.kind}${[...controls, end].map(pointText).join(" ")}`,
    });
    previous = end;
  });
  return segments;
}

const blend = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const squaredDistance = (a: Point, b: Point) =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
function pointOnSegment(segment: ZoneBoundarySegment, t: number): Point {
  let points = [segment.start, ...segment.controls, segment.end];
  while (points.length > 1)
    points = points
      .slice(0, -1)
      .map((p, index) => blend(p, points[index + 1], t));
  return points[0];
}

export function findClosestZoneBoundaryPoint(
  shape: string,
  point: Point,
): { segmentId: string; t: number; point: Point; distance: number } | null {
  if (
    !Array.isArray(point) ||
    point.length !== 2 ||
    !point.every(Number.isFinite)
  )
    return null;
  let closest: {
    segmentId: string;
    t: number;
    point: Point;
    distance: number;
  } | null = null;
  for (const segment of getZoneBoundarySegments(shape)) {
    const accept = (t: number) => {
      const candidate = pointOnSegment(segment, t);
      const distance = Math.sqrt(squaredDistance(candidate, point));
      if (!closest || distance < closest.distance)
        closest = { segmentId: segment.id, t, point: candidate, distance };
    };
    if (segment.kind === "L" || segment.kind === "Z") {
      const lengthSquared = squaredDistance(segment.start, segment.end);
      const t =
        lengthSquared > 0
          ? ((point[0] - segment.start[0]) *
              (segment.end[0] - segment.start[0]) +
              (point[1] - segment.start[1]) *
                (segment.end[1] - segment.start[1])) /
            lengthSquared
          : 0;
      accept(Math.min(1, Math.max(0, t)));
      continue;
    }
    // Bracket every sampled local minimum, then refine instead of snapping to samples.
    // This is a UI closest-point approximation, not a measured navigation boundary.
    const steps = 64;
    const distances = Array.from({ length: steps + 1 }, (_, i) =>
      squaredDistance(pointOnSegment(segment, i / steps), point),
    );
    accept(0);
    accept(1);
    for (let i = 0; i <= steps; i++) {
      if (
        distances[i] > (distances[i - 1] ?? Infinity) ||
        distances[i] > (distances[i + 1] ?? Infinity)
      )
        continue;
      let low = Math.max(0, (i - 1) / steps);
      let high = Math.min(1, (i + 1) / steps);
      for (let iteration = 0; iteration < 32; iteration++) {
        const a = low + (high - low) / 3;
        const b = high - (high - low) / 3;
        if (
          squaredDistance(pointOnSegment(segment, a), point) <=
          squaredDistance(pointOnSegment(segment, b), point)
        )
          high = b;
        else low = a;
      }
      accept((low + high) / 2);
    }
  }
  return closest;
}

export function insertZoneBoundaryPoint(
  shape: string,
  segmentId: string,
  t: number,
): { shape: string; handleId: string } {
  if (!Number.isFinite(t) || t <= 0.0001 || t >= 0.9999) {
    throw new Error(
      "기존 경계 점에서 조금 떨어진 선 위에 새 점을 추가해 주세요.",
    );
  }
  const commands = parseZonePath(shape);
  const segment = getZoneBoundarySegments(shape).find(
    (item) => item.id === segmentId,
  );
  if (!segment) throw new Error("점을 추가할 경계선을 다시 선택해 주세요.");
  if (commands.length >= LIMIT) {
    throw new Error("이 구역에 추가할 수 있는 점의 수를 초과했습니다.");
  }
  const index = Number(segment.id);
  let points = [segment.start, ...segment.controls, segment.end].map(clone);
  const left: Point[] = [clone(points[0])];
  const right: Point[] = [clone(points.at(-1)!)];
  // de Casteljau preserves the original Bézier exactly, including at joins.
  while (points.length > 1) {
    points = points.slice(0, -1).map((p, at) => blend(p, points[at + 1], t));
    left.push(clone(points[0]));
    right.unshift(clone(points.at(-1)!));
  }
  const added = left.at(-1)!;
  if (equal(added, segment.start) || equal(added, segment.end)) {
    throw new Error("기존 경계 점과 겹치지 않는 위치에 점을 추가해 주세요.");
  }
  if (segment.kind === "Z") {
    // Keep Z as the final closing command; only the first part becomes explicit L.
    commands.splice(index, 0, { kind: "L", points: [added] });
  } else {
    commands.splice(
      index,
      1,
      { kind: segment.kind, points: left.slice(1) },
      { kind: segment.kind, points: right.slice(1) },
    );
  }
  // Full precision is intentional: repeated insertion must not visibly reshape curves.
  const nextShape = serializeZonePath(commands);
  parseZonePath(nextShape); // Enforce command and serialized-length limits before returning.
  return { shape: nextShape, handleId: `${index}:${left.length - 2}` };
}

/** Add Bézier handles without changing the silhouette of a straight segment. */
export function convertZoneSegmentToCurve(
  shape: string,
  segmentId: string,
): string {
  const commands = parseZonePath(shape);
  const segment = getZoneBoundarySegments(shape).find(
    (item) => item.id === segmentId,
  );
  if (!segment) throw new Error("곡선으로 바꿀 경계선을 다시 선택해 주세요.");
  if (segment.kind === "C" || segment.kind === "Q") return shape;
  if (equal(segment.start, segment.end))
    throw new Error("길이가 있는 경계선을 선택해 주세요.");
  const curve: ZonePathCommand = {
    kind: "C",
    points: [
      blend(segment.start, segment.end, 1 / 3),
      blend(segment.start, segment.end, 2 / 3),
      clone(segment.end),
    ],
  };
  if (segment.kind === "Z") {
    if (commands.length >= LIMIT)
      throw new Error("이 구역에 추가할 수 있는 점의 수를 초과했습니다.");
    commands.splice(Number(segment.id), 0, curve);
  } else commands[Number(segment.id)] = curve;
  const next = serializeZonePath(commands);
  parseZonePath(next);
  return next;
}

/** A drawing is one simple exterior ring; holes and duplicate vertices are unsupported. */
export function polygonShapeFromPoints(
  points: Point[],
  width?: number,
  height?: number,
): string {
  if (
    !Array.isArray(points) ||
    points.length < 3 ||
    points.length > 101 ||
    points.some(
      (p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite),
    )
  ) {
    throw new Error("정원 안에 3개 이상, 100개 이하의 경계 점을 찍어 주세요.");
  }
  const vertices = points.map(clone);
  if (vertices.length > 3 && equal(vertices[0], vertices.at(-1)!))
    vertices.pop();
  if (vertices.length > 100)
    throw new Error("새 구역에는 경계 점을 100개까지 추가할 수 있습니다.");
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (equal(vertices[i], vertices[j]))
        throw new Error(
          "경계 점이 서로 겹칩니다. 다른 위치에 점을 찍어 주세요.",
        );
    }
    const a = vertices[(i + vertices.length - 1) % vertices.length];
    const b = vertices[i];
    const c = vertices[(i + 1) % vertices.length];
    if (
      Math.abs(cross(a, b, c)) < 1e-7 &&
      (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0
    ) {
      throw new Error(
        "경계선이 되돌아가며 겹칩니다. 경계 점을 다시 조정해 주세요.",
      );
    }
  }
  // The shared validator rejects strict crossings. Also reject a non-adjacent
  // vertex touching an edge, which would not describe a simple drawn polygon.
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length];
    for (let j = 0; j < vertices.length; j++) {
      if (j === i || j === (i + 1) % vertices.length) continue;
      const c = vertices[j];
      if (
        Math.abs(cross(a, b, c)) < 1e-7 &&
        c[0] >= Math.min(a[0], b[0]) &&
        c[0] <= Math.max(a[0], b[0]) &&
        c[1] >= Math.min(a[1], b[1]) &&
        c[1] <= Math.max(a[1], b[1])
      ) {
        throw new Error(
          "경계 점이 다른 경계선에 닿습니다. 점을 다시 조정해 주세요.",
        );
      }
    }
  }
  const shape = serializeZonePath(
    vertices
      .map(
        (point, i) =>
          ({ kind: i ? "L" : "M", points: [point] }) as ZonePathCommand,
      )
      .concat({ kind: "Z", points: [] }),
  );
  validateZoneShape(shape, width, height);
  return shape;
}

/** Curves are sampled for validation/labels only; their stored SVG is never flattened. */
function outlines(commands: ZonePathCommand[]): Point[][] {
  const result: Point[][] = [];
  let points: Point[] = [];
  let previous: Point = [0, 0];
  for (const command of commands) {
    if (command.kind === "M") {
      points = [clone(endpoint(command))];
    } else if (command.kind === "Z") {
      if (points.length > 1 && equal(points[0], points.at(-1)!)) points.pop();
      result.push(points);
      continue;
    } else if (command.kind === "L") points.push(clone(endpoint(command)));
    else {
      for (let step = 1; step <= 24; step++) {
        const t = step / 24;
        const u = 1 - t;
        const [a, b, c] = command.points;
        const value = (axis: 0 | 1) =>
          command.kind === "C"
            ? u ** 3 * previous[axis] +
              3 * u ** 2 * t * a[axis] +
              3 * u * t ** 2 * b[axis] +
              t ** 3 * c[axis]
            : u ** 2 * previous[axis] + 2 * u * t * a[axis] + t ** 2 * b[axis];
        points.push([value(0), value(1)]);
      }
    }
    previous = endpoint(command);
  }
  return result.map((points) =>
    points.filter((point, i) => !i || !equal(point, points[i - 1])),
  );
}
const signedArea = (points: Point[]) =>
  points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function intersects(a: Point, b: Point, c: Point, d: Point) {
  // Strict crossing: adjoining or touching curve samples are not crossings.
  return (
    cross(a, b, c) * cross(a, b, d) < -1e-7 &&
    cross(c, d, a) * cross(c, d, b) < -1e-7
  );
}
function inside(point: Point, polygon: Point[]) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}

export function validateZoneShape(
  shape: string,
  width?: number,
  height?: number,
): void {
  if (
    (width !== undefined || height !== undefined) &&
    ![width, height].every(
      (n) => typeof n === "number" && Number.isFinite(n) && n > 0,
    )
  )
    fail();
  const commands = parseZonePath(shape);
  for (const c of commands)
    for (const [x, y] of c.points) {
      if (
        width !== undefined &&
        height !== undefined &&
        (x < 0 || y < 0 || x > width || y > height)
      )
        throw new Error("경계와 곡선 조절점은 정원 이미지 안에 놓아 주세요.");
    }
  for (const points of outlines(commands)) {
    if (points.length < 3 || Math.abs(signedArea(points)) < 0.5)
      throw new Error(
        "구역의 넓이가 너무 작습니다. 경계 점을 다시 조정해 주세요.",
      );
    for (let i = 0; i < points.length; i++)
      for (let j = i + 2; j < points.length; j++) {
        if (i === 0 && j === points.length - 1) continue;
        if (
          intersects(
            points[i],
            points[(i + 1) % points.length],
            points[j],
            points[(j + 1) % points.length],
          )
        )
          throw new Error(
            "구역 경계가 서로 교차합니다. 경계 점을 다시 조정해 주세요.",
          );
      }
  }
}

export function labelForZoneShape(shape: string, previous: Point): Point {
  const rings = outlines(parseZonePath(shape));
  if (
    previous.every(Number.isFinite) &&
    rings.some((ring) => inside(previous, ring))
  )
    return clone(previous);
  const points = [...rings].sort(
    (a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)),
  )[0];
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const center: Point = [(minX + maxX) / 2, (minY + maxY) / 2];
  if (inside(center, points)) return center;
  // Concave flower beds may have their centroid outside the planted region.
  const candidates: Point[] = [];
  for (let x = 1; x < 20; x++)
    for (let y = 1; y < 20; y++) {
      const point: Point = [
        minX + ((maxX - minX) * x) / 20,
        minY + ((maxY - minY) * y) / 20,
      ];
      if (inside(point, points)) candidates.push(point);
    }
  candidates.sort(
    (a, b) =>
      Math.hypot(a[0] - center[0], a[1] - center[1]) -
      Math.hypot(b[0] - center[0], b[1] - center[1]),
  );
  return candidates[0] ?? clone(points[0]);
}
