import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AlertCircle, ArrowUpRight, MapPinned, RotateCw } from "lucide-react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/suncheon-map.css";
import { suncheonMapConfig } from "../lib/vworldMap";
import type { GardenArea } from "../api/gardenAreas";
import GeographicGardenLayer from "./GeographicGardenLayer";
import { gardenImageToLatLng } from "../lib/gardenGeoFrame";
import type { Point } from "../api/gardenDetail";
import type { GardenMapSceneProps } from "../types/gardenMap";
import { prefersReducedMapMotion } from "../lib/mapCameraMotion";
import { GARDEN_IMAGE } from "../lib/gardenImage";
import {
  GARDEN_DETAIL_ZOOM,
  measureGardenFrame,
  gardenFrameCenter,
  fittedGardenCamera,
  boundedGardenCamera,
} from "../lib/gardenCamera";

export interface SuncheonMapHandle {
  zoomIn(): void;
  zoomOut(): void;
  fitGarden(): void;
  focusArea(id: string): void;
  focusIllustration(): void;
  focusVehicle(point: Point): void;
}
type Props = {
  apiKey: string;
  onZoomChange: (zoom: number) => void;
  onOpenDetail?: () => void;
  areas: GardenArea[];
  selectedAreaId: string | null;
  onSelectArea: (id: string) => void;
  drawing: boolean;
  draftPoints: [number, number][];
  onDraftPoint: (point: [number, number]) => void;
  viewArea?: GardenArea | null;
  readonly?: boolean;
  onReadyChange?: (ready: boolean) => void;
  scene?: Omit<GardenMapSceneProps, "scale" | "compact">;
  onScenePick?: (point: Point) => void;
  onOpenIllustration?: () => void;
};
type MapStatus = "missing-key" | "loading" | "ready" | "partial" | "error";

