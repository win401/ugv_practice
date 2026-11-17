import {
  Check,
  MousePointer2,
  PenTool,
  Redo2,
  RotateCcw,
  Save,
  Spline,
  Undo2,
  X,
} from "lucide-react";
import type { GardenZoneEditorState } from "../hooks/useGardenZoneEditor";

/** One draft remains shared across both map views until saved or cancelled. */
export default function GardenZoneEditorPanel({
  editor,
}: {
  editor: GardenZoneEditorState;
}) {
  const { draft } = editor;
  if (!draft) return null;
  const validName =
    draft.name.trim().length > 0 && draft.name.trim().length <= 50;
  const canSave =
    editor.dirty &&
    !editor.drawing &&
    !!draft.shape &&
    validName &&
    !editor.saving &&
    !editor.blocked &&
    !editor.storageUnavailable;
  return (
    <>
      <div className="panel-body garden-detail-body garden-zone-editor-body">
        <div className="section-intro">
          <span className="eyebrow">GARDEN ZONE · EDIT</span>
          <div className="garden-zone-editor-heading">
            <h2>
              {editor.isNew ? "새 관수 구역 추가" : "구역 이름과 경계 편집"}
            </h2>
            <span className="tag info">{draft.letter} 구역</span>
          </div>
          <p className="detail-subtitle">
            {editor.drawing
              ? "지도에 점을 찍고 시작점을 눌러"
              : "이름을 바꾸거나 지도 위의 점을 움직여"}
            <br />
            {editor.drawing
              ? "새 구역의 경계를 닫아 주세요."
              : "원하는 경계로 조정하세요."}
          </p>
        </div>

        <div className="garden-zone-editor-field">
          <label htmlFor="garden-zone-name">구역 이름</label>
          <input
            id="garden-zone-name"
            type="text"
            value={draft.name}
            maxLength={50}
            autoComplete="off"
            autoFocus
            disabled={editor.blocked || editor.saving}
            aria-invalid={!validName}
            aria-describedby="garden-zone-name-help"
            onChange={(event) => editor.setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (canSave) editor.save();
              }
            }}
          />
          <div
            id="garden-zone-name-help"
            className="garden-zone-editor-field-help"
          >
            <span>
              {validName
                ? "최대 50자까지 입력할 수 있습니다."
                : "구역 이름을 입력해 주세요."}
            </span>
            <span>{draft.name.length}/50</span>
          </div>
        </div>

        <section
          className="garden-zone-editor-guide"
          aria-label="경계 편집 방법"
        >
          <div className="garden-zone-editor-guide-title">
            <span className="card-icon">
              <MousePointer2 size={16} />
            </span>
            <h3>
              {editor.drawing
                ? `경계 그리기 · ${editor.drawingPoints.length}개 점`
                : "지도에서 경계 조정"}
            </h3>
          </div>
          <div
            className="garden-zone-editor-tools"
            role="group"
            aria-label="경계 편집 도구"
          >
            {!editor.drawing && (
              <div className="garden-zone-editor-tool-modes">
                <button
                  type="button"
                  aria-pressed={editor.tool === "select"}
                  disabled={editor.blocked || editor.saving}
                  onClick={() => editor.setTool("select")}
                  title="점 선택 (V)"
                >
                  <MousePointer2 size={14} /> 점 선택 <kbd>V</kbd>
                </button>
                <button
                  type="button"
                  aria-pressed={editor.tool === "add"}
                  disabled={editor.blocked || editor.saving}
                  onClick={() => editor.setTool("add")}
                  title="점 추가 (P)"
                >
                  <PenTool size={14} /> 점 추가 <kbd>P</kbd>
                </button>
                <button
                  type="button"
                  aria-pressed={editor.tool === "curve"}
                  disabled={editor.blocked || editor.saving}
                  onClick={() => editor.setTool("curve")}
                  title="곡선으로 전환 (C)"
                >
                  <Spline size={14} /> 곡선 <kbd>C</kbd>
                </button>
              </div>
            )}
            <div className="garden-zone-editor-history">
              <button
                type="button"
                aria-label="경계 실행 취소"
                title="실행 취소 (⌘/Ctrl+Z)"
                disabled={!editor.canUndo || editor.blocked || editor.saving}
                onClick={editor.undo}
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                aria-label="경계 다시 실행"
                title="다시 실행 (⌘/Ctrl+Shift+Z)"
                disabled={!editor.canRedo || editor.blocked || editor.saving}
                onClick={editor.redo}
              >
                <Redo2 size={15} />
              </button>
            </div>
          </div>
          <p
            className="garden-zone-editor-tool-hint"
            role="status"
            aria-live="polite"
          >
            {editor.drawing
              ? "점을 3개 이상 찍은 뒤 시작점이나 ‘경계 닫기’를 누르세요. 지도를 끌면 화면만 이동합니다."
              : editor.tool === "curve"
                ? "직선을 누르면 곡선 조절점이 생깁니다. 작은 원을 끌어 원하는 굽기로 바꾸세요."
                : editor.tool === "add"
                  ? "경계선 위를 누르면 점이 추가됩니다. 곡선 모양은 그대로 유지돼요."
                  : "점을 선택해서 끌어 보세요. Shift를 누르면 가로·세로로만 움직입니다."}
          </p>
          {!editor.drawing && (
            <ul>
              <li>
                <span
                  className="garden-zone-editor-point anchor"
                  aria-hidden="true"
                />
                <span>
                  <strong>사각형 점</strong>은 경계 위치를 조절합니다.
                </span>
              </li>
              <li>
                <span
                  className="garden-zone-editor-point control"
                  aria-hidden="true"
                />
                <span>
                  <strong>작은 원</strong>은 곡선의 굽기를 조절합니다.
                </span>
              </li>
            </ul>
          )}
          <p>
            {editor.drawing
              ? "Enter 경계 닫기 · Backspace 마지막 점 취소"
              : "방향키로 미세 조정 · Shift+방향키로 크게 이동"}
            <br />
            ⌘/Ctrl+Z 실행 취소{!editor.drawing && " · Esc 선택 해제"}
          </p>
          <button
            type="button"
            className="text-button garden-zone-editor-reset"
            disabled={!editor.dirty || editor.blocked || editor.saving}
            onClick={editor.resetBoundary}
          >
            <RotateCcw size={13} />
            {editor.isNew ? "다시 그리기" : "경계 되돌리기"}
          </button>
        </section>

        <div className="garden-zone-editor-sync">
          <Check size={15} aria-hidden="true" />
          <p>
            전체 지도에서 위도·경도로 저장합니다.
            <br />
            편집을 마친 뒤 정원 상세로 전환할 수 있습니다.
          </p>
        </div>
        <p className="garden-zone-editor-local-note">
          저장한 구역은 이 브라우저에만 남습니다. 다른 PC나 팀원에게 자동
          공유되지 않습니다.
        </p>
        <p className="garden-zone-editor-local-note">
          {editor.isNew
            ? "새 구역은 관수 접근 지점이 아직 연결되지 않았습니다. 구역을 저장해도 UGV 경로가 자동으로 생성되지는 않습니다."
            : "경계를 바꿔도 UGV의 길과 관수 지점은 그대로입니다. 저장 후 경로 미리보기를 다시 확인하세요."}
        </p>
        {editor.blocked && (
          <p className="field-error garden-zone-editor-feedback" role="alert">
            관수 작업이 진행 중입니다. 수정 내용은 유지되며 작업이 끝난 뒤
            저장할 수 있습니다.
          </p>
        )}
        {editor.error && (
          <p className="field-error garden-zone-editor-feedback" role="alert">
            {editor.error}
          </p>
        )}
      </div>
      <div className="panel-footer detail-panel-footer garden-zone-editor-footer">
        <div className="action-row">
          <button
            type="button"
            className="secondary-button"
            onClick={editor.cancel}
          >
            <X size={14} />
            {editor.isNew ? "추가 취소" : "편집 취소"}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={
              editor.drawing
                ? editor.drawingPoints.length < 3 ||
                  editor.blocked ||
                  editor.saving
                : !canSave
            }
            onClick={() =>
              editor.drawing ? editor.finishDrawing() : editor.save()
            }
          >
            <Save size={15} />
            {editor.saving
              ? "저장 중…"
              : editor.drawing
                ? "경계 닫기"
                : editor.isNew
                  ? "새 구역 저장"
                  : "변경사항 저장"}
          </button>
        </div>
        <p role="status" aria-live="polite">
          {editor.dirty
            ? "아직 저장하지 않은 변경사항이 있습니다."
            : "수정 후 저장하면 이 브라우저에서 유지됩니다."}
        </p>
      </div>
    </>
  );
}
