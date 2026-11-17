# 관수 구역 저장 모델과 BE 연동 계약

`api.gardenZones`의 비동기 `read`, `create`, `update`는 현재 브라우저 어댑터를 사용한다. 지도에서 그릴 때만 위도·경도를 Web Mercator로 투영한다. 저장 기준은 WGS84 경계이며 상세 이미지 좌표는 저장에 쓰지 않는다.

| DTO 필드 | 내용 |
| --- | --- |
| `schemaVersion` | `3` |
| `id`, `mapId`, `name`, `displayCode`, `origin` | 구역 ID, 지도 ID, 이름, 표시 문자, 기본/추가 구분 |
| `boundary` | `M/L/Q/C/Z` 경계 명령 배열. 각 꼭짓점과 곡선 조절점은 `[경도, 위도]` |
| `label` | 전체 지도 이름표의 `[경도, 위도]` |
| `geojson` | 경계에서 계산한 Polygon 또는 MultiPolygon Feature. 곡선을 짧은 직선으로 나눈 닫힌 고리 |
| `routing` | 관수 접근 지점 연결 상태. 새 구역은 미연결 |
| `createdAt`, `updatedAt` | 생성·수정 시각. 서버 연동 시 BE 응답 규칙(ISO 한국 시간, 시간대 표기 없음)을 따른다. 브라우저 저장본은 UTC로 기록한다 |

GeoJSON의 `coordinateAccuracy`는 가져온 예시 경계의 경우 `illustrative`, 지도에서 경계를 편집하거나 새로 그린 경우 `map-edited`다. 예시 구역의 이름만 바꾸면 경계 출처는 유지한다. 이 화면의 경계 자료는 `navigationReady: false`로 내보낸다. [GeoJSON 표준 RFC 7946](https://datatracker.ietf.org/doc/html/rfc7946)

저장 키는 `saemgil-garden-zone-edits-v3:<scopeId>:<mapId>`다. 수정한 기본 구역과 추가 구역을 기록한다. 일치하는 이미지 개정의 v1·v2 저장본은 기존 배치를 사용해 예시 좌표로 읽는다. 다음 저장 성공 시 v3을 기록하고 이전 원문을 보존한다. v3은 이미지 개정이 바뀌어도 같은 지도와 고객의 경계를 읽는다.

화면 입력의 `shape`는 일시적인 투영 경계이며, 향후 HTTP API에는 `boundary`를 보낸다. `expectedRevision`은 현재 브라우저에서 오래된 수정을 확인하는 용도로 쓴다. 다른 사용자가 함께 편집할 때는 서버에서 버전 비교와 갱신을 하나의 트랜잭션으로 처리한다.

## 예정된 작업 — BE·DB 구현 시

아래는 합의할 API 계약의 제안이며, 현재 서버에 생성된 엔드포인트가 아니다.

| REST API 제안                               | 역할                                               |
| ------------------------------------------- | -------------------------------------------------- |
| `GET /api/maps/{mapId}/zones`            | 접근 가능한 지도의 구역 DTO와 버전 조회            |
| `POST /api/maps/{mapId}/zones`           | 이름과 위도·경도 경계로 새 구역 생성        |
| `PATCH /api/maps/{mapId}/zones/{zoneId}` | 버전을 확인하고 이름·경계 변경                     |
| `GET /api/maps/{mapId}/zones.geojson`    | 같은 버전의 지리 경계를 FeatureCollection으로 조회 |

- 경로는 기존 API와 같이 `/api`로 시작하고 버전을 붙이지 않는다(BE README의 API 응답 규칙). `mapId`는 정원 지도 ID이며, 운영자 `/api/me/...`·관리자 `/api/admin/...` 중 어디에 둘지는 권한 정책과 함께 정한다.
- 고객/사용자 범위는 인증된 계정과 지도 소유 관계로 서버에서 결정한다. 클라이언트가 전달한 `scopeId`만으로 접근 권한을 판단하지 않는다.
- 생성 ID·생성/수정 시각은 서버가 발급한다. 지도·구역 소유 관계, 이름, 닫힘·교차·크기·좌표 범위를 서버에서도 검증한다.
- `expectedRevision` 또는 `If-Match`를 사용해 트랜잭션 안에서 버전 조건부 갱신한다. 오래된 수정은 `409 Conflict` 또는 `412 Precondition Failed`로 명시하고 최신 값을 다시 읽게 한다.
- 서버에서도 위도·경도 경계로 GeoJSON을 생성·검증한다. 클라이언트의 `navigationReady`나 좌표 정확도 주장을 그대로 신뢰하지 않는다.
- 새 구역의 관수 접근 지점은 경로 요구사항과 실제 매핑 자료가 확정된 뒤 별도 API로 연결한다. 현재 그리기 기능이 임의의 운행 경로를 만들지는 않는다.

MySQL 테이블은 `garden_zones`와 같은 단위로 `id`, `map_id`, `name`, `display_code`, `origin`, `boundary` JSON, `geojson` JSON, `revision`, 생성/수정 시각을 둘 수 있다. 지도당 표시 문자의 중복 방지와 구역 ID의 고유성을 보장하고, 곡선 원본·파생 좌표·버전을 한 트랜잭션으로 저장한다. 실제 공간 검색이 필요해지면 SRID와 축 순서 정책을 검증한 뒤 별도 공간 컬럼·인덱스를 검토한다. 파일 내보내기만 필요한 현재 단계에서 공간 인덱스가 필수는 아니다. [MySQL JSON](https://dev.mysql.com/doc/refman/8.4/en/json.html) · [MySQL 공간 자료형](https://dev.mysql.com/doc/refman/8.4/en/spatial-types.html)

삭제·복구·변경 이력·GeoJSON 가져오기·실제 측량값 승인은 이번 구현에 포함하지 않았다. 해당 동작과 권한 정책이 정해지면 DTO/엔드포인트 및 Flyway 스키마를 함께 확정한다.
