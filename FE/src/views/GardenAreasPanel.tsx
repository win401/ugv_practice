import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  MapPin,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { GardenAreasState } from "../hooks/useGardenAreas";

export function GardenAreasPanel({
  state,
  mapReady,
  onOpen,
  onFocus,
  onCancel,
  onRemove,
  operatingInfo,
  safetyAction,
}: {
  state: GardenAreasState;
  mapReady: boolean;
  onOpen: (id: string) => void;
  onFocus: (id: string) => void;
  onCancel: () => void;
  onRemove: (id: string) => void;
  operatingInfo: ReactNode;
  safetyAction: ReactNode;
}) {
  return (
    <>
      <div className="panel-body garden-areas-body">
        <div className="area-panel-intro">
          <span className="eyebrow">SUNCHEON NATIONAL GARDEN</span>
          <h2>{state.drawing ? "새 정원 구역 지정" : "추가 정원 경계"}</h2>
          <p>
            {state.drawing
              ? "지도에서 경계의 모서리를 순서대로 눌러 주세요. 점을 3개 이상 지정하면 구역을 저장할 수 있어요."
              : "관수 구역 A–X 밖에도 정원 경계를 추가할 수 있어요. 목록에서 누르면 전체 지도에서 해당 위치를 찾습니다."}
          </p>
        </div>
        {state.error && (
          <p role="alert" className="area-error">
            {state.error}
          </p>
        )}
        {state.drawing ? (
          <div className="area-draw-form">
            <label htmlFor="garden-area-name">정원 구역 이름</label>
            <input
              id="garden-area-name"
              autoFocus
              maxLength={30}
              value={state.name}
              disabled={state.saving}
              onChange={(e) => state.setName(e.target.value)}
              placeholder="예: 동쪽 꽃정원"
            />
            <div className="area-draw-count">
              <strong>
                {state.points.length}
                <small> / 30개 지점</small>
              </strong>
              <span>최소 3개</span>
            </div>
            <ol className="area-draw-steps">
              <li>지도를 확대해 정원 위치를 찾으세요.</li>
              <li>경계를 따라 모서리를 순서대로 누르세요.</li>
              <li>이름을 입력하고 구역 저장을 누르세요.</li>
            </ol>
            <div className="area-edit-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={!state.points.length || state.saving}
                onClick={state.undo}
              >
                <Undo2 size={14} />
                마지막 점 취소
              </button>
              <button
                type="button"
                className="text-button"
                disabled={!state.points.length || state.saving}
                onClick={state.clear}
              >
                점 모두 지우기
              </button>
            </div>
            <p className="area-help">
              지도는 드래그로 이동할 수 있어요. 경계선이 서로 교차하지 않게 그려
              주세요.
            </p>
          </div>
        ) : (
          <>
            <div className="area-list-heading">
              <h3>
                등록 구역 <span>{state.areas.length}곳</span>
              </h3>
              <span>이 브라우저에 저장</span>
            </div>
            {state.loading ? (
              <p role="status">정원 구역을 불러오는 중입니다…</p>
            ) : (
              <div className="area-list">
                {state.areas.map((area, index) => (
                  <div
                    key={area.id}
                    className={`area-card ${state.selectedId === area.id ? "selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="area-open"
                      onClick={() => onOpen(area.id)}
                      aria-label={`${area.name} 목록에서 지도 위치 보기`}
                    >
                      <span className="area-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="area-copy">
                        <strong>{area.name}</strong>
                        <small>
                          {area.detailKind === "illustration"
                            ? "정원 상세 이미지 · 관수 시연"
                            : "추가한 정원 경계"}
                          {area.isExample ? " · 예시" : ""}
                        </small>
                      </span>
                      <ArrowUpRight size={16} />
                    </button>
                    <div className="area-card-actions">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onFocus(area.id)}
                        aria-label={`${area.name} 지도에서 찾기`}
                      >
                        <MapPin size={12} />
                        지도에서 찾기
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        disabled={state.saving}
                        onClick={() => onRemove(area.id)}
                        aria-label={`${area.name} 구역 삭제`}
                      >
                        <Trash2 size={12} />
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
                {!state.areas.length && !state.error && (
                  <p className="area-empty">
                    아직 등록한 구역이 없어요.
                    <br />
                    구역 추가로 첫 정원을 지정해 보세요.
                  </p>
                )}
              </div>
            )}
            <details className="area-operating-info">
              <summary>운영 정원 정보</summary>
              <div>{operatingInfo}</div>
            </details>
            <p className="area-help">
              추가 경계는 전체 지도에 표시됩니다. 상세 이미지의 관수 구역
              A–X와는 별도로 관리됩니다.
            </p>
          </>
        )}
      </div>
      <div className="panel-footer area-panel-footer">
        <div className="action-row">
          {state.drawing ? (
            <>
              <button
                type="button"
                className="secondary-button"
                disabled={state.saving}
                onClick={onCancel}
              >
                <X size={15} />
                취소
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={
                  state.saving || state.points.length < 3 || !state.name.trim()
                }
                onClick={() => void state.save()}
              >
                <Check size={16} />
                {state.saving ? "저장 중…" : "구역 저장"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={!mapReady || state.loading || state.saving}
              onClick={state.start}
            >
              <Plus size={17} />
              구역 추가
            </button>
          )}
        </div>
        {safetyAction && (
          <div className="action-row control-actions area-safety-action">
            {safetyAction}
          </div>
        )}
        <p role="status">
          {state.message ||
            (state.drawing
              ? "저장 전 경계는 미리보기입니다."
              : "정원 구역은 현재 브라우저에만 저장됩니다.")}
        </p>
      </div>
    </>
  );
}
