const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

// 정원 등록 화면의 좌표 계산(lib/gardenBoundary)을 브라우저 없이 확인한다.
const output = fs.mkdtempSync(
  path.join(os.tmpdir(), "saemgil-garden-boundary-"),
);
fs.mkdirSync(path.join(output, "lib"));
for (const name of ["zoneGeometry", "zoneGeoJson", "gardenBoundary"]) {
  fs.writeFileSync(
    path.join(output, "lib", `${name}.js`),
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src/lib", `${name}.ts`), "utf8"),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
        },
      },
    ).outputText,
  );
}
const {
  planeAt,
  boundaryPreview,
  gardenGeoFromShape,
  shapeFromGardenGeo,
} = require(path.join(output, "lib/gardenBoundary.js"));
const {
  polygonShapeFromPoints,
  convertZoneSegmentToCurve,
  moveZoneBoundaryHandle,
  getZoneBoundaryHandles,
} = require(path.join(output, "lib/zoneGeometry.js"));
test.after(() => fs.rmSync(output, { recursive: true, force: true }));

// 순천만국가정원 근처. [경도, 위도]
const ORIGIN = [127.4988913, 34.9292319];
/** 기준점에서 동쪽·북쪽으로 몇 m 떨어진 자리 */
const offset = (east, north) => [
  ORIGIN[0] + east / (111320 * Math.cos((ORIGIN[1] * Math.PI) / 180)),
  ORIGIN[1] + north / 110574,
];

test("평면 좌표는 위경도로 되돌아온다", () => {
  const plane = planeAt(ORIGIN);
  const position = offset(120, -80);
  const [lng, lat] = plane.unproject(plane.project(position));
  // 소수 일곱째 자리(약 1cm) 안에서 같다.
  assert.ok(Math.abs(lng - position[0]) < 2e-7);
  assert.ok(Math.abs(lat - position[1]) < 2e-7);
  assert.deepEqual(plane.project(ORIGIN), [0, 0]);
});

test("직선 경계: 넓이, 중심, 닫힌 GeoJSON", () => {
  const plane = planeAt(ORIGIN);
  // 가로 100m, 세로 60m 사각형
  const shape = polygonShapeFromPoints(
    [offset(0, 0), offset(100, 0), offset(100, 60), offset(0, 60)].map(
      plane.project,
    ),
  );
  const { geo, area } = gardenGeoFromShape(shape, plane);

  assert.ok(Math.abs(area - 6000) < 60, `넓이 ${area}`);
  const ring = geo.geojson.coordinates[0];
  assert.equal(geo.geojson.type, "Polygon");
  assert.equal(ring.length, 5);
  assert.deepEqual(ring[0], ring.at(-1));
  // 중심은 사각형 한가운데(동쪽 50m, 북쪽 30m) 근처다.
  const [cLng, cLat] = offset(50, 30);
  assert.ok(Math.abs(geo.center[0] - cLng) < 1e-5);
  assert.ok(Math.abs(geo.center[1] - cLat) < 1e-5);
  // 경계 원본은 M 으로 시작해 Z 로 끝난다.
  assert.equal(geo.boundary[0].kind, "M");
  assert.equal(geo.boundary.at(-1).kind, "Z");
  assert.deepEqual(geo.boundary.at(-1).points, []);
  for (const [lng, lat] of ring) {
    assert.ok(Math.abs(lng) <= 180 && Math.abs(lat) <= 90);
  }
});

