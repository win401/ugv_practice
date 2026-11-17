import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Droplets,
  ShieldAlert,
  Wifi,
  X,
} from "lucide-react";
import { useBlocker } from "react-router";
import { api } from "../api/client";
import { DEMO_DATE } from "../api/time";
import type { OperatorDashboard } from "../api/types";
import type { GardenArea } from "../api/gardenAreas";
import type { Point } from "../api/gardenDetail";
import { useApiData } from "../api/useApiData";
import type { Tab } from "../types/dashboard";
import type { MissionDraft } from "../types/missionDraft";
import { useIrrigationSimulation } from "../hooks/useIrrigationSimulation";
import { useWorkspaceGardenScene } from "../hooks/useWorkspaceGardenScene";
import { useGardenAreas } from "../hooks/useGardenAreas";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { clockOf } from "../data/controlExample";
import { draftOf, isDirty } from "../lib/missionDraft";
import { suncheonMapConfig, vworldApiKey } from "../lib/vworldMap";
import { gardenLatLngToImage } from "../lib/gardenGeoFrame";
import { unprojectGardenZone } from "../lib/gardenZoneProjection";
import { GARDEN_DETAIL_ZOOM } from "../lib/gardenCamera";
import GardenMap from "../components/GardenMap";
import GardenDetailMap from "../components/GardenDetailMap";
import SuncheonMap, { type SuncheonMapHandle } from "../components/SuncheonMap";
import WorkspaceMapToolbar from "../components/WorkspaceMapToolbar";
import WorkspaceMapTabs, { type MapView } from "../components/WorkspaceMapTabs";
import TopBar from "../components/TopBar";
import MapLocationLabel from "../components/MapLocationLabel";
import StopWorkDialog from "../components/StopWorkDialog";
import SafetyAlert from "../components/SafetyAlert";
import WorkspacePanel from "./WorkspacePanel";
import { GardenAreasPanel } from "./GardenAreasPanel";
import InfoView from "./InfoView";
/** 운영자(정원주인) 화면. 내 정원·장비·이력을 API에서 받아 그린다. */
export default function WorkspaceView({ onLogout }: { onLogout: () => void }) {
  // 관리자만 쓴다: 운영 화면으로 볼 고객
  const [customerId, setCustomerId] = useState<string | undefined>();
  // 고객을 바꾸면 이름(key)이 달라져 그 고객의 정원을 새로 불러온다.
  const { data, error, reload } = useApiData(
    ["operator", "dashboard", customerId ?? null],
    () => api.operator.dashboard(customerId),
  );
  // 받아 둔 데이터가 있으면 뒤에서 하는 재확인이 실패해도 화면을 그대로 둔다.
  // 화면을 오류로 바꾸면 편집 중이던 미션·구역 초안이 사라진다.
  if (!data)
    return (
      <div className="screen-message">
        <p>{error ?? "정원 정보를 불러오는 중입니다…"}</p>
        {error && (
          <button className="secondary-button" onClick={onLogout}>
            다시 로그인
          </button>
        )}
      </div>
    );
  if (data.gardens.length === 0)
    return (
      <FirstGarden data={data} onLogout={onLogout} onCustomer={setCustomerId} />
    );
  return (
    <Workspace
      // 고객을 바꾸면 선택·회차 같은 화면 상태를 새로 시작한다.
      key={data.viewAs?.customerId ?? data.user.id}
      data={data}
      reload={reload}
      onLogout={onLogout}
      onCustomer={setCustomerId}
    />
  );
}

