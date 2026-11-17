import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AdminNewGarden } from "../api/types";
import { errorMessage } from "../api/useApiData";
import GardenBoundaryMap, { type BoundaryValue } from "./GardenBoundaryMap";
import type { AdminData, AdminGarden } from "./types";
import { accountById, accountName, gardensOf, ownerOfDevice } from "./ui";

/**
 * 실제 서버 계정의 정원 등록·수정 폼. 주소를 검색해 위성지도를 옮기고, 지도에 경계를 그려 위경도로 저장한다.
 * garden 을 주면 그 정원의 값과 경계가 채워진 "정원 수정"으로 열린다.
 * 가상 데이터 계정은 예시 항공사진에 그리는 AddGardenForm 을 쓴다.
 */
export default function AddGeoGardenForm({
  data,
  garden,
  busy,
  onCancel,
  onSubmit,
}: {
  data: AdminData;
  /** 고칠 정원. 없으면 새로 등록한다. */
  garden?: AdminGarden;
  /** 요청을 처리하는 중이면 등록 버튼을 잠근다. */
  busy: boolean;
  onCancel: () => void;
  /**
   * 실패하면 안내 문장을, 성공하면 null 을 돌려준다.
   * 수정할 때 경계를 고치지 않았으면 geo 가 비어 있다(저장된 경계를 다시 쓰지 않는다).
   */
  onSubmit: (input: AdminNewGarden) => Promise<string | null>;
}) {
  // 운영자 정원과 관리자(시험용) 정원을 등록할 수 있다.
  const customers = [
    ...data.customers.filter((c) => c.status === "active"),
    ...data.admins.map((a) => ({ ...a, name: `${a.name} (관리자)` })),
  ];
  const [customerId, setCustomerId] = useState(
    garden?.customerId ?? customers[0]?.id ?? "",
  );
  const [name, setName] = useState(garden?.name ?? "");
  const [address, setAddress] = useState(garden?.address ?? "");
  const [flower, setFlower] = useState(garden?.flower ?? "");
  const [deviceId, setDeviceId] = useState(garden?.deviceId ?? "");
  // 면적은 경계로 계산한 값을 채워 두고, 관리자가 직접 고치면 그 값을 쓴다.
  // 수정할 때 경계를 그대로 두면 저장된 면적을 보여 준다.
  const [typedArea, setTypedArea] = useState<string | null>(null);
  const [boundary, setBoundary] = useState<BoundaryValue>({
    geo: null,
    area: 0,
    problem: "",
    edited: false,
  });
  // 주인과 장비 배정은 수정 폼에서 바꾸지 않는다(옆 창의 소유권 이전·장비 배정에서 바꾼다).
  const owner = garden ? accountById(data, garden.customerId) : undefined;
  // 목록 아래쪽 정원의 수정 버튼을 눌러도 폼이 보이게 페이지 맨 위로 올린다.
  useEffect(() => {
    if (garden) window.scrollTo({ top: 0 });
  }, []);
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState("");

  // query: 입력 중인 글자, keyword: 검색을 실행한 글자. 검색 결과는 keyword 별로 React Query가 보관한다.
  const [query, setQuery] = useState("");
  const [keyword, setKeyword] = useState("");
  const [tooShort, setTooShort] = useState(false);
  const search = useQuery({
    queryKey: ["admin", "geocode", keyword],
    queryFn: () => api.admin.searchAddress!(keyword),
    enabled: keyword.length >= 2 && !!api.admin.searchAddress,
    // 주소는 자주 바뀌지 않는다. 같은 검색어는 5분 동안 받아 둔 결과를 그대로 쓴다.
    staleTime: 5 * 60 * 1000,
  });
  const results = search.data ?? [];
  const searchMessage = tooShort
    ? "검색어를 2자 이상 입력해 주세요."
    : search.isError
      ? errorMessage(search.error)
      : search.isSuccess && !results.length
        ? "검색 결과가 없습니다. 지도를 직접 옮겨 찾아 주세요."
        : "";
  const [focus, setFocus] = useState<[number, number] | null>(null);

  // 장비는 한 고객의 정원만 맡는다. 다른 고객이 쓰는 장비는 고를 수 없다.
  const devices = data.devices.filter((v) => {
    const owner = ownerOfDevice(data, v.id);
    return !owner || owner.id === customerId;
  });

  const trimmed = name.trim();
  const keepStoredBoundary = !!garden && !boundary.edited;
  const area =
    typedArea ??
    (keepStoredBoundary
      ? String(garden.area)
      : boundary.area
        ? boundary.area.toFixed(0)
        : "");
  const areaValue = Number(area);
  // 이름 중복은 서버와 같은 기준으로 본다. 비활성 정원은 이름이 겹쳐도 된다(서버가 검사하지 않는다).
  // 다시 사용으로 바꿀 때 서버가 검사한다.
  const nameTaken =
    garden?.status !== "inactive" &&
    gardensOf(data, customerId).some(
      (g) =>
        g.id !== garden?.id && g.status !== "inactive" && g.name === trimmed,
    );
  // 저장된 경계를 그대로 두는 수정은 지도 없이도 저장할 수 있다(지도 키가 없거나 지도를 불러오지 못한 경우).
  const boundaryProblem = keepStoredBoundary
    ? ""
    : boundary.problem ||
      (boundary.geo ? "" : "지도에 정원 경계를 그리고 닫아 주세요.");
  const problem = !customerId
    ? "소유 계정을 선택해 주세요."
    : !trimmed || trimmed.length > 100
      ? "정원 이름을 1~100자로 입력해 주세요."
      : nameTaken
        ? "이 고객에게 같은 이름의 정원이 있습니다."
        : boundaryProblem
          ? boundaryProblem
          : !(areaValue > 0)
            ? "정원 면적은 0보다 큰 숫자로 입력해 주세요."
            : "";

  function runSearch() {
    const next = query.trim();
    setTooShort(next.length < 2);
    if (next.length < 2) return;
    // 실패했던 검색어를 다시 누르면 다시 요청한다. 새 검색어는 keyword 가 바뀌면서 요청된다.
    if (next === keyword && search.isError) void search.refetch();
    else setKeyword(next);
  }

  return (
    <form
      className="adm-card adm-form adm-garden-form"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        // 경계 확인은 problem 에 들어 있다. 경계를 그대로 두는 수정은 경계 없이 보낸다.
        if (problem) return;
        onSubmit({
          customerId,
          name: trimmed,
          address: address.trim(),
          flower: flower.trim(),
          area: areaValue,
          deviceId: deviceId || null,
          geo: keepStoredBoundary ? undefined : (boundary.geo ?? undefined),
          // 사진 기준 자료는 가상 데이터에만 있다.
          shape: "",
          label: [0, 0],
          route: [],
        }).then((message) => setFailed(message ?? ""));
      }}
    >
      {garden ? (
        <h2>
          정원 수정 <span className="adm-muted">· {garden.name}</span>
        </h2>
      ) : (
        <h2>정원 등록</h2>
      )}
      <div className="adm-garden-form-body">
        <div>
          <div className="adm-form-grid">
            {garden ? (
              // 잠긴 입력란에는 마우스 안내가 뜨지 않는 브라우저가 있어 안내를 label 에 단다.
              <label title="소유 계정은 옆 창의 소유권 이전에서 바꿉니다.">
                <span>소유 계정</span>
                <input
                  value={
                    owner
                      ? `${accountName(owner)} · ${owner.email}`
                      : garden.customerId
                  }
                  disabled
                />
              </label>
            ) : (
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
            )}
            <label>
              <span>정원 이름 (필수)</span>
              <input
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          </div>

          <div className="adm-geo-search">
            <label htmlFor="garden-address-search">
              <span>주소 검색</span>
            </label>
            <div className="adm-geo-search-row">
              <input
                id="garden-address-search"
                value={query}
                maxLength={100}
                placeholder="장소 이름이나 도로명 주소"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // 검색창의 Enter 는 정원 등록이 아니라 검색이다.
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  runSearch();
                }}
              />
              <button
                type="button"
                className="secondary-button"
                disabled={search.isFetching}
                onClick={runSearch}
              >
                <Search size={14} /> 검색
              </button>
            </div>
            <div className="adm-geo-results" aria-live="polite">
              {search.isFetching && <p>검색 중입니다…</p>}
              {!search.isFetching && searchMessage && <p>{searchMessage}</p>}
              {!tooShort && results.length > 0 && (
                <ul>
                  {results.map((r) => (
                    <li key={`${r.address}:${r.lat}:${r.lng}`}>
                      <button
                        type="button"
                        className={
                          focus?.[0] === r.lat && focus[1] === r.lng
                            ? "active"
                            : undefined
                        }
                        title={r.address}
                        onClick={() => {
                          setFocus([r.lat, r.lng]);
                          setAddress(r.address);
                        }}
                      >
                        <strong>{r.title}</strong>
                        <small>{r.address}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="adm-form-grid">
            <label className="adm-form-wide">
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
                value={area}
                inputMode="decimal"
                placeholder="경계를 그리면 계산됩니다"
                onChange={(e) => setTypedArea(e.target.value)}
              />
            </label>
            {!garden && (
              <label className="adm-form-wide">
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
            )}
          </div>
        </div>
        <div className="adm-garden-map">
          <div className="adm-garden-map-head">
            <span>
              <strong>정원 경계 (필수)</strong>
              {boundary.geo
                ? `약 ${Math.round(boundary.area).toLocaleString("ko-KR")} m²`
                : "위성지도에 그립니다"}
            </span>
            {garden && boundary.edited && (
              <span className="adm-geo-legend">흰 점선: 수정 전 경계</span>
            )}
          </div>
          <GardenBoundaryMap
            focus={focus}
            initial={garden?.geo}
            onChange={setBoundary}
          />
        </div>
      </div>
      <div className="adm-form-foot">
        <p role="status">{(tried ? problem : "") || failed}</p>
        <button type="button" className="secondary-button" onClick={onCancel}>
          {garden ? "변경 취소" : "취소"}
        </button>
        <button type="submit" className="primary-button" disabled={busy}>
          {garden ? "저장" : "등록"}
        </button>
      </div>
    </form>
  );
}
