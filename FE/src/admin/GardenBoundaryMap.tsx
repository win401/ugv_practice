import {
  ChartSpline,
  CirclePlus,
  MousePointer2,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Point } from "../api/gardenDetail";
import type { GardenGeo } from "../api/types";
import {
  boundaryPreview,
  gardenGeoFromShape,
  planeAt,
  PLANE_ZOOM,
  shapeFromGardenGeo,
  type Plane,
} from "../lib/gardenBoundary";
import { suncheonMapConfig, vworldApiKey } from "../lib/vworldMap";
import {
  convertZoneSegmentToCurve,
  findClosestZoneBoundaryPoint,
  getZoneBoundaryHandles,
  insertZoneBoundaryPoint,
  moveZoneBoundaryHandle,
  polygonShapeFromPoints,
  validateZoneShape,
} from "../lib/zoneGeometry";

/**
 * 위성지도에 정원 경계를 그리는 지도.
 * 1) 지도를 눌러 꼭짓점을 찍고 "경계 닫기"로 닫는다.
 * 2) 닫은 뒤에는 점을 끌어 옮기거나(점 선택), 선 위에 점을 더하거나(점 추가),
 *    선을 눌러 곡선으로 바꾼다(곡선). 곡선은 보라색 조절점으로 모양을 잡는다.
 * 경계 계산은 관수 구역 편집과 같은 것(lib/zoneGeometry)을 쓴다.
 * 저장된 경계(initial)를 주면 그 경계가 그려진 채로 열리고, 고치면 원래 경계를 흰 점선으로 남긴다.
 */

type Tool = "select" | "add" | "curve";
/**
 * 닫기 전에는 찍은 점들(draft), 닫은 뒤에는 경계(shape)를 가진다. 좌표는 평면 좌표다.
 * origin 은 평면의 기준점 [경도, 위도]로, 첫 점을 찍은 자리다. 기준점이 가까워야 좌표 숫자가 작다.
 * 되돌리기로 예전 경계로 돌아가도 그 경계의 기준점을 쓰도록 함께 기록한다.
 */
type Drawing = { origin: Point | null; draft: Point[]; shape: string | null };
const EMPTY: Drawing = { origin: null, draft: [], shape: null };
/** 선이나 첫 점을 눌렀다고 보는 거리(화면 화소) */
const HIT = 14;

export type BoundaryValue = {
  geo: GardenGeo | null;
  /** 경계로 계산한 넓이(m²). 경계가 없으면 0 */
  area: number;
  /** 저장할 수 없는 이유. 없으면 빈 글자 */
  problem: string;
  /** 처음 열었을 때의 경계에서 바뀌었는지. 새로 그리는 지도에서는 무언가 그렸는지다. */
  edited: boolean;
};

const message = (e: unknown) =>
  e instanceof Error ? e.message : "경계를 처리하지 못했습니다.";

/** 처음 보여 줄 경계. 저장된 경계를 읽지 못하면 빈 지도로 열고 이유를 알린다. */
function startDrawing(initial?: GardenGeo): {
  drawing: Drawing;
  problem: string;
} {
  if (!initial) return { drawing: EMPTY, problem: "" };
  try {
    const { origin, shape } = shapeFromGardenGeo(initial);
    return { drawing: { origin, draft: [], shape }, problem: "" };
  } catch (e) {
    return { drawing: EMPTY, problem: message(e) };
  }
}