/** V-world basemap for geographic boundaries and simulated mission overlays. */
const SuncheonMap = forwardRef<SuncheonMapHandle, Props>(function SuncheonMap(
  {
    apiKey,
    onZoomChange,
    onOpenDetail,
    areas,
    selectedAreaId,
    onSelectArea,
    drawing,
    draftPoints,
    onDraftPoint,
    viewArea,
    readonly: readOnly = false,
    onReadyChange,
    scene,
    onScenePick,
    onOpenIllustration,
  },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const initiallyFocusedScene = useRef<L.Map | null>(null);
  const hasScene = !!scene;
  const fitRef = useRef<(animate?: boolean) => void>(() => {});
  const retryRef = useRef<() => void>(() => {});
  const focusAreaRef = useRef<(area: GardenArea, animate?: boolean) => void>(
    () => {},
  );
  const focusIllustrationRef = useRef<(animate?: boolean) => void>(() => {});
  const previousViewRequest = useRef<{ apiKey: string } | null>(null);
  const focusVehicleRef = useRef<(point: Point) => void>(() => {});
  const areaLayerRef = useRef<L.LayerGroup | null>(null);
  const draftLayerRef = useRef<L.LayerGroup | null>(null);
  const onZoomRef = useRef(onZoomChange);
  const [status, setStatus] = useState<MapStatus>(
    apiKey.trim() ? "loading" : "missing-key",
  );
  const [zoom, setZoom] = useState<number | null>(null);
  onZoomRef.current = onZoomChange;
  const propsRef = useRef({
    areas,
    onSelectArea,
    drawing,
    onDraftPoint,
    viewArea,
    readOnly,
    status,
  });
  propsRef.current = {
    areas,
    onSelectArea,
    drawing,
    onDraftPoint,
    viewArea,
    readOnly,
    status,
  };

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        mapRef.current?.zoomIn(Math.log2(GARDEN_DETAIL_ZOOM.step), {
          animate: !prefersReducedMapMotion(),
        });
      },
      zoomOut: () => {
        mapRef.current?.zoomOut(Math.log2(GARDEN_DETAIL_ZOOM.step), {
          animate: !prefersReducedMapMotion(),
        });
      },
      fitGarden: () => {
        fitRef.current();
      },
      focusArea: (id: string) => {
        const area = propsRef.current.areas.find((item) => item.id === id);
        if (area) focusAreaRef.current(area);
      },
      focusIllustration: () => focusIllustrationRef.current(),
      focusVehicle: (point: Point) => focusVehicleRef.current(point),
    }),
    [],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current!;
    const canvas = canvasRef.current!;
    const owner = wrapper.closest(".app") ?? document;
    let disposed = false;
    let frame = 0;
    let statusFrame = 0;
    let timeout = 0;
    const key = apiKey.trim();
    let errorTimer = 0;
    const updateStatus = (next: MapStatus) => {
      if (disposed) return;
      window.clearTimeout(errorTimer);
      if (next !== "error") {
        setStatus(next);
        return;
      }
      // 실패는 바로 알리지 않고 잠깐 지켜본다. 그 사이에 타일이 오면 실패 화면 없이 넘어간다.
      // 지켜보는 동안에는 불러오는 중(진행 막대)으로 보여 준다.
      setStatus((current) => (current === "error" ? current : "loading"));
      errorTimer = window.setTimeout(() => {
        if (!disposed) setStatus("error");
      }, 2000);
    };
    const geometry = () => {
      const rect = wrapper.getBoundingClientRect();
      const visible = (selector: string, outsidePanel = false) => {
        const element = owner.querySelector(selector);
        if (
          !element?.getClientRects().length ||
          (outsidePanel && element.closest(".panel"))
        )
          return null;
        return element.getBoundingClientRect();
      };
      const panel = visible(".panel");
      const stacked = !!panel && panel.width > rect.width * 0.75;
      const edge =
        Number.parseFloat(
          getComputedStyle(wrapper).getPropertyValue("--workspace-edge"),
        ) || 20;
      const left = edge;
      let top = Math.max(
        edge,
        (visible(".topbar")?.bottom ?? rect.top) - rect.top + 12,
      );
      let right = rect.width - edge;
      let bottom = rect.height - edge;
      if (panel) {
        if (stacked) bottom = Math.min(bottom, panel.top - rect.top - 12);
        else right = Math.min(right, panel.left - rect.left - 12);
      }
      const toolbar = visible(".map-toolbar", true);
      if (toolbar) top = Math.max(top, toolbar.bottom - rect.top + 12);
      else {
        for (const selector of [".map-heading", ".map-mode"]) {
          const overlay = visible(selector, true);
          if (
            !overlay ||
            overlay.left - rect.left >= right ||
            overlay.right <= rect.left + left
          )
            continue;
          if (overlay.top - rect.top < rect.height * 0.45)
            top = Math.max(top, overlay.bottom - rect.top + 12);
          else bottom = Math.min(bottom, overlay.top - rect.top - 12);
        }
      }
      const controls = visible(".map-controls", true);
      if (controls) {
        if (stacked) bottom = Math.min(bottom, controls.top - rect.top - 8);
        else right = Math.min(right, controls.left - rect.left - 12);
      }
      right = Math.max(left + 100, right);
      bottom = Math.max(top + 100, bottom);
      wrapper.style.setProperty("--suncheon-free-x", `${left}px`);
      wrapper.style.setProperty("--suncheon-free-y", `${top}px`);
      wrapper.style.setProperty("--suncheon-free-w", `${right - left}px`);
      wrapper.style.setProperty("--suncheon-free-h", `${bottom - top}px`);
      // Keep credits above the location card when it shares the panel's baseline.
      const locationLabel = visible(".map-location-label");
      const creditBottom =
        stacked && panel
          ? Math.max(edge, rect.bottom - panel.top + 8)
          : locationLabel
            ? Math.max(edge, rect.bottom - locationLabel.top + 8)
            : edge;
      wrapper.style.setProperty(
        "--suncheon-credit-bottom",
        `${creditBottom}px`,
      );
      return {
        paddingTopLeft: L.point(left + 12, top + 16),
        paddingBottomRight: L.point(
          Math.max(0, rect.width - right) + 12,
          Math.max(0, rect.height - bottom) + 30,
        ),
      };
    };
    const map = key
      ? L.map(canvas, {
          zoomControl: false,
          attributionControl: false,
          minZoom: suncheonMapConfig.minZoom,
          maxZoom: suncheonMapConfig.maxZoom,
          zoomSnap: 0,
          zoomDelta: Math.log2(GARDEN_DETAIL_ZOOM.step),
          scrollWheelZoom: true,
          touchZoom: true,
          keyboard: true,
          zoomAnimation: !prefersReducedMapMotion(),
        })
      : null;
    let atDefaultGardenView = false;
    let applyingDefaultView = false;
    map?.on("movestart zoomstart", () => {
      if (!applyingDefaultView) atDefaultGardenView = false;
    });
    mapRef.current = map;
    setMapInstance(map);
    const fitBounds = (
      bounds: L.LatLngBoundsExpression,
      maxZoom = suncheonMapConfig.maxZoom,
      animate = false,
    ) => {
      const padding = geometry();
      map?.invalidateSize({ pan: false });
      map?.fitBounds(bounds, {
        ...padding,
        animate: animate && !prefersReducedMapMotion(),
        duration: 0.22,
        maxZoom,
      });
    };
    const fit = (area = propsRef.current.viewArea, animate = false) =>
      fitBounds(
        area && area.boundary.length >= 3
          ? L.latLngBounds(area.boundary)
          : suncheonMapConfig.bounds,
        suncheonMapConfig.maxZoom,
        animate,
      );
    fitRef.current = (animate = true) =>
      fitBounds(suncheonMapConfig.bounds, suncheonMapConfig.maxZoom, animate);
    focusAreaRef.current = (area, animate = true) => fit(area, animate);
    // Match the detail image's screen scale and free-area center, including the
    // panel offset. Fractional zoom avoids snapping to a visibly different size.
    focusIllustrationRef.current = (animate = true) => {
      if (!map) return;
      geometry();
      map.invalidateSize({ pan: false });
      const frame = measureGardenFrame(wrapper, GARDEN_IMAGE);
      const camera = boundedGardenCamera(
        fittedGardenCamera(frame, GARDEN_IMAGE),
        frame,
        GARDEN_DETAIL_ZOOM.min,
        GARDEN_IMAGE,
      );
      const left = map.project(gardenImageToLatLng([0, 0]), 0);
      const right = map.project(
        gardenImageToLatLng([GARDEN_IMAGE.width, 0]),
        0,
      );
      const scaleAtZero = (right.x - left.x) / GARDEN_IMAGE.width;
      const targetZoom = Math.max(
        suncheonMapConfig.minZoom,
        Math.min(
          suncheonMapConfig.maxZoom,
          Math.log2(frame.baseScale / scaleAtZero),
        ),
      );
      const freeCenter = gardenFrameCenter(frame);
      const centerPixel = map
        .project(gardenImageToLatLng(camera), targetZoom)
        .add(map.getSize().divideBy(2))
        .subtract(L.point(freeCenter[0], freeCenter[1]));
      applyingDefaultView = true;
      map.setView(map.unproject(centerPixel, targetZoom), targetZoom, {
        animate: animate && !prefersReducedMapMotion(),
        duration: 0.22,
      });
      applyingDefaultView = false;
      atDefaultGardenView = true;
    };
    focusVehicleRef.current = (point) => {
      const geo = gardenImageToLatLng(point);
      fitBounds(
        L.latLngBounds(geo, geo),
        Math.min(suncheonMapConfig.maxZoom, Math.max(map?.getZoom() ?? 18, 18)),
        true,
      );
    };
    const observeResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!disposed) {
          geometry();
          map?.invalidateSize({ pan: false });
          if (atDefaultGardenView) focusIllustrationRef.current(false);
        }
      });
    };
    const observer = new ResizeObserver(observeResize);
    observer.observe(wrapper);
    for (const selector of [
      ".panel",
      ".topbar",
      ".map-toolbar",
      ".map-heading",
      ".map-mode",
      ".map-controls",
      ".map-location-label",
    ]) {
      const element = owner.querySelector(selector);
      if (element) observer.observe(element);
    }
    window.addEventListener("resize", observeResize);
    if (!map) {
      updateStatus("missing-key");
      setZoom(null);
      fit();
    } else {
      areaLayerRef.current = L.layerGroup().addTo(map);
      draftLayerRef.current = L.layerGroup().addTo(map);
      map.on("click", (event: L.LeafletMouseEvent) => {
        const current = propsRef.current;
        if (!current.drawing || current.readOnly || current.status !== "ready")
          return;
        if (
          event.originalEvent instanceof MouseEvent &&
          event.originalEvent.detail > 1
        )
          return;
        current.onDraftPoint([event.latlng.lat, event.latlng.lng]);
      });
      const reportZoom = () => {
        const next = map.getZoom();
        setZoom(next);
        onZoomRef.current(next);
      };
      // URL and provider error objects intentionally never enter UI or application logs.
      const tiles = L.tileLayer(suncheonMapConfig.tileUrl(key), {
        minZoom: suncheonMapConfig.minZoom,
        maxZoom: suncheonMapConfig.maxZoom,
        maxNativeZoom: suncheonMapConfig.maxNativeZoom,
        noWrap: true,
        keepBuffer: 2,
      });
      const tileStates = new WeakMap<
        HTMLElement,
        "pending" | "loaded" | "failed"
      >();
      let settled = false;
      let timedOut = false;
      const visibleStatus = () => {
        if (disposed) return;
        const viewport = canvas.getBoundingClientRect();
        let loaded = 0;
        let failed = 0;
        let pending = 0;
        // Public container and tile events also account for tiles retained in Leaflet's cache.
        for (const tile of tiles
          .getContainer()
          ?.querySelectorAll<HTMLImageElement>("img.leaflet-tile") ?? []) {
          const rect = tile.getBoundingClientRect();
          if (
            !rect.width ||
            !rect.height ||
            rect.right <= viewport.left ||
            rect.left >= viewport.right ||
            rect.bottom <= viewport.top ||
            rect.top >= viewport.bottom
          )
            continue;
          const state = tileStates.get(tile);
          if (state === "loaded" && tile.complete && tile.naturalWidth > 0)
            loaded += 1;
          else if (state === "failed") failed += 1;
          else pending += 1;
        }
        if (loaded > 0) {
          // 아직 받는 타일이 있으면 불러오는 중이다. 지도를 움직이는 동안 잠깐 실패한 타일 때문에
          // "불러오지 못했다"고 알리지 않고, 다 받은 뒤에도 빈 곳이 남았을 때만 알린다.
          updateStatus(
            pending > 0
              ? timedOut
                ? "partial"
                : "loading"
              : failed > 0
                ? "partial"
                : "ready",
          );
        } else {
          // 화면에 받은 타일이 아직 하나도 없는 경우. 지도를 옮기거나 확대하는 도중에는
          // 이런 순간이 잠깐씩 생기므로 "불러오는 중"으로 본다. 실패로 보는 것은
          // 오래 기다려도 아무것도 못 받았거나, 다 끝났는데 보이는 타일이 전부 실패한 때뿐이다.
          updateStatus(
            timedOut || (settled && failed > 0 && pending === 0)
              ? "error"
              : "loading",
          );
        }
      };
      const scheduleStatus = () => {
        if (disposed) return;
        cancelAnimationFrame(statusFrame);
        statusFrame = requestAnimationFrame(visibleStatus);
      };
      const beginLoading = () => {
        settled = false;
        timedOut = false;
        window.clearTimeout(timeout);
        scheduleStatus();
        timeout = window.setTimeout(() => {
          timedOut = true;
          scheduleStatus();
        }, 12000);
      };
      tiles.on("loading", beginLoading);
      tiles.on("tileloadstart", (event: L.TileEvent) => {
        tileStates.set(event.tile, "pending");
        scheduleStatus();
      });
      tiles.on("tileload", (event: L.TileEvent) => {
        tileStates.set(event.tile, "loaded");
        scheduleStatus();
      });
      tiles.on("tileerror", (event: L.TileEvent) => {
        tileStates.set(event.tile, "failed");
        scheduleStatus();
      });
      tiles.on("tileunload", (event: L.TileEvent) => {
        tileStates.delete(event.tile);
        scheduleStatus();
      });
      tiles.on("load", () => {
        settled = true;
        window.clearTimeout(timeout);
        scheduleStatus();
      });
      retryRef.current = () => {
        beginLoading();
        tiles.redraw();
      };
      map.on("zoomend", reportZoom);
      map.on("moveend zoomend", scheduleStatus);
      // 멀리 떨어진 곳으로 옮기면 화면에 있던 타일이 한꺼번에 사라진다. 새 타일을 받기 전의
      // 빈 순간을 "불러오지 못함"이 아니라 "불러오는 중"으로 보도록 불러오기를 새로 시작한다.
      map.on("movestart", beginLoading);
      beginLoading();
      tiles.addTo(map);
      fit();
      reportZoom();
    }
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      window.clearTimeout(errorTimer);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(statusFrame);
      observer.disconnect();
      window.removeEventListener("resize", observeResize);
      fitRef.current = () => {};
      focusAreaRef.current = () => {};
      focusIllustrationRef.current = () => {};
      focusVehicleRef.current = () => {};
      if (initiallyFocusedScene.current === map)
        initiallyFocusedScene.current = null;
      setMapInstance(null);
      retryRef.current = () => {};
      areaLayerRef.current = null;
      draftLayerRef.current = null;
      mapRef.current = null;
      map?.remove();
    };
  }, [apiKey]);

  useEffect(() => {
    if (
      !mapInstance ||
      !hasScene ||
      initiallyFocusedScene.current === mapInstance
    )
      return;
    initiallyFocusedScene.current = mapInstance;
    focusIllustrationRef.current(false);
  }, [mapInstance, hasScene]);

  useEffect(() => {
    onReadyChange?.(status === "ready");
  }, [status, onReadyChange]);

  useEffect(() => {
    const animate = previousViewRequest.current?.apiKey === apiKey;
    previousViewRequest.current = { apiKey };
    if (viewArea) focusAreaRef.current(viewArea, animate);
    else fitRef.current(animate);
  }, [viewArea, apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const group = areaLayerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const interactive = !drawing && !readOnly;
    const compactLabels = (zoom ?? map.getZoom()) < 17;
    const visibleAreas = (viewArea ? [viewArea] : areas).filter(
      (area) => !hasScene || !area.isExample,
    );
    const labelBounds: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    }[] = [];
    for (const [visibleIndex, area] of visibleAreas.entries()) {
      if (area.boundary.length < 3) continue;
      const storedIndex = areas.findIndex((item) => item.id === area.id);
      const index = storedIndex >= 0 ? storedIndex : visibleIndex;
      const selected = area.id === selectedAreaId || !!viewArea;
      const polygon = L.polygon(area.boundary, {
        color: "#245bff",
        weight: selected ? 3 : 2,
        fillColor: "#245bff",
        fillOpacity: selected ? 0.2 : 0.08,
        dashArray: selected ? undefined : "7 5",
        className: `suncheon-area-boundary${selected ? " is-selected" : ""}`,
        interactive,
        bubblingMouseEvents: false,
      }).addTo(group);
      const select = () => {
        const current = propsRef.current;
        if (!current.drawing && !current.readOnly)
          current.onSelectArea(area.id);
      };
      if (interactive) polygon.on("click", select);
      const path = polygon.getElement();
      if (path) {
        path.setAttribute("data-area-id", area.id);
        path.setAttribute("role", interactive ? "button" : "img");
        path.setAttribute("tabindex", interactive ? "0" : "-1");
        path.setAttribute(
          "aria-label",
          `${area.name} ${interactive ? "상세 보기" : "경계"}`,
        );
        path.addEventListener("keydown", (event) => {
          if (!(event instanceof KeyboardEvent)) return;
          if (!interactive || (event.key !== "Enter" && event.key !== " "))
            return;
          event.preventDefault();
          event.stopPropagation();
          select();
        });
      }
      // User-provided names are inserted only as text, never parsed as HTML.
      const label = document.createElement(interactive ? "button" : "span");
      if (label instanceof HTMLButtonElement) label.type = "button";
      const placement = viewArea
        ? "is-offset-top"
        : index % 2
          ? "is-offset-right"
          : "is-offset-left";
      label.className = `suncheon-area-label ${compactLabels ? "is-compact" : placement}${selected ? " is-selected" : ""}${interactive ? "" : " is-static"}`;
      if (compactLabels)
        label.style.setProperty(
          "--suncheon-label-nudge",
          `${index % 2 ? 8 : -8}px`,
        );
      label.dataset.areaId = area.id;
      label.title = `${area.name}${area.isExample ? " · 예시 구역" : ""}`;
      label.setAttribute(
        "aria-label",
        `${area.name} ${interactive ? "상세 보기" : "경계"}`,
      );
      const name = document.createElement("span");
      const number = String(index + 1).padStart(2, "0");
      name.textContent = compactLabels ? number : `${number} · ${area.name}`;
      label.append(name);
      if (area.isExample && !compactLabels) {
        const badge = document.createElement("small");
        badge.textContent = "예시";
        label.append(badge);
      }
      if (interactive)
        label.addEventListener("click", (event) => {
          event.stopPropagation();
          select();
        });
      L.marker(polygon.getBounds().getCenter(), {
        icon: L.divIcon({
          className: "suncheon-area-label-icon",
          html: label,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        interactive,
        keyboard: false,
        bubblingMouseEvents: false,
      }).addTo(group);
      // Closely spaced gardens must remain individually clickable at overview zoom.
      const bounds = label.getBoundingClientRect();
      let rise = 0;
      while (
        labelBounds.some(
          (other) =>
            bounds.left < other.right + 4 &&
            bounds.right + 4 > other.left &&
            bounds.top - rise < other.bottom + 4 &&
            bounds.bottom - rise + 4 > other.top,
        )
      )
        rise += bounds.height + 8;
      if (rise) label.style.translate = `0 -${rise}px`;
      labelBounds.push({
        left: bounds.left,
        right: bounds.right,
        top: bounds.top - rise,
        bottom: bounds.bottom - rise,
      });
    }
    return () => {
      group.clearLayers();
    };
  }, [
    areas,
    selectedAreaId,
    drawing,
    readOnly,
    viewArea,
    apiKey,
    zoom,
    hasScene,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const group = draftLayerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (drawing && !readOnly) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    if (!drawing || readOnly) return;
    const lineStyle = {
      color: "#245bff",
      weight: 3,
      dashArray: "7 5",
      interactive: false,
    };
    if (draftPoints.length >= 3)
      L.polygon(draftPoints, { ...lineStyle, fillOpacity: 0.18 }).addTo(group);
    else if (draftPoints.length >= 2)
      L.polyline(draftPoints, lineStyle).addTo(group);
    draftPoints.forEach((point, index) => {
      const number = document.createElement("span");
      number.className = "suncheon-draft-point";
      number.textContent = String(index + 1);
      number.setAttribute("aria-hidden", "true");
      L.marker(point, {
        icon: L.divIcon({
          className: "suncheon-draft-point-icon",
          html: number,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        keyboard: false,
        interactive: false,
      }).addTo(group);
    });
    return () => {
      group.clearLayers();
    };
  }, [drawing, draftPoints, readOnly, apiKey]);

  const unavailable = status === "missing-key" || status === "error";
  const openDetail = onOpenIllustration ?? onOpenDetail;
  return (
    <div
      ref={wrapperRef}
      className={`suncheon-map${drawing && !readOnly ? " is-drawing" : ""}`}
      data-status={status}
      data-zoom={zoom ?? ""}
    >
      <div
        ref={canvasRef}
        className="suncheon-map-canvas"
        role="region"
        aria-label={
          drawing && !readOnly
            ? "지도를 클릭하여 정원 구역 지점 추가"
            : "브이월드 위성지도: 순천만국가정원. 드래그, 휠, 두 손가락으로 이동과 확대가 가능합니다."
        }
      />
      {mapInstance && scene && (
        <GeographicGardenLayer
          map={mapInstance}
          scene={scene}
          onPick={onScenePick}
          interactive={!drawing && !readOnly}
        />
      )}
      {unavailable && (
        <div className="suncheon-map-state" role="status">
          <span className="suncheon-map-state-icon">
            {status === "missing-key" ? (
              <MapPinned size={25} />
            ) : (
              <AlertCircle size={25} />
            )}
          </span>
          <p className="suncheon-map-eyebrow">SUNCHEON BAY NATIONAL GARDEN</p>
          <h2>
            {status === "missing-key"
              ? "전체 지도를 연결해 주세요"
              : "지도를 불러오지 못했어요"}
          </h2>
          <p>
            {status === "missing-key"
              ? "브이월드 지도 키가 설정되면 실제 국가정원의 위성지도를 볼 수 있습니다."
              : "지도 연결이 지연되거나 접근이 제한되었어요. 잠시 후 다시 시도해 주세요."}
          </p>
          <div className="suncheon-map-state-actions">
            {status === "error" && (
              <button type="button" onClick={() => retryRef.current()}>
                <RotateCw size={15} />
                다시 시도
              </button>
            )}
            {openDetail && (
              <button
                type="button"
                className="suncheon-map-primary"
                onClick={openDetail}
              >
                {readOnly ? "전체 지도" : "정원 상세 시안"}
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </div>
      )}
      {/* 지도를 옮기거나 확대해 타일을 받는 동안에는 글자 대신 위쪽의 얇은 진행 막대만 보여 준다. */}
      {status === "loading" && (
        <div
          className="suncheon-map-loading"
          role="status"
          aria-label="위성지도를 불러오는 중"
        >
          <span />
        </div>
      )}
      {status === "partial" && (
        <div className="suncheon-map-notice" role="status">
          <AlertCircle size={15} />
          <span>일부 지도 영역을 불러오지 못했어요.</span>
          <button type="button" onClick={() => retryRef.current()}>
            다시 시도
          </button>
        </div>
      )}
      <div className="suncheon-map-attribution">
        <a
          href="https://www.vworld.kr/"
          target="_blank"
          rel="noopener noreferrer"
        >
          공간정보 오픈플랫폼(브이월드)
        </a>
      </div>
    </div>
  );
});
export default SuncheonMap;
