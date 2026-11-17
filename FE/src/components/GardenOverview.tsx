import Dropdown from "./Dropdown";
import type { Zone } from "../types/dashboard";

export default function GardenOverview({
  gardens,
  garden,
  setGarden,
  mapContext,
  showSwitcher = true,
}: {
  gardens: Zone[];
  garden: Zone;
  setGarden: (id: string) => void;
  mapContext?: { title: string; description: string };
  showSwitcher?: boolean;
}) {
  return (
    <div className="map-heading">
      <span className="eyebrow">
        <i />
        {mapContext ? "SUNCHEON NATIONAL GARDEN" : "ACTIVE GARDEN"}
      </span>
      <h1 title={mapContext?.title ?? garden.name}>
        {mapContext?.title ?? garden.name}
      </h1>
      <p>{mapContext?.description ?? garden.address}</p>
      {showSwitcher && (
        <Dropdown
          label="정원 선택"
          className="garden-switch-wrap"
          triggerClassName="garden-switch"
          value={garden.id}
          options={gardens.map((z) => ({ value: z.id, label: z.name }))}
          onChange={setGarden}
        >
          <span>{mapContext ? "운영 정보" : "정원 전환"}</span>
          <small>{gardens.length}곳</small>
        </Dropdown>
      )}
    </div>
  );
}
