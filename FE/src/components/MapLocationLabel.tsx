import type { MapView } from "./WorkspaceMapTabs";

/**
 * A fixed place label, independent of the moving map and its controls.
 * 등록한 위치가 있는 정원(place)은 그 이름과 주소를, 없으면 시연 지도의 장소를 보여 준다.
 */
export default function MapLocationLabel({
  view,
  place,
}: {
  view: MapView;
  place?: { name: string; address: string };
}) {
  const detail = view === "detail";
  return (
    <section className="map-location-label" aria-label="현재 지도 위치">
      <span className="map-location-eyebrow">
        <i aria-hidden="true" />
        ACTIVE GARDEN
      </span>
      <h1>
        {place?.name ?? (detail ? "원형 화단 · 장미 정원" : "순천만국가정원")}
      </h1>
      <p>
        {place
          ? place.address
          : detail
            ? "순천만국가정원 · 정원 상세"
            : "전라남도 순천시"}
      </p>
    </section>
  );
}
