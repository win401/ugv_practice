import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { DetailMapData, DetailZone, Point } from "../api/gardenDetail";
import {
  gardenZoneEditsStorageKey,
  legacyGardenZoneEditsStorageKey,
  imageGardenZoneEditsStorageKey,
  defaultGardenZoneEdits,
  exportGardenZoneFeatureCollection,
  type GardenZoneEditsSnapshot,
} from "../api/gardenZoneEdits";
import {
  convertZoneSegmentToCurve,
  insertZoneBoundaryPoint,
  labelForZoneShape,
  moveZoneBoundaryHandle,
  polygonShapeFromPoints,
} from "../lib/zoneGeometry";

const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "구역 변경 내용을 처리하지 못했습니다.";

/** Drafts are local; the async API adapter owns persistence and DTO conversion. */
export function useGardenZoneEditor(
  base: DetailMapData | null,
  scopeId: string,
  blocked: boolean,
  invalidatePlan: () => void,
) {
  const [snapshot, setSnapshot] = useState<GardenZoneEditsSnapshot | null>(
    null,
  );
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<DetailZone | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const drawingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);
  const drawingFuture = useRef<Point[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const epoch = useRef(0);
  const readRequest = useRef(0);
  const [tool, setTool] = useState<"select" | "add" | "curve">("select");
  const [, setHistoryVersion] = useState(0);
  const history = useRef<{
    past: string[];
    future: string[];
    start: string | null;
  }>({ past: [], future: [], start: null });
  const original = useRef<DetailZone | null>(null);
  const expectedRevision = useRef("");
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  const invalidate = useRef(invalidatePlan);
  invalidate.current = invalidatePlan;
  const key = base ? gardenZoneEditsStorageKey(scopeId, base.mapId) : null;

  function updateDraft(next: DetailZone | null) {
    currentDraft.current = next;
    setDraft(next);
  }
  function updatePoints(next: Point[]) {
    pointsRef.current = next;
    setDrawingPoints(next);
  }
  function updateDrawing(value: boolean) {
    drawingRef.current = value;
    setDrawing(value);
  }
  function clearHistory() {
    history.current = { past: [], future: [], start: null };
    drawingFuture.current = [];
    setHistoryVersion((value) => value + 1);
    setTool("select");
  }
  function clearPointSelection() {
    window.dispatchEvent(new CustomEvent("garden-boundary-clear-selection"));
  }
  function remember(shape: string) {
    history.current.past = [...history.current.past, shape].slice(-100);
    history.current.future = [];
    setHistoryVersion((value) => value + 1);
  }
  function updateShape(shape: string) {
    const current = currentDraft.current;
    if (!current || current.shape === shape) return;
    if (history.current.start === null) remember(current.shape);
    updateDraft({ ...current, shape });
    setEditError(null);
  }
  function startMove() {
    if (
      blocked ||
      pending.current ||
      !currentDraft.current ||
      history.current.start !== null
    )
      return;
    history.current.start = currentDraft.current.shape;
  }
  function endMove() {
    const start = history.current.start;
    history.current.start = null;
    if (
      start !== null &&
      currentDraft.current &&
      start !== currentDraft.current.shape
    )
      remember(start);
  }
  function undo() {
    const current = currentDraft.current;
    if (
      blocked ||
      pending.current ||
      !current ||
      history.current.start !== null
    )
      return;
    if (drawingRef.current) {
      const last = pointsRef.current.at(-1);
      if (last) {
        drawingFuture.current.push(last);
        updatePoints(pointsRef.current.slice(0, -1));
      }
      setEditError(null);
      return;
    }
    const previous = history.current.past.pop();
    if (previous === undefined) return;
    history.current.future.push(current.shape);
    updateDraft({ ...current, shape: previous });
    setHistoryVersion((value) => value + 1);
    setEditError(null);
    clearPointSelection();
  }
  function redo() {
    const current = currentDraft.current;
    if (
      blocked ||
      pending.current ||
      !current ||
      history.current.start !== null
    )
      return;
    if (drawingRef.current) {
      const next = drawingFuture.current.pop();
      if (next) updatePoints([...pointsRef.current, next]);
      setEditError(null);
      return;
    }
    const next = history.current.future.pop();
    if (next === undefined) return;
    history.current.past.push(current.shape);
    updateDraft({ ...current, shape: next });
    setHistoryVersion((value) => value + 1);
    setEditError(null);
    clearPointSelection();
  }

  async function loadLatest(source: DetailMapData, version = epoch.current) {
    const request = ++readRequest.current;
    const sourceKey = gardenZoneEditsStorageKey(scopeId, source.mapId);
    try {
      const next = await api.gardenZones.read(scopeId, source);
      if (version !== epoch.current || request !== readRequest.current)
        return false;
      setSnapshot(next);
      setLoadedKey(sourceKey);
      setLoadError(null);
      return true;
    } catch (error) {
      if (version !== epoch.current || request !== readRequest.current)
        return false;
      setSnapshot(defaultGardenZoneEdits(scopeId, source));
      setLoadedKey(sourceKey);
      setLoadError(`${messageOf(error)} 구역 저장을 잠갔습니다.`);
      return false;
    }
  }
  useEffect(() => {
    const version = ++epoch.current;
    pending.current = false;
    setSaving(false);
    setLoadedKey(null);
    setSnapshot(null);
    setLoadError(null);
    updateDraft(null);
    updateDrawing(false);
    updatePoints([]);
    setIsNew(false);
    clearHistory();
    original.current = null;
    setEditError(null);
    setNotice(null);
    if (!base || !key) return;
    void loadLatest(base, version);
    const legacyKey = legacyGardenZoneEditsStorageKey(
      scopeId,
      base.imageRevision,
    );
    const imageKey = imageGardenZoneEditsStorageKey(
      scopeId,
      base.imageRevision,
      base.mapId,
    );
    const onStorage = (event: StorageEvent) => {
      if (
        event.key !== key &&
        event.key !== imageKey &&
        event.key !== legacyKey &&
        event.key !== null
      )
        return;
      if (currentDraft.current || pending.current) {
        setEditError(
          "다른 탭에서 구역이 변경되었습니다. 저장 충돌을 피하려면 편집을 취소하고 최신 내용을 확인해 주세요.",
        );
        return;
      }
      void loadLatest(base, version).then((ok) => {
        if (ok) {
          setNotice("다른 탭에서 저장한 구역을 반영했습니다.");
          invalidate.current();
        }
      });
    };
    window.addEventListener("storage", onStorage);
    return () => {
      epoch.current++;
      window.removeEventListener("storage", onStorage);
    };
  }, [base, key, scopeId]);

  const data = useMemo(() => {
    if (!base || !snapshot || key !== loadedKey) return null;
    const zones = snapshot.zones.map((zone) =>
      zone.id === draft?.id && !drawing ? draft : zone,
    );
    if (isNew && draft?.shape && !drawing) zones.push(draft);
    return { ...base, zones };
  }, [base, snapshot, key, loadedKey, draft, drawing, isNew]);
  const dirty =
    !!draft &&
    (isNew ||
      (!!original.current &&
        (draft.name !== original.current.name ||
          draft.shape !== original.current.shape)));

  function begin(id: string) {
    if (
      blocked ||
      pending.current ||
      loadError ||
      currentDraft.current ||
      !snapshot ||
      !data
    )
      return;
    const zone = snapshot.zones.find((item) => item.id === id);
    if (!zone) return;
    readRequest.current++;
    const copy = { ...zone, label: [...zone.label] as Point };
    original.current = copy;
    expectedRevision.current = snapshot.revision;
    updateDraft(copy);
    setIsNew(false);
    updateDrawing(false);
    updatePoints([]);
    clearHistory();
    setEditError(null);
    setNotice(null);
    invalidate.current();
  }
  function startNew() {
    if (
      blocked ||
      pending.current ||
      loadError ||
      currentDraft.current ||
      !snapshot ||
      !data
    )
      return;
    readRequest.current++;
    original.current = null;
    expectedRevision.current = snapshot.revision;
    updateDraft({
      id: "new-zone-draft",
      letter: "새",
      name: "",
      description: "관수 접근 지점 미연결",
      shape: "",
      label: [0, 0],
      stopNode: null,
      origin: "custom",
    });
    setIsNew(true);
    updateDrawing(true);
    updatePoints([]);
    clearHistory();
    setEditError(null);
    setNotice(null);
    invalidate.current();
  }
  function addDrawingPoint(point: Point) {
    if (
      !base ||
      blocked ||
      pending.current ||
      !drawingRef.current ||
      !currentDraft.current
    )
      return;
    if (!point.every(Number.isFinite)) {
      setEditError("전체 지도에서 경계 점을 찍어 주세요.");
      return;
    }
    if (pointsRef.current.length >= 100) {
      setEditError("새 구역은 최대 100개의 점으로 그릴 수 있습니다.");
      return;
    }
    if (
      pointsRef.current.some(
        (p) => Math.hypot(p[0] - point[0], p[1] - point[1]) < 0.01,
      )
    ) {
      setEditError(
        "같은 위치에 점이 있습니다. 시작점을 눌러 경계를 닫을 수 있습니다.",
      );
      return;
    }
    updatePoints([...pointsRef.current, [...point] as Point]);
    drawingFuture.current = [];
    setEditError(null);
  }
  function finishDrawing() {
    const current = currentDraft.current;
    if (!base || blocked || pending.current || !drawingRef.current || !current)
      return false;
    try {
      const shape = polygonShapeFromPoints(pointsRef.current);
      updateDraft({
        ...current,
        shape,
        label: labelForZoneShape(shape, pointsRef.current[0]),
      });
      updateDrawing(false);
      clearHistory();
      setEditError(null);
      return true;
    } catch (error) {
      setEditError(messageOf(error));
      return false;
    }
  }
  function setName(name: string) {
    if (blocked || pending.current) return;
    const current = currentDraft.current;
    if (current) updateDraft({ ...current, name });
    setEditError(null);
  }
  function moveHandle(id: string, point: Point) {
    const current = currentDraft.current;
    if (blocked || pending.current || !current || drawingRef.current) return;
    try {
      updateShape(moveZoneBoundaryHandle(current.shape, id, point));
    } catch (error) {
      setEditError(messageOf(error));
    }
  }
  function insertPoint(segmentId: string, t: number): string | null {
    const current = currentDraft.current;
    if (blocked || pending.current || !current || drawingRef.current)
      return null;
    try {
      const result = insertZoneBoundaryPoint(current.shape, segmentId, t);
      updateShape(result.shape);
      return result.handleId;
    } catch (error) {
      setEditError(messageOf(error));
      return null;
    }
  }
  function convertSegment(segmentId: string) {
    const current = currentDraft.current;
    if (blocked || pending.current || !current || drawingRef.current) return;
    try {
      updateShape(convertZoneSegmentToCurve(current.shape, segmentId));
    } catch (error) {
      setEditError(messageOf(error));
    }
  }

  async function save(): Promise<boolean> {
    const current = currentDraft.current;
    if (
      !base ||
      !current ||
      !dirty ||
      pending.current ||
      loadError ||
      drawingRef.current
    )
      return false;
    if (blocked) {
      setEditError(
        "관수 작업이 진행 중입니다. 작업 종료 후 구역을 저장해 주세요.",
      );
      return false;
    }
    readRequest.current++;
    pending.current = true;
    setSaving(true);
    const version = epoch.current;
    try {
      const next = isNew
        ? await api.gardenZones.create(
            scopeId,
            base,
            { name: current.name, shape: current.shape },
            expectedRevision.current,
          )
        : await api.gardenZones.update(
            scopeId,
            base,
            current,
            expectedRevision.current,
          );
      if (epoch.current !== version) return false;
      setSnapshot(next);
      updateDraft(null);
      updateDrawing(false);
      updatePoints([]);
      clearHistory();
      original.current = null;
      setEditError(null);
      setNotice(
        isNew
          ? "새 구역과 GeoJSON을 이 브라우저에 저장했습니다. 관수 경로는 접근 지점을 연결한 뒤 사용할 수 있습니다."
          : "구역과 GeoJSON을 이 브라우저에 저장했습니다. 관수 접근 지점은 그대로이므로 경로를 다시 확인해 주세요.",
      );
      setIsNew(false);
      invalidate.current();
      return true;
    } catch (error) {
      if (epoch.current === version) setEditError(messageOf(error));
      return false;
    } finally {
      if (epoch.current === version) {
        pending.current = false;
        setSaving(false);
      }
    }
  }
  function cancel() {
    if (pending.current) return;
    updateDraft(null);
    updateDrawing(false);
    updatePoints([]);
    setIsNew(false);
    clearHistory();
    original.current = null;
    setEditError(null);
    if (base) void loadLatest(base);
    setNotice("편집을 취소했습니다. 저장된 구역을 표시합니다.");
    invalidate.current();
  }
  function resetBoundary() {
    if (blocked || pending.current || !currentDraft.current) return;
    if (isNew) {
      updateDraft({ ...currentDraft.current, shape: "" });
      updateDrawing(true);
      updatePoints([]);
      clearHistory();
    } else if (original.current) updateShape(original.current.shape);
    clearPointSelection();
    setEditError(null);
  }
  function exportGeoJSON() {
    if (!snapshot || loadError || currentDraft.current || pending.current)
      return;
    try {
      const collection = exportGardenZoneFeatureCollection(snapshot);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(collection, null, 2)], {
          type: "application/geo+json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${base?.mapId ?? "garden"}-zones.geojson`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        "저장된 구역을 GeoJSON으로 내보냈습니다. 기존 예시 경계는 파일 속성에서 확인할 수 있습니다.",
      );
    } catch (error) {
      setEditError(messageOf(error));
    }
  }

  const shortcuts = useRef({ blocked, undo, redo, finishDrawing });
  shortcuts.current = { blocked, undo, redo, finishDrawing };
  useEffect(() => {
    if (!draft) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        (target instanceof Element &&
          target.closest(
            'input, textarea, select, [contenteditable="true"], [role="textbox"]',
          )) ||
        document.querySelector('[role="dialog"], [role="alertdialog"]') ||
        shortcuts.current.blocked ||
        pending.current
      )
        return;
      const key = event.key.toLowerCase();
      if (event.metaKey || event.ctrlKey) {
        if (key === "z" || key === "y") {
          event.preventDefault();
          if (key === "y" || event.shiftKey) shortcuts.current.redo();
          else shortcuts.current.undo();
        }
        return;
      }
      if (drawingRef.current) {
        if (
          key === "enter" &&
          target instanceof Element &&
          target.closest('button, a, [role="button"], [role="tab"]')
        )
          return;
        if (key === "enter") {
          event.preventDefault();
          shortcuts.current.finishDrawing();
        }
        if (key === "backspace") {
          event.preventDefault();
          shortcuts.current.undo();
        }
        return;
      }
      if (["v", "p", "c", "escape"].includes(key)) {
        event.preventDefault();
        setTool(key === "p" ? "add" : key === "c" ? "curve" : "select");
        if (key === "escape") clearPointSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [!!draft]);

  return {
    data,
    draft,
    dirty,
    saving,
    isNew,
    drawing,
    drawingPoints,
    tool,
    setTool,
    canUndo: drawing
      ? drawingPoints.length > 0
      : history.current.past.length > 0,
    canRedo: drawing
      ? drawingFuture.current.length > 0
      : history.current.future.length > 0,
    undo,
    redo,
    startMove,
    endMove,
    insertPoint,
    convertSegment,
    startNew,
    addDrawingPoint,
    finishDrawing,
    exportGeoJSON,
    blocked,
    error: editError ?? loadError,
    notice,
    storageUnavailable: !!loadError,
    begin,
    setName,
    moveHandle,
    save,
    cancel,
    resetBoundary,
  };
}
export type GardenZoneEditorState = ReturnType<typeof useGardenZoneEditor>;
