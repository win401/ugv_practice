import { useState, type ReactNode } from "react";
import {
  Droplets,
  History,
  Info,
  OctagonX,
  Pause,
  Play,
  Radio,
  Route,
  Square,
} from "lucide-react";
import Dropdown from "../components/Dropdown";
import TabIndicator from "../components/TabIndicator";
import MissionProgressCard from "../components/MissionProgressCard";
import type { GardenMapVehicle } from "../types/gardenMap";
import type { GardenDetailState } from "../hooks/useGardenDetail";
import {
  COMMAND_LABEL,
  type IrrigationSimulation,
} from "../hooks/useIrrigationSimulation";
import type { Tab } from "../types/dashboard";
import type { MissionDraft } from "../types/missionDraft";
import EquipmentView from "./EquipmentView";
import GardenDetailPanel from "./GardenDetailPanel";
import HistoryView from "./HistoryView";
import MissionView from "./MissionView";
import WorkView from "./WorkView";

const TABS = [
  { id: "info", name: "정보", icon: Info },
  { id: "work", name: "관수 작업", icon: Droplets },
  { id: "mission", name: "미션", icon: Route },
  { id: "device", name: "장비", icon: Radio },
  { id: "history", name: "이력", icon: History },
] as const;

export interface WorkspacePanelProps {
  tab: Tab;
  onTab: (tab: Tab) => void;
  simulation: IrrigationSimulation;
  detail: GardenDetailState;
  vehicle: GardenMapVehicle | null;
  readOnlyMap: boolean;
  onOpenOverview: () => void;
  missionDraft: MissionDraft | null;
  onMissionDraft: (updater: (draft: MissionDraft) => MissionDraft) => void;
  onMissionStarted: () => void;
  onChooseZone: (id: string) => void;
  onStop: () => void;
  areaManagement?: ReactNode;
  onManageAreas?: () => void;
}

