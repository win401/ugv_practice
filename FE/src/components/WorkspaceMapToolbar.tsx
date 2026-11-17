import { LocateFixed, Maximize2, Minus, Plus } from "lucide-react";

/** Camera controls remain beside the map; map-mode navigation lives in the header. */
export default function WorkspaceMapToolbar({
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onFit,
  onLocate,
  canLocate = true,
}: {
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onLocate: () => void;
  /** 장비 위치를 알 수 있는지. 모르면 위치 보기 버튼을 잠근다. 기본값은 알 수 있음 */
  canLocate?: boolean;
}) {
  return (
    <div className="map-controls">
      <button aria-label="지도 확대" disabled={!canZoomIn} onClick={onZoomIn}>
        <Plus size={18} />
      </button>
      <button aria-label="지도 축소" disabled={!canZoomOut} onClick={onZoomOut}>
        <Minus size={18} />
      </button>
      <span />
      <button aria-label="정원 전체 보기" onClick={onFit}>
        <Maximize2 size={17} />
      </button>
      <button
        aria-label="UGV 위치 보기"
        title={canLocate ? undefined : "장비 위치는 장비 연동 후 제공됩니다."}
        disabled={!canLocate}
        onClick={onLocate}
      >
        <LocateFixed size={18} />
      </button>
    </div>
  );
}