test("곡선 경계: 원본에는 곡선 명령이, GeoJSON에는 잘게 나눈 점이 들어간다", () => {
  const plane = planeAt(ORIGIN);
  const straight = polygonShapeFromPoints(
    [offset(0, 0), offset(100, 0), offset(100, 60), offset(0, 60)].map(
      plane.project,
    ),
  );
  const before = gardenGeoFromShape(straight, plane);
  // 첫 변을 곡선으로 바꾸고 조절점을 바깥(남쪽)으로 끈다.
  let curved = convertZoneSegmentToCurve(straight, "1");
  const control = getZoneBoundaryHandles(curved).find(
    (h) => h.kind === "control",
  );
  curved = moveZoneBoundaryHandle(curved, control.id, [
    control.point[0],
    control.point[1] + 200,
  ]);
  const after = gardenGeoFromShape(curved, plane);

  assert.ok(after.geo.boundary.some((command) => command.kind === "C"));
  assert.ok(
    after.geo.geojson.coordinates[0].length >
      before.geo.geojson.coordinates[0].length,
  );
  assert.ok(after.area > before.area);
  assert.deepEqual(
    after.geo.geojson.coordinates[0][0],
    after.geo.geojson.coordinates[0].at(-1),
  );
  // 화면에 그리는 점들도 곡선을 따라 여러 개로 나뉜다.
  assert.ok(boundaryPreview(curved, plane).length > 20);
});

test("저장된 경계를 다시 열면 같은 모양으로 고칠 수 있다", () => {
  // 등록할 때처럼 첫 점을 기준점으로 삼아 곡선이 있는 경계를 만든다.
  const corners = [
    offset(0, 0),
    offset(100, 0),
    offset(100, 60),
    offset(0, 60),
  ];
  const plane = planeAt(corners[0]);
  let shape = convertZoneSegmentToCurve(
    polygonShapeFromPoints(corners.map(plane.project)),
    "1",
  );
  const control = getZoneBoundaryHandles(shape).find(
    (h) => h.kind === "control",
  );
  shape = moveZoneBoundaryHandle(shape, control.id, [
    control.point[0],
    control.point[1] + 150,
  ]);
  const saved = gardenGeoFromShape(shape, plane);

  // 서버에 저장된 값(JSON)을 다시 읽어 평면 경계로 되돌린다.
  const stored = JSON.parse(JSON.stringify(saved.geo));
  const reopened = shapeFromGardenGeo(stored);
  assert.deepEqual(reopened.origin, stored.boundary[0].points[0]);
  const again = gardenGeoFromShape(reopened.shape, planeAt(reopened.origin));

  // 명령 종류와 점 개수가 같고, 좌표는 1cm 안에서 같다.
  assert.deepEqual(
    again.geo.boundary.map((c) => [c.kind, c.points.length]),
    saved.geo.boundary.map((c) => [c.kind, c.points.length]),
  );
  again.geo.boundary.forEach((command, i) =>
    command.points.forEach(([lng, lat], j) => {
      const [savedLng, savedLat] = saved.geo.boundary[i].points[j];
      assert.ok(Math.abs(lng - savedLng) < 2e-7);
      assert.ok(Math.abs(lat - savedLat) < 2e-7);
    }),
  );
  // 저장할 때 좌표를 1cm 단위로 맞추고 곡선을 다시 잘게 나누므로 넓이는 아주 조금 다를 수 있다(0.01% 이내).
  assert.ok(
    Math.abs(again.area - saved.area) / saved.area < 1e-4,
    `넓이 ${again.area} / ${saved.area}`,
  );
});

test("읽을 수 없는 저장 경계는 안내와 함께 실패한다", () => {
  assert.throws(
    () =>
      shapeFromGardenGeo({
        center: ORIGIN,
        boundary: [{ kind: "L", points: [ORIGIN] }],
        geojson: { type: "Polygon", coordinates: [] },
      }),
    /저장된 경계를 읽지 못했습니다/,
  );
});

test("서로 교차하는 경계는 저장할 모양으로 바꾸지 않는다", () => {
  const plane = planeAt(ORIGIN);
  // 나비 모양(변이 서로 가로지름)
  const [a, b, c, d] = [
    offset(0, 0),
    offset(100, 60),
    offset(100, 0),
    offset(0, 60),
  ].map(plane.project);
  const bowtie = `M${a.join(" ")} L${b.join(" ")} L${c.join(" ")} L${d.join(" ")} Z`;
  assert.throws(() => gardenGeoFromShape(bowtie, plane));
});