export default function GardenBoundaryMap({
  focus,
  initial,
  onChange,
}: {
  /** 지도를 옮길 위치 [위도, 경도]. 주소를 고르면 바뀐다. */
  focus: [number, number] | null;
  /** 고칠 때의 저장된 경계. 없으면 빈 지도에서 새로 그린다. 처음 한 번만 읽는다. */
  initial?: GardenGeo;
  onChange: (value: BoundaryValue) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const outline = useRef<L.LayerGroup | null>(null);
  const handles = useRef<L.LayerGroup | null>(null);
  // 고치기 전 경계(흰 점선). 저장된 경계를 고칠 때만 있다.
  const before = useRef<L.Polygon | null>(null);
  const [start] = useState(() => startDrawing(initial));
  // 되돌리기·다시 실행을 위한 기록. at 은 지금 보고 있는 자리다. 맨 앞은 처음 열었을 때의 경계다.
  const [history, setHistory] = useState<{ list: Drawing[]; at: number }>({
    list: [start.drawing],
    at: 0,
  });
  const [tool, setTool] = useState<Tool>("select");
  const [notice, setNotice] = useState(start.problem);
  const drawing = history.list[history.at];
  const edited = drawing !== history.list[0];
  // 지도 이벤트는 처음 한 번만 걸어 두므로, 최신 값은 여기서 읽는다.
  const latest = useRef({ drawing, tool });
  latest.current = { drawing, tool };
  const report = useRef(onChange);
  report.current = onChange;

  const commit = (next: Drawing) => {
    setNotice("");
    setHistory((h) => ({
      list: [...h.list.slice(0, h.at + 1), next],
      at: h.at + 1,
    }));
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;

  // 지도는 한 번만 만든다.
  useEffect(() => {
    if (!canvas.current || !vworldApiKey) return;
    const instance = L.map(canvas.current, {
      center: suncheonMapConfig.center,
      zoom: 17,
      minZoom: suncheonMapConfig.minZoom,
      maxZoom: suncheonMapConfig.maxZoom,
      attributionControl: false,
      doubleClickZoom: false,
    });
    L.tileLayer(suncheonMapConfig.tileUrl(vworldApiKey), {
      minZoom: suncheonMapConfig.minZoom,
      maxZoom: suncheonMapConfig.maxZoom,
      maxNativeZoom: suncheonMapConfig.maxNativeZoom,
      noWrap: true,
    }).addTo(instance);
    outline.current = L.layerGroup().addTo(instance);
    handles.current = L.layerGroup().addTo(instance);
    map.current = instance;
    // 저장된 경계를 고칠 때는 그 경계가 화면에 꽉 차게 연다. 원래 경계는 고친 뒤에만 보여 준다.
    if (initial) {
      before.current = L.polygon(
        initial.geojson.coordinates[0].map(
          ([lng, lat]): L.LatLngTuple => [lat, lng],
        ),
        { className: "adm-geo-before", interactive: false },
      );
      instance.fitBounds(before.current.getBounds(), {
        padding: [32, 32],
        maxZoom: suncheonMapConfig.maxNativeZoom,
      });
    }

    // 평면 좌표의 거리를 지금 확대 단계의 화면 화소로 바꾼다.
    const toScreen = (distance: number) =>
      distance * 2 ** (instance.getZoom() - PLANE_ZOOM);

    instance.on("click", (event: L.LeafletMouseEvent) => {
      const { drawing: now, tool: mode } = latest.current;
      const position: Point = [event.latlng.lng, event.latlng.lat];
      // 첫 점을 찍는 자리를 기준점으로 삼는다.
      const origin = now.origin ?? position;
      const current = planeAt(origin);
      try {
        if (!now.shape) {
          const point = current.project(position);
          const first = now.draft[0];
          const nearFirst =
            now.draft.length >= 3 &&
            toScreen(Math.hypot(point[0] - first[0], point[1] - first[1])) <=
              HIT;
          commitRef.current(
            nearFirst
              ? { origin, draft: [], shape: polygonShapeFromPoints(now.draft) }
              : { origin, draft: [...now.draft, point], shape: null },
          );
          return;
        }
        if (mode === "select") return;
        const hit = findClosestZoneBoundaryPoint(
          now.shape,
          current.project(position),
        );
        if (!hit || toScreen(hit.distance) > HIT) {
          setNotice("경계선 위를 눌러 주세요.");
          return;
        }
        commitRef.current({
          origin,
          draft: [],
          shape:
            mode === "add"
              ? insertZoneBoundaryPoint(now.shape, hit.segmentId, hit.t).shape
              : convertZoneSegmentToCurve(now.shape, hit.segmentId),
        });
        // 곡선으로 바꾼 뒤에는 바로 보라색 조절점을 끌어 모양을 잡을 수 있게 한다.
        if (mode === "curve") setTool("select");
      } catch (e) {
        setNotice(message(e));
      }
    });
    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  // 주소를 고르면 그 위치로 옮긴다.
  useEffect(() => {
    if (focus) map.current?.setView(focus, 18);
  }, [focus]);

  // 경계가 바뀔 때마다 다시 그리고, 저장할 수 있는 모양인지 알린다.
  useEffect(() => {
    const instance = map.current;
    const outlineGroup = outline.current;
    const handleGroup = handles.current;
    if (!instance || !outlineGroup || !handleGroup) return;
    const toLatLng = ([lng, lat]: Point): L.LatLngTuple => [lat, lng];
    const current: Plane | null = drawing.origin
      ? planeAt(drawing.origin)
      : null;

    const drawOutline = (shape: string) => {
      outlineGroup.clearLayers();
      if (!current) return;
      L.polygon(boundaryPreview(shape, current).map(toLatLng), {
        className: "adm-geo-outline",
        interactive: false,
      }).addTo(outlineGroup);
      // 곡선 조절점과 그 점이 붙은 꼭짓점을 잇는 안내선
      for (const handle of getZoneBoundaryHandles(shape))
        if (handle.kind === "control" && handle.anchor)
          L.polyline(
            [handle.anchor, handle.point].map((p) =>
              toLatLng(current.unproject(p)),
            ),
            { className: "adm-geo-guide", interactive: false },
          ).addTo(outlineGroup);
    };

    outlineGroup.clearLayers();
    handleGroup.clearLayers();
    if (before.current) {
      if (edited) before.current.addTo(instance).bringToBack();
      else before.current.remove();
    }
    const icon = (kind: string) =>
      L.divIcon({
        className: `adm-geo-handle adm-geo-${kind}`,
        iconSize: [18, 18],
      });

    if (!drawing.shape || !current) {
      if (current && drawing.draft.length) {
        const points = drawing.draft.map((p) => toLatLng(current.unproject(p)));
        L.polyline(points, {
          className: "adm-geo-outline",
          interactive: false,
        }).addTo(outlineGroup);
        points.forEach((point, index) =>
          L.marker(point, {
            icon: icon(index === 0 ? "first" : "anchor"),
            interactive: false,
            keyboard: false,
          }).addTo(handleGroup),
        );
      }
      report.current({ geo: null, area: 0, problem: "", edited });
      return;
    }

    const shape = drawing.shape;
    const origin = drawing.origin;
    drawOutline(shape);
    for (const handle of getZoneBoundaryHandles(shape)) {
      const marker = L.marker(toLatLng(current.unproject(handle.point)), {
        icon: icon(handle.kind),
        // 어느 도구를 고른 상태든 점은 끌 수 있다. 점을 끄는 동안에는 지도가 움직이지 않는다.
        draggable: true,
        keyboard: false,
      }).addTo(handleGroup);
      const moved = () => {
        const { lat, lng } = marker.getLatLng();
        return moveZoneBoundaryHandle(
          shape,
          handle.id,
          current.project([lng, lat]),
        );
      };
      // 끄는 동안에는 선만 다시 그리고, 놓았을 때 기록에 남긴다.
      marker.on("drag", () => {
        try {
          drawOutline(moved());
        } catch {
          // 끄는 도중의 잘못된 모양은 놓을 때 알린다.
        }
      });
      marker.on("dragend", () => {
        try {
          commitRef.current({ origin, draft: [], shape: moved() });
        } catch (e) {
          setNotice(message(e));
          drawOutline(shape);
          marker.setLatLng(toLatLng(current.unproject(handle.point)));
        }
      });
    }
    try {
      validateZoneShape(shape);
      report.current({
        ...gardenGeoFromShape(shape, current),
        problem: "",
        edited,
      });
    } catch (e) {
      report.current({ geo: null, area: 0, problem: message(e), edited });
    }
  }, [drawing, tool]);

  const closable = !drawing.shape && drawing.draft.length >= 3;
  const close = () => {
    try {
      commit({
        origin: drawing.origin,
        draft: [],
        shape: polygonShapeFromPoints(drawing.draft),
      });
    } catch (e) {
      setNotice(message(e));
    }
  };
  const step = (by: number) => {
    setNotice("");
    setHistory((h) => ({ ...h, at: h.at + by }));
  };
  const toolButton = (id: Tool, label: string, Icon: typeof Undo2) => (
    <button
      type="button"
      className={tool === id ? "active" : undefined}
      aria-pressed={tool === id}
      disabled={!drawing.shape}
      onClick={() => {
        setTool(id);
        setNotice("");
      }}
    >
      <Icon size={14} /> {label}
    </button>
  );

  const guide = !drawing.shape
    ? drawing.draft.length < 3
      ? "지도를 눌러 경계의 꼭짓점을 3개 이상 찍어 주세요."
      : "꼭짓점을 더 찍거나, 첫 점 또는 경계 닫기를 눌러 닫아 주세요."
    : tool === "select"
      ? "점을 끌어 옮깁니다. 보라색 점은 곡선의 모양을 잡는 조절점입니다."
      : tool === "add"
        ? "경계선 위를 누르면 그 자리에 점이 생깁니다."
        : "곡선으로 바꿀 경계선을 누르면 보라색 점이 생깁니다. 그 점을 끌어 모양을 잡습니다.";

  return (
    <div className="adm-geo">
      <div
        className="adm-geo-tools"
        role="toolbar"
        aria-label="경계 그리기 도구"
      >
        <div className="adm-geo-toolset">
          {toolButton("select", "점 선택", MousePointer2)}
          {toolButton("add", "점 추가", CirclePlus)}
          {toolButton("curve", "곡선", ChartSpline)}
        </div>
        <button type="button" disabled={!closable} onClick={close}>
          경계 닫기
        </button>
        <span className="adm-geo-spacer" />
        <button
          type="button"
          aria-label="되돌리기"
          title="되돌리기"
          disabled={history.at === 0}
          onClick={() => step(-1)}
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          aria-label="다시 실행"
          title="다시 실행"
          disabled={history.at >= history.list.length - 1}
          onClick={() => step(1)}
        >
          <Redo2 size={14} />
        </button>
        <button
          type="button"
          aria-label="경계 지우기"
          title="경계 지우기"
          disabled={!drawing.shape && !drawing.draft.length}
          onClick={() => {
            setTool("select");
            commit(EMPTY);
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="adm-geo-frame">
        {vworldApiKey ? (
          <div
            ref={canvas}
            className={`adm-geo-canvas${drawing.shape && tool === "select" ? "" : " adm-geo-pick"}`}
            aria-label="정원 경계를 그리는 위성지도"
          />
        ) : (
          <p className="adm-geo-missing">
            지도 인증키가 없어 위성지도를 불러올 수 없습니다. FE/.env.local 의
            VITE_VWORLD_API_KEY 를 확인해 주세요.
          </p>
        )}
        <a
          className="adm-geo-attribution"
          href="https://www.vworld.kr/"
          target="_blank"
          rel="noopener noreferrer"
        >
          공간정보 오픈플랫폼(브이월드)
        </a>
      </div>
      <p className={notice ? "adm-geo-notice" : undefined} role="status">
        {notice || guide}
      </p>
    </div>
  );
}
