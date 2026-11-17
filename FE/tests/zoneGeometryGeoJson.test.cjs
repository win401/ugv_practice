const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "saemgil-zone-geojson-"));
for (const dir of ["api", "lib"]) fs.mkdirSync(path.join(output, dir));
for (const name of [
  "api/gardenDetail.ts",
  "lib/zoneGeometry.ts",
  "lib/zoneGeoJson.ts",
  "lib/gardenGeoFrame.ts",
]) {
  fs.writeFileSync(
    path.join(output, name.replace(/\.ts$/, ".js")),
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src", name), "utf8"),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
        },
      },
    ).outputText,
  );
}
fs.writeFileSync(
  path.join(output, "lib/gardenImage.js"),
  'exports.GARDEN_IMAGE={url:"test.png",width:1536,height:1024,revision:"test-image-v1"};',
);
const geometry = require(path.join(output, "lib/zoneGeometry.js"));
const geo = require(path.join(output, "lib/zoneGeoJson.js"));
const { gardenImageToLatLng, gardenLatLngToImage } = require(
  path.join(output, "lib/gardenGeoFrame.js"),
);
const { gardenDetailApi } = require(path.join(output, "api/gardenDetail.js"));
let data;
test.before(async () => {
  data = await gardenDetailApi.read();
});
test.after(() => fs.rmSync(output, { recursive: true, force: true }));
const lngLat = (p) => {
  const [lat, lng] = gardenImageToLatLng(p);
  return [lng, lat];
};
const ringsOf = (value) =>
  value.type === "Polygon"
    ? value.coordinates
    : value.coordinates.map((polygon) => polygon[0]);
function area(ring) {
  const origin = ring[0];
  return (
    ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return (
        sum +
        (p[0] - origin[0]) * (q[1] - origin[1]) -
        (q[0] - origin[0]) * (p[1] - origin[1])
      );
    }, 0) / 2
  );
}
function bezier(segment, t) {
  const [a, b, c, d] = [segment.start, ...segment.controls, segment.end];
  return [0, 1].map((axis) =>
    d !== undefined
      ? (1 - t) ** 3 * a[axis] +
        3 * (1 - t) ** 2 * t * b[axis] +
        3 * (1 - t) * t * t * c[axis] +
        t ** 3 * d[axis]
      : c !== undefined
        ? (1 - t) ** 2 * a[axis] + 2 * (1 - t) * t * b[axis] + t * t * c[axis]
        : a[axis] + t * (b[axis] - a[axis]),
  );
}
function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    denominator = dx * dx + dy * dy;
  const t = denominator
    ? Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denominator),
      )
    : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
const assertNear = (a, b, tolerance = 1e-9) =>
  assert(Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance, `${a} != ${b}`);

test("line and closing edge become editable cubic curves without moving the silhouette", () => {
  const shape = "M10 10 L100 10 L100 100 L10 100 Z";
  for (const id of ["1", "4"]) {
    const before = geometry
      .getZoneBoundarySegments(shape)
      .find((s) => s.id === id);
    const next = geometry.convertZoneSegmentToCurve(shape, id);
    const after = geometry
      .getZoneBoundarySegments(next)
      .find((s) => s.id === id);
    assert.equal(after.kind, "C");
    assert.equal(after.controls.length, 2);
    assertNear(after.controls[0], bezier(before, 1 / 3));
    assertNear(after.controls[1], bezier(before, 2 / 3));
    for (let i = 0; i <= 100; i++)
      assertNear(bezier(before, i / 100), bezier(after, i / 100));
    geometry.validateZoneShape(next, 200, 200);
    assert.equal((next.match(/Z/g) || []).length, 1);
    const handles = geometry.getZoneBoundaryHandles(next);
    assert(handles.some((h) => h.id === `${id}:0` && h.kind === "control"));
    const moved = geometry.moveZoneBoundaryHandle(next, `${id}:0`, [
      after.controls[0][0] + 4,
      after.controls[0][1] + 5,
    ]);
    assert.notEqual(moved, next);
    assertNear(
      geometry.getZoneBoundarySegments(moved).find((s) => s.id === id)
        .controls[0],
      [after.controls[0][0] + 4, after.controls[0][1] + 5],
      0.001,
    );
    if (id === "4") {
      assert(!handles.some((h) => h.id === "4:2"));
      const closedMoved = geometry.moveZoneBoundaryHandle(
        next,
        "0:0",
        [12, 13],
      );
      assert.deepEqual(
        geometry.getZoneBoundarySegments(closedMoved).find((s) => s.id === "4")
          .end,
        [12, 13],
      );
    }
  }
});

