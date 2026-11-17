import { Undo2 } from "lucide-react";
import { useState } from "react";
import type { AdminNewGarden } from "../api/types";
import GardenMap from "../components/GardenMap";
import {
  outlineToLabel,
  outlineToRoute,
  outlineToShape,
} from "../lib/gardenRoute";
import type { Zone } from "../types/dashboard";
import type { AdminData } from "./types";
import { gardensOf, ownerOfDevice } from "./ui";

/**
 * 관리자가 고객의 정원을 등록하는 폼. 정원 등록은 관리자만 한다.
 * 지도에 구역 꼭짓점을 찍어 경계를 정하고, 장비는 등록하면서 바로 배정할 수 있다.
 */
export default function AddGardenForm({
  data,
  onCancel,
  onSubmit,
}: {
  data: AdminData;
  onCancel: () => void;
  onSubmit: (input: AdminNewGarden) => void;
}) {
  // 운영자 정원과 관리자(시험용) 정원을 등록할 수 있다.
  const customers = [
    ...data.customers.filter((c) => c.status === "active"),
    ...data.admins.map((a) => ({ ...a, name: `${a.name} (관리자)` })),
  ];
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [flower, setFlower] = useState("");
  const [area, setArea] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [outline, setOutline] = useState<number[][]>([]);
  const [tried, setTried] = useState(false);

  // 고른 고객의 기존 정원을 지도에 참고로 보여 준다.
  const existing: Zone[] = gardensOf(data, customerId)
    .filter((g) => g.status !== "inactive")
    .map((g, i) => ({
      id: g.id,
      letter: String.fromCharCode(65 + (i % 26)),
      name: g.name,
      area: g.area,
      flower: g.flower,
      address: g.address,
      color: "#52525b",
      status: g.status,
      deviceId: g.deviceId,
      shape: g.shape,
      label: g.label,
      route: g.route,
    }));
  // 장비는 한 고객의 정원만 맡는다. 다른 고객이 쓰는 장비는 고를 수 없다.
  const devices = data.devices.filter((v) => {
    const owner = ownerOfDevice(data, v.id);
    return !owner || owner.id === customerId;
  });

  const trimmed = name.trim();
  const areaValue = Number(area);
  const problem = !customerId
    ? "소유 계정을 선택해 주세요."
    : !trimmed || trimmed.length > 100
      ? "정원 이름을 1~100자로 입력해 주세요."
      : existing.some((g) => g.name === trimmed)
        ? "이 고객에게 같은 이름의 정원이 있습니다."
        : !(areaValue > 0)
          ? "정원 면적은 0보다 큰 숫자로 입력해 주세요."
          : outline.length < 3
            ? "지도를 눌러 구역 꼭짓점을 3개 이상 찍어 주세요."
            : "";

  return (
    <form
      className="adm-card adm-form adm-garden-form"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (problem) return;
        onSubmit({
          customerId,
          name: trimmed,
          address: address.trim() || "주소 미입력",
          flower: flower.trim() || "미입력",
          area: areaValue,
          deviceId: deviceId || null,
          shape: outlineToShape(outline),
          label: outlineToLabel(outline),
          route: outlineToRoute(outline),
        });
      }}
    >
      <h2>정원 등록</h2>
      <div className="adm-garden-form-body">
        <div>
          <div className="adm-form-grid">
            <label>
              <span>소유 계정 (필수)</span>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setDeviceId("");
                }}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>정원 이름 (필수)</span>
              <input
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              <span>주소</span>
              <input
                value={address}
                maxLength={200}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>
            <label>
              <span>주요 식재</span>
              <input
                value={flower}
                maxLength={200}
                onChange={(e) => setFlower(e.target.value)}
              />
            </label>
            <label>
              <span>면적 m² (필수)</span>
              <input
                inputMode="decimal"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </label>
            <label>
              <span>장비 배정</span>
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                <option value="">나중에 배정</option>
                {devices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} · {v.serial}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="adm-garden-form-note">
            관리자가 등록한 정원은 바로 사용 중 상태가 됩니다. 장비를 배정하면
            고객 화면에서 관수할 수 있습니다.
          </p>
        </div>
        <div className="adm-garden-map">
          <div className="adm-garden-map-head">
            <span>
              <strong>지도 구역 (필수)</strong> 꼭짓점 {outline.length}개
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={outline.length === 0}
              onClick={() => setOutline((p) => p.slice(0, -1))}
            >
              <Undo2 size={13} /> 되돌리기
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={outline.length === 0}
              onClick={() => setOutline([])}
            >
              지우기
            </button>
          </div>
          <div className="adm-garden-map-frame">
            <GardenMap
              gardens={existing}
              draft={outline}
              addDraftPoint={(p) => setOutline((list) => [...list, p])}
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
          <p>
            예시 항공사진 위에 그립니다. 점선 구역은 이 고객의 기존 정원입니다.
          </p>
        </div>
      </div>
      <div className="adm-form-foot">
        <p role="status">{tried || outline.length >= 3 ? problem : ""}</p>
        <button type="button" className="secondary-button" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="primary-button">
          등록
        </button>
      </div>
    </form>
  );
}