/** Coordinates the independent map, panel, mission and boundary editing states. */
function Workspace({
  data,
  reload,
  onLogout,
  onCustomer,
}: {
  data: OperatorDashboard;
  reload: () => void;
  onLogout: () => void;
  onCustomer: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("info");
  const [zone, setZone] = useState(
    () =>
      data.devices.find(
        (v) =>
          v.state === "working" &&
          data.gardens.some((g) => g.id === v.activeGardenId),
      )?.activeGardenId ?? data.gardens[0].id,
  );
  const [mapView, setMapView] = useState<MapView>("overview");
  const [bell, setBell] = useState(false);
  const [readAt, setReadAt] = useState(0);
  const [stopDialog, setStopDialog] = useState(false);
  const [missionDraft, setMissionDraft] = useState<MissionDraft | null>(null);
  const [manageAreas, setManageAreas] = useState(false);
  const [mapZoom, setMapZoom] = useState(16);
  const [mapReady, setMapReady] = useState(false);
  const liveMap = useRef<SuncheonMapHandle>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const areas = useGardenAreas(data.viewAs?.customerId ?? data.user.id);
  const simulation = useIrrigationSimulation(zone, data, reload);
  const {
    user,
    device,
    selected,
    activeRun,
    command,
    issue,
    events,
    missionOf,
    toast,
    setToast,
  } = simulation;
  const isDetail = mapView === "detail";
  // 서버에 등록한 정원의 위경도 경계를 전체 지도에 그린다. 가상 데이터의 정원에는 경계가 없어 해당하지 않는다.
  const registeredAreas = useMemo(
    () =>
      data.gardens.flatMap((garden): GardenArea[] =>
        garden.geo
          ? [
              {
                id: `garden:${garden.id}`,
                name: garden.name,
                // GeoJSON은 [경도, 위도]이고 마지막 점이 첫 점과 같다. 지도는 [위도, 경도]를 쓴다.
                boundary: garden.geo.geojson.coordinates[0]
                  .slice(0, -1)
                  .map(([lng, lat]): [number, number] => [lat, lng]),
                detailKind: "satellite",
                isExample: false,
                createdAt: garden.registered,
              },
            ]
          : [],
      ),
    [data.gardens],
  );
  // 고른 정원이 삭제·비활성으로 목록에서 빠지면 zone 은 없는 정원을 가리킨다. 그때 정보 패널은 첫 정원(selected)으로
  // 넘어가므로, 지도도 zone 이 아니라 selected 를 따라가야 패널과 지도가 같은 정원을 보여 준다.
  const selectedGardenArea =
    registeredAreas.find((area) => area.id === `garden:${selected.id}`) ?? null;
  // "정원 상세"의 예시 그림은 순천만 시연 자료다. 등록한 위치가 있는 정원은 그림 대신
  // 위성지도에서 그 정원만 크게 보여 준다. imageDetail 은 예시 그림을 보여 주는 경우다.
  const imageDetail = isDetail && !selectedGardenArea;
  // 고른 정원이 등록된 위치로 지도를 옮긴다. 정원을 바꿨을 때 한 번만 옮긴다.
  // 지도를 움직이거나 확대할 때마다 다시 옮기면 사용자가 본 자리로 되돌아가 버린다.
  const focusedGardenArea = useRef<string | null>(null);
  useEffect(() => {
    // 정원 상세에 다녀오면 지도가 새로 만들어지므로 다시 옮겨야 한다.
    if (isDetail) focusedGardenArea.current = null;
    if (!mapReady || isDetail || !selectedGardenArea) return;
    if (focusedGardenArea.current === selectedGardenArea.id) return;
    focusedGardenArea.current = selectedGardenArea.id;
    liveMap.current?.focusArea(selectedGardenArea.id);
  }, [mapReady, isDetail, selectedGardenArea?.id]);
  const { detail, overview, illustration } = useWorkspaceGardenScene(
    simulation,
    tab,
    missionDraft,
    data.viewAs?.customerId ?? data.user.id,
    !isDetail,
  );
  const missionDirty =
    !!missionDraft && isDirty(missionDraft, missionOf(missionDraft.gardenId)!);
  const unread = events.some((e) => e.at > readAt);

  useEffect(() => {
    if (tab !== "mission") {
      setMissionDraft(null);
      return;
    }
    if (!missionDraft || missionDraft.gardenId !== selected.id)
      setMissionDraft(draftOf(missionOf(selected.id)!));
  }, [tab, selected.id]);
  useEffect(() => {
    if (!missionDirty && !areas.dirty && !detail.editor.dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [missionDirty, areas.dirty, detail.editor.dirty]);
  // 위 경고는 페이지를 새로 불러올 때만 뜬다. 관리자 페이지 버튼이나 브라우저의 뒤로가기처럼
  // 새로 불러오지 않고 옮기는 이동은 라우터가 막아 두고, 같은 확인 창을 거친 뒤에 보낸다.
  const blocker = useBlocker(
    missionDirty || areas.dirty || detail.editor.dirty,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    void leaveWorkspace().then((leave) =>
      leave ? blocker.proceed() : blocker.reset(),
    );
  }, [blocker.state]);

  async function leaveDrafts(includeMission: boolean) {
    if (areas.saving || detail.editor.saving) return false;
    const hasZoneChanges = detail.editor.dirty;
    const hasMissionChanges = includeMission && missionDirty;
    if (areas.dirty || hasMissionChanges || hasZoneChanges) {
      const accepted = await confirm({
        title: "편집 중인 내용을 나갈까요?",
        message: `${[
          hasZoneChanges ? "관수 구역의 이름·경계" : null,
          areas.dirty ? "추가 정원 경계" : null,
          hasMissionChanges ? "미션" : null,
        ]
          .filter(Boolean)
          .join(
            ", ",
          )} 수정 내용이 저장되지 않았습니다.\n이동하면 저장하지 않은 내용이 사라집니다.`,
        confirmLabel: "저장하지 않고 이동",
        cancelLabel: "계속 편집",
      });
      if (!accepted) return false;
    }
    // Discard only after every relevant draft has been confirmed together.
    if (areas.drawing) areas.cancel();
    if (detail.editor.draft) detail.editor.cancel();
    return true;
  }
  const leaveAreaDraft = () => leaveDrafts(false);
  const leaveWorkspace = () => leaveDrafts(true);
  async function changeTab(next: Tab) {
    if (next === tab) return;
    if (!(await leaveDrafts(tab === "mission"))) return;
    setTab(next);
  }
  async function changeMapView(next: MapView): Promise<boolean> {
    if (next === mapView) return true;
    if (!(await leaveDrafts(false))) return false;
    // The mission draft stays available when returning to the overview.
    setMapView(next);
    return true;
  }
  async function chooseZone(id: string) {
    // 지금 보이는 정원(selected)과 비교한다. zone 은 삭제된 정원을 가리키고 있을 수 있다.
    if (id === selected.id || !(await leaveWorkspace())) return;
    setMissionDraft(null);
    setZone(id);
  }
  async function focusArea(id: string) {
    // 고른 정원의 경계를 누르면 지도를 그 정원에 다시 맞춘다.
    if (id.startsWith("garden:")) {
      liveMap.current?.focusArea(id);
      return;
    }
    if (!(await leaveAreaDraft())) return;
    areas.select(id);
    liveMap.current?.focusArea(id);
  }
  async function removeArea(id: string) {
    if (areas.saving) return;
    const area = areas.areas.find((item) => item.id === id);
    if (!area) return;
    const accepted = await confirm({
      title: "정원 구역을 삭제할까요?",
      message: `‘${area.name}’ 경계를 삭제합니다.\n삭제한 경계는 되돌릴 수 없습니다.`,
      confirmLabel: "구역 삭제",
      cancelLabel: "취소",
      tone: "danger",
    });
    if (accepted) await areas.remove(id);
  }
  const pickMissionPoint =
    !isDetail && tab === "mission" && missionDraft?.selectedId
      ? (point: Point) => {
          const [lng, lat] = unprojectGardenZone(point);
          const [x, y] = gardenLatLngToImage([lat, lng]);
          setMissionDraft(
            (d) =>
              d && {
                ...d,
                points: d.points.map((p) =>
                  p.id === d.selectedId ? { ...p, x, y } : p,
                ),
              },
          );
        }
      : undefined;
  const customAreas = {
    ...areas,
    areas: areas.areas.filter((area) => !area.isExample),
  };
  const areaManagement =
    manageAreas && !isDetail ? (
      <>
        <div className="area-selection-strip">
          <strong>추가 정원 경계</strong>
          <button
            className="text-button"
            onClick={async () => {
              if (await leaveAreaDraft()) setManageAreas(false);
            }}
          >
            관수 구역으로 돌아가기
          </button>
        </div>
        <GardenAreasPanel
          state={customAreas}
          mapReady={mapReady}
          onOpen={focusArea}
          onFocus={focusArea}
          onCancel={() => {
            void leaveAreaDraft();
          }}
          onRemove={removeArea}
          safetyAction={null}
          operatingInfo={
            <InfoView
              simulation={simulation}
              todayDone={
                simulation.records.filter(
                  (r) => r.date === DEMO_DATE && r.complete,
                ).length
              }
              openDevice={() => changeTab("device")}
            />
          }
        />
      </>
    ) : undefined;
  // 등록한 위치가 있는 정원의 정보 탭. 순천만 시연용 구역 목록 대신 정원 정보를 보여 준다.
  const registeredGardenInfo = selectedGardenArea ? (
    <div className="panel-body">
      <InfoView
        simulation={simulation}
        todayDone={
          simulation.records.filter((r) => r.date === DEMO_DATE && r.complete)
            .length
        }
        openDevice={() => changeTab("device")}
      />
      <p className="registered-garden-empty">
        이 정원의 관수 구역은 아직 등록되지 않았습니다.
      </p>
    </div>
  ) : undefined;

  return (
    <div
      className={`app map-workspace ${imageDetail ? "garden-detail-active" : "overview-map-active"}`}
    >
      <TopBar
        mapNavigation={
          <WorkspaceMapTabs view={mapView} onView={changeMapView} />
        }
        bell={bell}
        read={!unread}
        setBell={setBell}
        setTab={changeTab}
        user={user}
        device={device}
        onLogout={async () => {
          if (await leaveWorkspace()) onLogout();
        }}
        viewAs={data.viewAs}
        onCustomer={async (id) => {
          if (await leaveWorkspace()) onCustomer(id);
        }}
      />
      <main className="workspace">
        <div
          className="map-area"
          role="tabpanel"
          id="garden-map-surface"
          aria-labelledby={`map-view-${mapView}`}
        >
          {imageDetail && (
            <span className="garden-detail-example-badge">
              실제 위치와 다를 수 있는 예시 화면
            </span>
          )}
          {imageDetail ? (
            illustration ? (
              <GardenDetailMap
                scene={illustration}
                zoom={detail.zoom}
                onZoom={detail.setZoom}
                cameraReset={detail.cameraReset}
                focusRobot={detail.focusRobot}
              />
            ) : (
              <div className="detail-map-loading" role="status">
                {detail.error ?? "정원 상세를 불러오는 중입니다…"}
              </div>
            )
          ) : (
            <SuncheonMap
              ref={liveMap}
              apiKey={vworldApiKey}
              onZoomChange={setMapZoom}
              // 관수 구역 A~X와 장비 표시는 순천만 시연 자료다. 등록한 위치가 있는 정원을 고르면
              // 그 정원과 맞지 않으므로 그리지 않고, 정원의 경계만 보여 준다.
              scene={
                overview && !selectedGardenArea
                  ? {
                      ...overview,
                      selectable: overview.selectable && !areas.drawing,
                    }
                  : undefined
              }
              onScenePick={
                detail.editor.drawing && !detail.editor.blocked
                  ? detail.editor.addDrawingPoint
                  : pickMissionPoint
              }
              // 등록한 정원은 지금 고른 정원의 경계만 그린다. 다른 정원은 "운영 정원"에서 골라서 본다.
              // 예시 경계(순천만)는 시연 장면이 가려 주는데, 등록한 정원일 때는 장면이 없으므로 직접 뺀다.
              areas={
                selectedGardenArea
                  ? [
                      selectedGardenArea,
                      ...areas.areas.filter((area) => !area.isExample),
                    ]
                  : areas.areas
              }
              // 추가 정원 경계 목록은 불러오면 첫 항목을 고른 상태가 된다. 그 값을 먼저 쓰면
              // 등록한 정원이 강조되지 않으므로, 등록한 정원을 고른 상태에서는 그 정원을 강조한다.
              selectedAreaId={selectedGardenArea?.id ?? areas.selectedId}
              onSelectArea={focusArea}
              drawing={areas.drawing && !areas.saving}
              draftPoints={areas.points}
              onDraftPoint={areas.addPoint}
              onReadyChange={setMapReady}
              // 등록한 정원의 "정원 상세": 그 정원만 크게, 보기 전용으로 보여 준다.
              viewArea={isDetail ? selectedGardenArea : null}
              readonly={isDetail}
            />
          )}
        </div>
        <MapLocationLabel
          view={mapView}
          // 등록한 위치가 있는 정원은 그 정원의 이름과 주소를 보여 준다.
          place={
            selectedGardenArea
              ? { name: selected.name, address: selected.address }
              : undefined
          }
        />
        <WorkspaceMapToolbar
          canZoomIn={
            imageDetail
              ? detail.zoom < GARDEN_DETAIL_ZOOM.max
              : mapReady && mapZoom < suncheonMapConfig.maxZoom
          }
          canZoomOut={
            imageDetail
              ? detail.zoom > GARDEN_DETAIL_ZOOM.min
              : mapReady && mapZoom > suncheonMapConfig.minZoom
          }
          onZoomIn={() =>
            imageDetail
              ? detail.setZoom((z) =>
                  Math.min(GARDEN_DETAIL_ZOOM.max, z * GARDEN_DETAIL_ZOOM.step),
                )
              : liveMap.current?.zoomIn()
          }
          onZoomOut={() =>
            imageDetail
              ? detail.setZoom((z) =>
                  Math.max(GARDEN_DETAIL_ZOOM.min, z / GARDEN_DETAIL_ZOOM.step),
                )
              : liveMap.current?.zoomOut()
          }
          onFit={() => {
            if (imageDetail) detail.fit();
            // 등록한 위치가 있는 정원은 순천만 예시가 아니라 그 정원에 맞춘다.
            else if (selectedGardenArea)
              liveMap.current?.focusArea(selectedGardenArea.id);
            else liveMap.current?.focusIllustration();
          }}
          // 등록한 정원에서는 장비의 실제 위치를 아직 모른다(시연용 위치는 순천만이다).
          canLocate={imageDetail || !selectedGardenArea}
          onLocate={() => {
            if (imageDetail) detail.locate();
            else if (illustration)
              liveMap.current?.focusVehicle(illustration.vehicle.point);
          }}
        />
        <WorkspacePanel
          tab={tab}
          onTab={changeTab}
          simulation={simulation}
          detail={detail}
          vehicle={illustration?.vehicle ?? null}
          readOnlyMap={isDetail}
          onOpenOverview={() => void changeMapView("overview")}
          missionDraft={missionDraft}
          onMissionDraft={(update) => setMissionDraft((d) => d && update(d))}
          onMissionStarted={() => {
            setMissionDraft(null);
            setTab("work");
          }}
          onChooseZone={chooseZone}
          onStop={() => setStopDialog(true)}
          areaManagement={areaManagement ?? registeredGardenInfo}
          onManageAreas={
            !isDetail
              ? async () => {
                  if (await leaveDrafts(false)) setManageAreas(true);
                }
              : undefined
          }
        />
      </main>
      {bell && (
        <div className="notification-panel">
          <div>
            <h3>알림</h3>
            <button
              className="text-button"
              onClick={() => {
                setReadAt(Date.now());
                setToast(
                  "알림을 읽음으로 표시했습니다. 안전 상태 해제와는 별개입니다.",
                );
              }}
            >
              <CheckCheck size={14} />
              모두 읽음
            </button>
            <button
              className="icon-button"
              aria-label="알림 닫기"
              onClick={() => setBell(false)}
            >
              <X size={17} />
            </button>
          </div>
          {events.length === 0 ? (
            <p className="notification-empty">새 알림이 없습니다.</p>
          ) : (
            events.slice(0, 6).map((e) => (
              <article key={e.id} className={e.at > readAt ? "unread" : ""}>
                <span className={`event-${e.kind}`}>
                  {e.kind === "safety" ? (
                    <ShieldAlert size={17} />
                  ) : e.kind === "command" ? (
                    <Wifi size={17} />
                  ) : (
                    <Droplets size={17} />
                  )}
                </span>
                <div>
                  <strong>
                    {e.title}
                    {e.kind === "safety" && !e.resolved && (
                      <em className="tag bad">미해결</em>
                    )}
                  </strong>
                  <p>
                    {e.detail} · {clockOf(e.at)}
                  </p>
                </div>
              </article>
            ))
          )}
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
      {simulation.alert && activeRun && (
        <SafetyAlert
          kind={simulation.alert}
          run={activeRun}
          command={command}
          lastReport={simulation.lastReport}
          now={simulation.now}
          onRefresh={simulation.refresh}
          onClose={simulation.dismissAlert}
        />
      )}
      {confirmDialog}
      {stopDialog && (
        <StopWorkDialog
          onClose={() => setStopDialog(false)}
          onConfirm={() => {
            issue("end");
            setStopDialog(false);
          }}
        />
      )}
    </div>
  );
}

/** 정원이 하나도 없는 운영자의 첫 화면. 정원 등록은 관리자가 한다. */
function FirstGarden({
  data,
  onLogout,
  onCustomer,
}: {
  data: OperatorDashboard;
  onLogout: () => void;
  onCustomer: (id: string) => void;
}) {
  return (
    <div className="app">
      <TopBar
        bell={false}
        read
        setBell={() => {}}
        setTab={() => {}}
        user={data.user}
        device={null}
        onLogout={onLogout}
        // 자기 정원이 없는 관리자도 고객을 골라 그 화면을 볼 수 있게 한다.
        viewAs={data.viewAs}
        onCustomer={onCustomer}
      />
      <main className="workspace">
        <div className="map-area">
          <GardenMap
            gardens={[]}
            draft={null}
            addDraftPoint={() => {}}
            zone=""
            setZone={() => {}}
            progress={0}
            mode="ready"
            activeZone=""
            zoom={1}
            schematic={false}
            deviceLabel={null}
          />
        </div>
        <aside className="panel" aria-label="정원 없음 안내">
          <div className="panel-heading">
            <span>
              <i />
              {data.user.name}님, 환영합니다
            </span>
          </div>
          <div className="panel-body">
            <p className="first-garden-intro">
              아직 등록된 정원이 없습니다. 정원 등록은 관리자가 합니다. 정원
              위치와 정보를 관리자에게 알려 주시면 등록하고 장비를 배정해
              드립니다.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