test("curve conversion is a no-op for existing curves and rejects absent or excessive edges", () => {
  const shape = "M10 10 Q50 0 90 10 C120 50 70 100 10 10 Z";
  assert.equal(geometry.convertZoneSegmentToCurve(shape, "1"), shape);
  assert.equal(geometry.convertZoneSegmentToCurve(shape, "2"), shape);
  for (const id of ["0", "3", "99", "01"])
    assert.throws(() => geometry.convertZoneSegmentToCurve(shape, id));
  assert.throws(() =>
    geometry.convertZoneSegmentToCurve("M10 10 L10 10 L20 20 L10 30 Z", "1"),
  );
  const maximum =
    "M0 0 " +
    Array.from({ length: 254 }, (_, i) => `L${i + 1} 20`).join(" ") +
    " Z";
  assert.throws(
    () => geometry.convertZoneSegmentToCurve(maximum, "255"),
    /초과/,
  );
  const multipart = "M0 0 L10 0 L10 10 Z M20 20 L30 20 L30 30 Z";
  assert.equal(
    (geometry.convertZoneSegmentToCurve(multipart, "7").match(/M/g) || [])
      .length,
    2,
  );
});

test("new polygons close once, retain decimal points, and accept concave boundaries", () => {
  const points = [
    [10.125, 10.875],
    [100, 10],
    [60, 40],
    [100, 100],
    [10, 100],
  ];
  const shape = geometry.polygonShapeFromPoints(points, 200, 200);
  assert.equal(shape, "M10.125 10.875 L100 10 L60 40 L100 100 L10 100 Z");
  assert.deepEqual(points[0], [10.125, 10.875]);
  assert.equal(
    geometry.polygonShapeFromPoints([...points, points[0]], 200, 200),
    shape,
  );
  const hundred = Array.from({ length: 100 }, (_, i) => [
    100 + 80 * Math.cos((i * Math.PI) / 50),
    100 + 80 * Math.sin((i * Math.PI) / 50),
  ]);
  geometry.validateZoneShape(
    geometry.polygonShapeFromPoints(hundred, 200, 200),
    200,
    200,
  );
});

test("new polygons reject invalid counts, duplicates, bounds, crossings, edge touching and retracing", () => {
  for (const points of [
    [],
    [
      [0, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 0],
      [10, 10],
    ],
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
      [0, 10],
    ],
    [
      [NaN, 0],
      [10, 0],
      [10, 10],
    ],
    [
      [-1, 0],
      [10, 0],
      [10, 10],
    ],
    [
      [0, 0],
      [201, 0],
      [10, 10],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [0, 0],
      [10, 10],
      [0, 10],
      [10, 0],
    ],
    [
      [0, 0],
      [10, 0],
      [5, 0],
      [10, 10],
      [0, 10],
    ],
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [5, 0],
      [0, 10],
    ],
    Array.from({ length: 101 }, (_, i) => [
      100 + 80 * Math.cos((i * 2 * Math.PI) / 101),
      100 + 80 * Math.sin((i * 2 * Math.PI) / 101),
    ]),
  ]) {
    assert.throws(
      () => geometry.polygonShapeFromPoints(points, 200, 200),
      JSON.stringify(points),
    );
  }
  assert.throws(() =>
    geometry.polygonShapeFromPoints(
      [
        [0, 0],
        [10, 0],
        [0, 10],
      ],
      0,
      200,
    ),
  );
});