/** Both map views share the same operating tabs, planning state and controls. */
export default function WorkspacePanel({
  tab,
  onTab,
  simulation,
  detail,
  vehicle,
  readOnlyMap,
  onOpenOverview,
  missionDraft,
  onMissionDraft,
  onMissionStarted,
  onChooseZone,
  onStop,
  areaManagement,
  onManageAreas,
}: WorkspacePanelProps) {
  const { device, gardens, selected, activeRun, command, issue, status } =
    simulation;
  const [dismissedRunId, setDismissedRunId] = useState<string | null>(null);
  const progressRun =
    activeRun ??
    (simulation.run?.id !== dismissedRunId && !detail.plan
      ? simulation.run
      : null);
  const pausePending =
    !!command &&
    (command.status === "requested" || command.status === "acked") &&
    command.kind !== "estop";
  const halt = activeRun?.halt;
  const commandHint = !activeRun
    ? null
    : pausePending
      ? `${COMMAND_LABEL[command!.kind]} 요청 · 장비 확인 대기`
      : halt === "estop"
        ? "안전정지 상태입니다. 자동·원격 재개는 제공하지 않습니다."
        : halt === "lost"
          ? "통신이 끊긴 회차입니다. 연결이 복구되어도 자동 재개하지 않습니다."
          : halt === "fault"
            ? "장비 이상 상태입니다. 현장 확인 후 종료하세요."
            : null;
  const estopButton = (
    <button
      className="estop-button"
      disabled={!activeRun || halt === "estop"}
      title={!activeRun ? "진행 중인 회차가 없습니다" : undefined}
      onClick={() => issue("estop")}
    >
      <OctagonX size={15} />
      비상정지
    </button>
  );

  return (
    <aside className="panel" aria-label="UGV 운영 패널">
      <div className="mobile-handle" />
      <div className="panel-heading">
        <span>
          <i />
          {(activeRun ? activeRun.deviceId : device?.id) ?? "장비 미배정"}
        </span>
        <div className="panel-tools">
          <Dropdown
            label="정원 선택"
            className="garden-switch-wrap"
            triggerClassName="garden-switch"
            value={selected.id}
            options={gardens.map((garden) => ({
              value: garden.id,
              label: garden.name,
            }))}
            onChange={onChooseZone}
          >
            <span>운영 정원</span>
            <small>{gardens.length}곳</small>
          </Dropdown>
          <span className="live-tag">SIMULATION</span>
        </div>
      </div>
      <div className="panel-map-context">
        <div className="map-summary">
          <span className="summary-icon">
            <Droplets size={20} />
          </span>
          <div>
            <span>{progressRun ? "완료 지점" : "선택한 관수 구역"}</span>
            <strong>
              {progressRun ? simulation.doneCount : detail.selectedIds.length}
              <small>
                {progressRun ? ` / ${progressRun.points.length}곳` : "개"}
              </small>
            </strong>
          </div>
          <div className="summary-rule" />
          <div>
            <span>{progressRun ? "전체 완료율" : "관수 지점"}</span>
            <strong>
              {progressRun
                ? simulation.progress
                : (detail.plan?.stops.length ?? 0)}
              <small>{progressRun ? "%" : "곳"}</small>
            </strong>
          </div>
          <span className="tiny-demo">DEMO</span>
        </div>
      </div>
      <nav className="tabs tab-indicator-track" aria-label="대시보드 탭">
        <TabIndicator activeKey={tab} variant="underline" />
        {TABS.map((item) => (
          <button
            key={item.id}
            data-tab-key={item.id}
            aria-current={tab === item.id ? "page" : undefined}
            className={tab === item.id ? "active" : ""}
            onClick={() => onTab(item.id)}
          >
            <item.icon size={16} />
            {item.name}
          </button>
        ))}
      </nav>
      {activeRun && tab !== "work" && (
        <div className="area-selection-strip workspace-run-strip">
          <strong role="status">
            {commandHint ?? `${activeRun.deviceId} · ${status}`}
          </strong>
          <button
            type="button"
            className="text-button"
            onClick={() => onTab("work")}
          >
            작업 보기
          </button>
          {estopButton}
        </div>
      )}
      {tab === "info" ? (
        <>
          {progressRun && (activeRun || !areaManagement) ? (
            <>
              <div key="mission-progress" className="panel-body">
                <MissionProgressCard
                  run={progressRun}
                  gardenName={simulation.active.name}
                  vehicle={vehicle?.source === "mission" ? vehicle : null}
                  progress={simulation.progress}
                  doneCount={simulation.doneCount}
                  freshness={simulation.freshness}
                  lastReport={simulation.lastReport}
                  now={simulation.now}
                />
              </div>
              <div key="mission-progress-footer" className="panel-footer">
                <div className="action-row">
                  <button
                    className="primary-button"
                    onClick={() => {
                      if (activeRun) onTab("work");
                      else setDismissedRunId(progressRun.id);
                    }}
                  >
                    {activeRun
                      ? "관수 작업 관리"
                      : "관수 구역 선택으로 돌아가기"}
                  </button>
                </div>
                <p>
                  {commandHint ??
                    (progressRun.source === "simulation"
                      ? "가상 장비 보고를 바탕으로 진행 상황을 표시합니다."
                      : "장비가 보고한 상태를 바탕으로 진행 상황을 표시합니다.")}
                </p>
              </div>
            </>
          ) : (
            (areaManagement ?? (
              <>
                {onManageAreas && (
                  <div className="area-selection-strip">
                    <strong>관수 구역 선택</strong>
                    <button
                      type="button"
                      className="text-button"
                      onClick={onManageAreas}
                    >
                      추가 정원 경계 관리
                    </button>
                  </div>
                )}
                {readOnlyMap ? (
                  <div className="panel-body garden-detail-body">
                    <div className="section-intro">
                      <h2>선택한 관수 구역</h2>
                      <p className="detail-subtitle">
                        {detail.data?.zones
                          .filter(({ id }) => detail.selectedIds.includes(id))
                          .map(({ letter, name }) => `${letter} · ${name}`)
                          .join(", ") || "선택한 구역이 없습니다."}
                      </p>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={onOpenOverview}
                    >
                      전체 지도에서 구역 선택
                    </button>
                  </div>
                ) : (
                  <GardenDetailPanel detail={detail} blocked={!!activeRun} />
                )}
              </>
            ))
          )}
        </>
      ) : tab === "mission" ? (
        readOnlyMap ? (
          <div className="panel-body">
            <div className="section-intro">
              <h2>{missionDraft?.name || "관수 미션"}</h2>
              <p className="detail-subtitle">
                {missionDraft?.points.length ?? 0}개 지점
              </p>
            </div>
            <button className="secondary-button" onClick={onOpenOverview}>
              전체 지도에서 미션 편집
            </button>
          </div>
        ) : missionDraft ? (
          <MissionView
            simulation={simulation}
            draft={missionDraft}
            setDraft={onMissionDraft}
            onStarted={onMissionStarted}
          />
        ) : (
          <div className="panel-body" role="status">
            미션을 불러오는 중입니다…
          </div>
        )
      ) : (
        <>
          <div key={tab} className="panel-body">
            {tab === "work" && (
              <WorkView
                simulation={simulation}
                zone={selected.id}
                chooseZone={onChooseZone}
                openMission={() => onTab("mission")}
              />
            )}
            {tab === "device" && <EquipmentView simulation={simulation} />}
            {tab === "history" && <HistoryView simulation={simulation} />}
          </div>
          <div key={`${tab}-footer`} className="panel-footer">
            {tab === "work" ? (
              activeRun ? (
                <div className="action-row control-actions">
                  {halt === "paused" ? (
                    <button
                      className="primary-button"
                      disabled={pausePending}
                      onClick={() => issue("resume")}
                    >
                      <Play size={16} fill="currentColor" />
                      재개
                    </button>
                  ) : (
                    <button
                      className="primary-button"
                      disabled={pausePending || !!halt}
                      onClick={() => issue("pause")}
                    >
                      <Pause size={16} fill="currentColor" />
                      일시정지
                    </button>
                  )}
                  <button
                    className="stop-button"
                    disabled={pausePending}
                    onClick={onStop}
                  >
                    <Square size={13} fill="currentColor" />
                    종료
                  </button>
                  {estopButton}
                </div>
              ) : (
                <div className="action-row">
                  <button
                    className="primary-button"
                    onClick={() => onTab("mission")}
                  >
                    <Route size={16} />
                    미션 편집·실행
                  </button>
                </div>
              )
            ) : tab === "device" ? (
              <div className="action-row control-actions">
                <button
                  className="primary-button"
                  onClick={() => onTab("mission")}
                >
                  미션으로 이동
                </button>
              </div>
            ) : null}
            <p>
              <span className="footer-dot" />
              {commandHint ??
                (tab === "work" || tab === "device"
                  ? "실제 장비로 명령을 전송하지 않는 데모입니다."
                  : "모든 정보는 가상 데이터입니다.")}
            </p>
          </div>
        </>
      )}
      <div className="map-legend">
        <span>
          <i className="legend-dot" />
          관수 구역
        </span>
        <span>
          <i className="legend-line" />
          경로
        </span>
        <span>
          <i className="detail-legend-trail" />
          UGV 위치
        </span>
        <span className="legend-note">가상 데이터</span>
      </div>
    </aside>
  );
}
