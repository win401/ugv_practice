import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useGardenZoneEditor } from "./useGardenZoneEditor";
import type { DetailMapData, DetailPlan } from "../api/gardenDetail";

/** Shared visual planning for both maps. Never writes operational data. */
export function useGardenDetail(scopeId: string, blocked = false) {
  const [baseData, setBaseData] = useState<DetailMapData | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [plan, setPlan] = useState<DetailPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const editor = useGardenZoneEditor(
    baseData,
    scopeId,
    blocked,
    invalidatePlan,
  );
  const data = editor.data;
  const [message, setMessage] = useState(
    "지도나 목록에서 관수할 구역을 선택하세요. 여러 구역을 함께 고를 수 있습니다.",
  );
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [cameraReset, setCameraReset] = useState(0);
  const [focusRobot, setFocusRobot] = useState(0);
  const request = useRef(0);
  const mounted = useRef(true);
  function invalidatePlan() {
    request.current++;
    setPlan(null);
    setPlanning(false);
    setMessage("구역을 확인한 뒤 경로를 다시 미리 확인하세요.");
  }
  useEffect(() => {
    mounted.current = true;
    api.gardenDetail.read().then(
      (next) => {
        if (mounted.current) setBaseData(next);
      },
      () => {
        if (mounted.current)
          setError("정원 상세를 불러오지 못했습니다. 새로고침해 주세요.");
      },
    );
    return () => {
      mounted.current = false;
      request.current++;
    };
  }, [api.gardenDetail.read]);

  // Only a new image coordinate system invalidates the shared plan.
  useEffect(() => {
    request.current++;
    setSelectedIds([]);
    setPlan(null);
    setPlanning(false);
    setZoom(1);
    setCameraReset((n) => n + 1);
    setFocusRobot(0);
    setError(null);
    setMessage(
      "지도나 목록에서 관수할 구역을 선택하세요. 여러 구역을 함께 고를 수 있습니다.",
    );
  }, [data?.imageRevision]);

  // A new mission supersedes any preview. Keep its last position after it ends.
  useEffect(() => {
    if (!blocked) return;
    request.current++;
    setPlanning(false);
    setPlan(null);
    setMessage(
      "관수 작업이 진행 중입니다. 경로 미리보기는 작업 종료 후 사용할 수 있습니다.",
    );
  }, [blocked]);
  function select(ids: string[]) {
    if (editor.draft) return;
    request.current++;
    setSelectedIds(ids);
    setPlan(null);
    setPlanning(false);
    setError(null);
    setMessage(
      ids.length
        ? "선택한 구역이 바뀌었습니다. 경로를 다시 미리 확인하세요."
        : "지도나 목록에서 관수할 구역을 선택하세요. 여러 구역을 함께 고를 수 있습니다.",
    );
  }
  function toggle(id: string) {
    if (!data?.zones.some((zone) => zone.id === id)) return;
    select(
      selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id],
    );
  }
  const hasUnmappedSelection = selectedIds.some(
    (id) => data?.zones.find((zone) => zone.id === id)?.stopNode === null,
  );
  async function preview() {
    if (!selectedIds.length || planning || blocked || editor.draft) return;
    if (hasUnmappedSelection) {
      setError(
        "새 구역의 관수 접근 지점이 아직 연결되지 않았습니다. 경로가 연결된 구역만 선택해 주세요.",
      );
      return;
    }
    const version = ++request.current;
    setPlanning(true);
    setError(null);
    setPlan(null);
    setMessage("정원 안의 길을 따라 관수 지점을 연결하고 있습니다.");
    try {
      const next = await api.gardenDetail.preview(selectedIds);
      if (!mounted.current || version !== request.current) return;
      setPlan(next);
      setMessage(
        "파란 점선은 예정 경로입니다. UGV 위치와 상태는 장비 보고에 따라 표시됩니다.",
      );
    } catch (reason) {
      if (!mounted.current || version !== request.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "경로를 준비하지 못했습니다.",
      );
    } finally {
      if (mounted.current && version === request.current) setPlanning(false);
    }
  }
  return {
    data,
    editor,
    selectedIds,
    hasUnmappedSelection,
    plan,
    planning,
    illustrationData: baseData,
    message,
    error,
    zoom,
    setZoom,
    cameraReset,
    focusRobot,
    toggle,
    select,
    preview,
    fit: () => {
      setZoom(1);
      setCameraReset((n) => n + 1);
    },
    locate: () => setFocusRobot((n) => n + 1),
  };
}

export type GardenDetailState = ReturnType<typeof useGardenDetail>;