test("all 24 existing zones export closed CCW WGS84 polygons and preserve disjoint pieces", () => {
  assert.equal(data.zones.length, 24);
  for (const zone of data.zones) {
    const exported = geo.zoneShapeToGeoJSON(zone.shape, lngLat);
    const rings = ringsOf(exported);
    const count = (zone.shape.match(/M/g) || []).length;
    assert.equal(rings.length, count, zone.id);
    assert.equal(exported.type, count === 1 ? "Polygon" : "MultiPolygon");
    assert(rings.flat().length <= geo.ZONE_GEOJSON_POINT_LIMIT);
    for (const ring of rings) {
      assert(ring.length >= 4);
      assert.deepEqual(ring[0], ring.at(-1));
      assert(area(ring) > 0);
      for (const [lng, lat] of ring) {
        assert(lng > 127 && lng < 128);
        assert(lat > 34 && lat < 35);
      }
    }
    assert.deepEqual(JSON.parse(JSON.stringify(exported)), exported);
  }
});

test("adaptive export bounds independently sampled curve error without rounding coordinates", () => {
  let worst = 0;
  for (const zone of data.zones) {
    const pixelRings = ringsOf(geo.zoneShapeToGeoJSON(zone.shape, lngLat)).map(
      (ring) => ring.map(([lng, lat]) => gardenLatLngToImage([lat, lng])),
    );
    for (const segment of geometry.getZoneBoundarySegments(zone.shape)) {
      for (let i = 0; i <= 120; i++) {
        const p = bezier(segment, i / 120);
        const distance = Math.min(
          ...pixelRings.flatMap((ring) =>
            ring.slice(1).map((end, j) => distanceToSegment(p, ring[j], end)),
          ),
        );
        worst = Math.max(worst, distance);
        assert(
          distance <= geo.ZONE_GEOJSON_PIXEL_TOLERANCE + 1e-6,
          `${zone.id}: ${distance}`,
        );
      }
    }
  }
  assert(worst > 0.01, "test includes curved, nontrivial approximation");
  const offset = 127.12345678901234;
  const polygon = geo.zoneShapeToGeoJSON("M0 0 L1 0 L0 1 Z", ([x, y]) => [
    offset + x / 1000000000,
    34 + y / 1000000000,
  ]);
  assert(polygon.coordinates[0].some(([x]) => x === offset + 1e-9));
});

test("GeoJSON rejects intersecting, touching, nested, invalid and collapsed geometry", () => {
  const identity = (point) => point;
  const invalid = [
    "M0 0 L10 10 L0 10 L10 0 Z",
    "M0 0 L10 0 L5 0 L10 10 L0 10 Z",
    "M0 0 L10 0 L10 10 L0 10 Z M2 2 L4 2 L4 4 L2 4 Z",
    "M0 0 L10 0 L10 10 L0 10 Z M5 5 L15 5 L15 15 L5 15 Z",
    "M0 0 L10 0 L10 10 L0 10 Z M10 10 L20 10 L20 20 L10 20 Z",
    "M0 0 L1 1 L2 2 Z",
    "M0 0 L1 1",
  ];
  for (const shape of invalid)
    assert.throws(() => geo.zoneShapeToGeoJSON(shape, identity));
  for (const projector of [
    () => [Infinity, 0],
    () => [181, 0],
    () => [0, -91],
    () => [0, 0],
    () => [1],
    () => null,
    () => {
      throw new Error("unavailable");
    },
    ([x, y]) => [x ? 179 : -179, y],
    ([x, y]) => [x, y === 10 ? 0 : y],
  ])
    assert.throws(() =>
      geo.zoneShapeToGeoJSON("M0 0 L10 0 L10 10 L0 10 Z", projector),
    );
});

test("adaptive subdivision has a bounded point budget and keeps straight runs compact", () => {
  let calls = 0;
  assert.throws(
    () =>
      geo.zoneShapeToGeoJSON(
        "M0 0 C0 1000000000 1000000000 1000000000 1000000000 0 L0 0 Z",
        () => {
          calls++;
          return [0, 0];
        },
      ),
    /複雑|복잡/,
  );
  assert.equal(calls, 0);
  const straight = geo.zoneShapeToGeoJSON(
    "M0 0 C10 0 20 0 30 0 L30 30 L0 30 Z",
    (p) => p,
  );
  assert.equal(straight.coordinates[0].length, 5);
  assert.deepEqual(straight.coordinates[0][0], [0, 0]);
  const curved = geo.zoneShapeToGeoJSON(
    "M0 0 C0 20 20 20 20 0 L0 0 Z",
    (p) => p,
  );
  assert(curved.coordinates[0].length > 5);
});
