import {
  ArrowRight,
  Check,
  CheckCheck,
  Droplets,
  Download,
  Plus,
  LoaderCircle,
  MapPin,
  Pencil,
  Route,
  X,
} from "lucide-react";
import type { GardenDetailState } from "../hooks/useGardenDetail";
import GardenZoneEditorPanel from "./GardenZoneEditorPanel";

export default function GardenDetailPanel({
  detail,
  blocked = false,
}: {
  detail: GardenDetailState;
  blocked?: boolean;
}) {
  const { data, selectedIds, plan, planning } = detail;
  if (detail.editor.draft) {
    return <GardenZoneEditorPanel editor={detail.editor} />;
  }
  const blockedReason =
    "진행 중인 관수 회차가 있습니다. 현재 작업이 끝난 뒤 경로를 미리 볼 수 있습니다.";
  return (
    <>
      <div className="panel-body garden-detail-body">
        <div className="section-intro">
          <span className="eyebrow">GARDEN DETAIL · IMAGE CONCEPT</span>
          <h2>어느 구역에 물을 줄까요?</h2>
          <p className="detail-subtitle">
            지도나 목록에서 관수 구역을 선택하고,
            <br />
            정원의 길을 따라가는 경로를 확인하세요.
          </p>
        </div>
        {detail.editor.notice && (
          <p
            className="garden-zone-editor-notice"
            role="status"
            aria-live="polite"
          >
            {detail.editor.notice}
          </p>
        )}
        {detail.editor.error && (
          <p className="field-error garden-zone-editor-feedback" role="alert">
            {detail.editor.error}
          </p>
        )}
        <div className="garden-zone-management-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={detail.editor.startNew}
            disabled={
              !data ||
              blocked ||
              detail.editor.blocked ||
              detail.editor.storageUnavailable ||
              detail.editor.saving
            }
          >
            <Plus size={14} /> 새 구역 추가
          </button>
          <button
            type="button"
            className="text-button"
            onClick={detail.editor.exportGeoJSON}
            disabled={
              !data || detail.editor.storageUnavailable || detail.editor.saving
            }
          >
            <Download size={14} /> GeoJSON 내보내기
          </button>
        </div>
        <div className="detail-selection-heading">
          <h3>
            관수 구역{" "}
            <span>
              {selectedIds.length} / {data?.zones.length ?? 0}개 선택
            </span>
          </h3>
          <div>
            <button
              className="text-button"
              onClick={() => detail.select(data?.zones.map((z) => z.id) ?? [])}
              disabled={!data || selectedIds.length === data.zones.length}
              aria-label="관수 구역 전체 선택"
            >
              <CheckCheck size={14} />
              전체
            </button>
            <button
              className="text-button"
              onClick={() => detail.select([])}
              disabled={!selectedIds.length}
              aria-label="관수 구역 선택 해제"
            >
              <X size={13} />
              해제
            </button>
          </div>
        </div>
        {!data ? (
          <p role="status">
            {detail.error ?? "관수 구역을 불러오는 중입니다…"}
          </p>
        ) : (
          <div
            className="detail-zones"
            role="group"
            aria-label="관수 구역 선택"
          >
            {data.zones.map((zone) => (
              <div
                key={zone.id}
                className={`detail-zone-card ${selectedIds.includes(zone.id) ? "selected" : ""}`}
              >
                <button
                  type="button"
                  className={`detail-zone-row ${selectedIds.includes(zone.id) ? "selected" : ""}`}
                  aria-pressed={selectedIds.includes(zone.id)}
                  title={`${zone.name} · ${zone.description}`}
                  aria-label={`${zone.letter} ${zone.name} 관수 구역`}
                  onClick={() => detail.toggle(zone.id)}
                >
                  <span className="detail-zone-letter">{zone.letter}</span>
                  <span className="detail-zone-copy">
                    <strong>{zone.name}</strong>
                    <small>
                      {zone.stopNode === null
                        ? "관수 접근 지점 미연결"
                        : zone.coordinateAccuracy === "illustrative"
                          ? "예시 경계 · 위치 확인 필요"
                          : zone.description}
                    </small>
                  </span>
                  <span className="detail-zone-check" aria-hidden="true">
                    {selectedIds.includes(zone.id) && <Check size={13} />}
                  </span>
                </button>
                <button
                  type="button"
                  className="detail-zone-edit-button"
                  aria-label={`${zone.letter} ${zone.name} 구역 편집`}
                  title={
                    blocked || detail.editor.blocked
                      ? "관수 작업이 끝난 뒤 구역을 편집할 수 있습니다."
                      : detail.editor.storageUnavailable
                        ? "브라우저 저장소를 사용할 수 없습니다."
                        : "구역 이름과 경계 편집"
                  }
                  disabled={
                    blocked ||
                    detail.editor.blocked ||
                    detail.editor.storageUnavailable
                  }
                  onClick={() => detail.editor.begin(zone.id)}
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
        {detail.hasUnmappedSelection && (
          <p className="garden-zone-editor-notice" role="status">
            새 구역은 아직 관수 접근 지점이 연결되지 않았습니다. 경로 미리보기는
            연결된 구역만 선택해 주세요.
          </p>
        )}
        {plan ? (
          <section className="detail-plan-card" aria-label="경로 미리보기 결과">
            <div className="detail-plan-title">
              <span className="card-icon">
                <Route size={17} />
              </span>
              <div>
                <h3>경로 미리보기</h3>
                <p>{plan.stops.length}개 관수 지점 · 산책로 따라 이동</p>
              </div>
              <span className="tag info">준비됨</span>
            </div>
            <ol className="detail-stop-list">
              <li className="detail-start">
                <span>
                  <MapPin size={11} />
                </span>
                <strong>UGV 출발 위치</strong>
              </li>
              {plan.stops.map((stop, index) => (
                <li key={stop.zoneId}>
                  <span>{index + 1}</span>
                  <strong>
                    {data?.zones.find((zone) => zone.id === stop.zoneId)?.name}
                  </strong>
                  <small>관수 지점</small>
                </li>
              ))}
            </ol>
            <p className="detail-plan-note">
              기존 시연 지점을 연결한 예정 경로입니다.
            </p>
          </section>
        ) : (
          <div className="detail-empty-plan">
            <Route size={23} />
            <p>
              {selectedIds.length
                ? "선택한 구역까지의 길을 확인해 보세요."
                : "원하는 구역을 여러 개 선택할 수 있어요."}
            </p>
            <small>경로 미리보기만으로 장비가 움직이지 않습니다.</small>
          </div>
        )}
        <div className="detail-notice">
          <Droplets size={15} />
          <p>
            구역 경계는 전체 지도에서 편집할 수 있습니다.
            <br />
            기존 예시 경계는 위성지도에서 위치를 확인해 주세요.
          </p>
        </div>
        {detail.error && data && (
          <p className="field-error" role="alert">
            {detail.error}
          </p>
        )}
      </div>
      <div className="panel-footer detail-panel-footer">
        <div className="action-row">
          <button
            className="primary-button"
            disabled={
              !selectedIds.length ||
              planning ||
              blocked ||
              detail.hasUnmappedSelection
            }
            onClick={detail.preview}
          >
            {planning ? (
              <LoaderCircle size={15} className="detail-spinner" />
            ) : (
              <Route size={15} />
            )}
            {planning
              ? "경로 준비 중…"
              : plan
                ? "경로 다시 보기"
                : "경로 미리보기"}
            <ArrowRight size={15} />
          </button>
        </div>
        <p role="status" aria-live="polite">
          {blocked ? blockedReason : detail.message}
        </p>
      </div>
    </>
  );
}
