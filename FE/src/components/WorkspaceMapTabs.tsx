import { Layers, Leaf } from "lucide-react";
import TabIndicator from "./TabIndicator";

export type MapView = "overview" | "detail";

/** Header navigation commits only after the workspace permits a map change. */
export default function WorkspaceMapTabs({
  view,
  onView,
}: {
  view: MapView;
  onView: (view: MapView) => Promise<boolean>;
}) {
  const modes = [
    { id: "overview", name: "전체 지도", icon: Layers },
    { id: "detail", name: "정원 상세", icon: Leaf },
  ] as const;
  return (
    <div
      className="map-mode tab-indicator-track"
      role="tablist"
      aria-label="지도 보기 방식"
    >
      <TabIndicator activeKey={view} variant="pill" />
      {modes.map(({ id, name, icon: Icon }) => (
        <button
          key={id}
          data-tab-key={id}
          id={`map-view-${id}`}
          role="tab"
          aria-selected={view === id}
          aria-controls="garden-map-surface"
          tabIndex={view === id ? 0 : -1}
          className={view === id ? "active" : ""}
          onClick={() => {
            void onView(id);
          }}
          onKeyDown={async (event) => {
            const target =
              event.key === "ArrowRight" || event.key === "End"
                ? "detail"
                : event.key === "ArrowLeft" || event.key === "Home"
                  ? "overview"
                  : null;
            if (target) {
              event.preventDefault();
              if (await onView(target))
                document.getElementById(`map-view-${target}`)?.focus();
            }
          }}
        >
          <Icon size={14} />
          {name}
        </button>
      ))}
    </div>
  );
}
