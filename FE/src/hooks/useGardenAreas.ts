import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { GardenArea, GeoPoint } from "../api/gardenAreas";

export function useGardenAreas(scopeId: string) {
  const [areas, setAreas] = useState<GardenArea[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [name, setName] = useState("");
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(false);
  const pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    api.gardenAreas
      .list(scopeId)
      .then((items) => {
        if (!mounted.current) return;
        setAreas(items);
        setSelectedId((id) =>
          items.some((a) => a.id === id) ? id : (items[0]?.id ?? null),
        );
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!mounted.current) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "정원 구역을 불러오지 못했습니다.",
        );
        setLoading(false);
      });
    return () => {
      mounted.current = false;
    };
  }, [scopeId]);
  const dirty = drawing && (name.trim().length > 0 || points.length > 0);
  function cancel() {
    if (pending.current) return;
    setDrawing(false);
    setError(null);
    setName("");
    setPoints([]);
    setMessage("");
  }
  function start() {
    setDrawing(true);
    setName("");
    setPoints([]);
    setError(null);
    setMessage("");
  }
  function addPoint(point: GeoPoint) {
    if (!drawing || pending.current) return;
    setPoints((current) =>
      current.length < 30 ? [...current, point] : current,
    );
    setError(null);
  }
  async function save(): Promise<GardenArea | null> {
    if (!drawing || pending.current) return null;
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      const item = await api.gardenAreas.create(scopeId, {
        name,
        boundary: points,
      });
      if (!mounted.current) return null;
      setAreas((current) => [...current, item]);
      setSelectedId(item.id);
      setDrawing(false);
      setName("");
      setPoints([]);
      setMessage(
        `${item.name} 구역을 저장했습니다. 목록에서 구역의 지도 위치를 확인할 수 있습니다.`,
      );
      return item;
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "구역을 저장하지 못했습니다.",
        );
      return null;
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  async function remove(id: string) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      await api.gardenAreas.remove(scopeId, id);
      if (!mounted.current) return;
      const next = areas.filter((a) => a.id !== id);
      setAreas(next);
      setSelectedId((current) =>
        current === id ? (next[0]?.id ?? null) : current,
      );
      setMessage("정원 구역을 삭제했습니다.");
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "구역을 삭제하지 못했습니다.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return {
    areas,
    selectedId,
    selected: areas.find((a) => a.id === selectedId) ?? null,
    select: setSelectedId,
    loading,
    error,
    drawing,
    name,
    setName,
    points,
    saving,
    message,
    dirty,
    start,
    cancel,
    addPoint,
    save,
    remove,
    undo: () => {
      if (!pending.current) {
        setPoints((p) => p.slice(0, -1));
        setError(null);
      }
    },
    clear: () => {
      if (!pending.current) {
        setPoints([]);
        setError(null);
      }
    },
  };
}
export type GardenAreasState = ReturnType<typeof useGardenAreas>;
