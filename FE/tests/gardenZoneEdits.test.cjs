const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

// Compile the pure TypeScript modules without a browser, bundler or real storage.
const output = fs.mkdtempSync(path.join(os.tmpdir(), "saemgil-zone-tests-"));
for (const dir of ["api", "lib"]) fs.mkdirSync(path.join(output, dir));
for (const name of [
  "api/gardenDetail.ts",
  "api/gardenZoneEdits.ts",
  "lib/zoneGeometry.ts",
  "lib/zoneGeoJson.ts",
  "lib/gardenGeoFrame.ts",
  "lib/gardenZoneProjection.ts",
]) {
  const source = fs.readFileSync(path.join(__dirname, "../src", name), "utf8");
  fs.writeFileSync(
    path.join(output, name.replace(/\.ts$/, ".js")),
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText,
  );
}
fs.writeFileSync(
  path.join(output, "lib/gardenImage.js"),
  'exports.GARDEN_IMAGE={url:"test.png",width:1536,height:1024,revision:"test-image-v1"};',
);
const geometry = require(path.join(output, "lib/zoneGeometry.js"));
const store = require(path.join(output, "api/gardenZoneEdits.js"));
const { gardenDetailApi } = require(path.join(output, "api/gardenDetail.js"));
class MemoryStorage {
  items = new Map();
  failWrites = false;
  getItem(key) {
    return this.items.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.items.set(key, value);
  }
}
let data;
let geographicZones;
function assertSamePath(actual, expected) {
  const a = geometry.parseZonePath(actual);
  const b = geometry.parseZonePath(expected);
  assert.deepEqual(
    a.map((c) => c.kind),
    b.map((c) => c.kind),
  );
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < a[i].points.length; j++)
      assert(
        Math.hypot(
          a[i].points[j][0] - b[i].points[j][0],
          a[i].points[j][1] - b[i].points[j][1],
        ) < 0.00001,
      );
}
const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);
function resetStorage() {
  const memory = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memory,
  });
  return memory;
}
const editOf = (zone, patch = {}) => ({
  id: zone.id,
  name: zone.name,
  shape: zone.shape,
  ...patch,
});
test.before(async () => {
  data = await gardenDetailApi.read();
  resetStorage();
  geographicZones = store.loadGardenZoneEdits("seed", data).zones;
});
test.beforeEach(resetStorage);
test.after(() => {
  if (originalStorage)
    Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
  fs.rmSync(output, { recursive: true, force: true });
});

test("all 24 existing zones retain valid curves, multipart boundaries and stable handle ids", () => {
  assert.equal(data.zones.length, 24);
  for (const zone of data.zones) {
    geometry.validateZoneShape(zone.shape, data.width, data.height);
    const handles = geometry.getZoneBoundaryHandles(zone.shape);
    assert(handles.some((h) => h.kind === "anchor"));
    assert.equal(new Set(handles.map((h) => h.id)).size, handles.length);
    for (const handle of handles) {
      assert(handle.point.every(Number.isFinite));
      assert.equal(
        geometry.moveZoneBoundaryHandle(zone.shape, handle.id, handle.point),
        zone.shape,
      );
    }
    const handle = handles[0];
    const moved = geometry.moveZoneBoundaryHandle(zone.shape, handle.id, [
      handle.point[0] + 1,
      handle.point[1] + 1,
    ]);
    geometry.validateZoneShape(moved, data.width, data.height);
    assert.deepEqual(moved.match(/[MLCQZ]/g), zone.shape.match(/[MLCQZ]/g));
  }
});

test("moving an anchor carries adjoining curve handles and closed duplicate endpoints", () => {
  const shape = "M20 20 C30 20 70 20 80 40 C80 60 40 80 20 20 Z";
  const before = geometry.getZoneBoundaryHandles(shape);
  const afterShape = geometry.moveZoneBoundaryHandle(shape, "0:0", [25, 27]);
  const after = geometry.getZoneBoundaryHandles(afterShape);
  const p = (id) => after.find((h) => h.id === id).point;
  assert.deepEqual(p("0:0"), [25, 27]);
  assert.deepEqual(p("1:0"), [35, 27]);
  assert.deepEqual(p("2:1"), [45, 87]);
  assert(!after.some((h) => h.id === "2:2"));
  assert.equal(before.length, after.length);
  assert(afterShape.endsWith("25 27 Z"));
});

test("moving a curve control preserves all other handle coordinates", () => {
  const shape = data.zones[0].shape;
  const handles = geometry.getZoneBoundaryHandles(shape);
  const control = handles.find((h) => h.kind === "control");
  const moved = geometry.getZoneBoundaryHandles(
    geometry.moveZoneBoundaryHandle(shape, control.id, [
      control.point[0] + 2,
      control.point[1] + 3,
    ]),
  );
  for (const handle of handles)
    assert.deepEqual(
      moved.find((h) => h.id === handle.id).point,
      handle.id === control.id
        ? [control.point[0] + 2, control.point[1] + 3]
        : handle.point,
    );
});

test("invalid, open, outside, collapsed and self-crossing boundaries are rejected", () => {
  for (const shape of [
    "",
    "M0 0 L1 1",
    "M0 0 H4 Z",
    "MNaN 0 L1 1 Z",
    "M0 0 L1 1 L2 2 Z",
    "M0 0 L100 100 L0 100 L100 0 Z",
    "M-1 0 L100 0 L0 100 Z",
    "M0 0 C9999 5 5 50 40 40 L0 40 Z",
  ]) {
    assert.throws(() => geometry.validateZoneShape(shape, 1536, 1024));
  }
  assert.throws(() =>
    geometry.moveZoneBoundaryHandle(data.zones[0].shape, "invalid", [1, 2]),
  );
  assert.throws(() =>
    geometry.moveZoneBoundaryHandle(data.zones[0].shape, "0:0", [NaN, 2]),
  );
});

test("label stays in place for unchanged valid placement and relocates for a moved boundary", () => {
  const shape = "M20 20 L80 20 L80 80 L20 80 Z";
  assert.deepEqual(geometry.labelForZoneShape(shape, [40, 40]), [40, 40]);
  assert.deepEqual(geometry.labelForZoneShape(shape, [0, 0]), [50, 50]);
});

test("name-only save preserves exact SVG, paths, seed and zone identity on reload", () => {
  const before = JSON.stringify(data);
  const loaded = store.loadGardenZoneEdits("customer-a", data);
  assert.equal(loaded.revision, "");
  const saved = store.saveGardenZoneEdit(
    "customer-a",
    data,
    editOf(geographicZones[0], { name: "  새 화단  " }),
    "",
  );
  assert(saved.revision);
  const reloaded = store.loadGardenZoneEdits("customer-a", data);
  assert.deepEqual(reloaded, saved);
  assert.equal(reloaded.zones[0].name, "새 화단");
  assert.equal(reloaded.zones[0].shape, loaded.zones[0].shape);
  assert.deepEqual(reloaded.zones[0].label, loaded.zones[0].label);
  assert.equal(reloaded.zones[0].stopNode, data.zones[0].stopNode);
  assert.equal(reloaded.zones[0].id, data.zones[0].id);
  assert.equal(JSON.stringify(data), before);
});

test("editing one component retains the other pieces of a multipart zone", () => {
  const zone = geographicZones.find((z) => z.letter === "I");
  assert(zone.shape.match(/M/g).length > 1);
  const point = geometry.getZoneBoundaryHandles(zone.shape)[0];
  const shape = geometry.moveZoneBoundaryHandle(zone.shape, point.id, [
    point.point[0] + 1,
    point.point[1] + 1,
  ]);
  const saved = store.saveGardenZoneEdit(
    "customer-a",
    data,
    editOf(zone, { shape }),
    "",
  );
  const edited = saved.zones.find((z) => z.id === zone.id);
  assertSamePath(edited.shape, shape);
  assert.equal(edited.shape.match(/M/g).length, zone.shape.match(/M/g).length);
  assert.deepEqual(
    saved.zones.filter((z) => z.id !== zone.id),
    geographicZones.filter((z) => z.id !== zone.id),
  );
});

test("customer and map storage stay isolated; edits survive illustration changes", () => {
  const a = store.saveGardenZoneEdit(
    "customer-a",
    data,
    editOf(geographicZones[0], { name: "A edited" }),
    "",
  );
  const b = store.saveGardenZoneEdit(
    "customer-a",
    data,
    editOf(geographicZones[1], { name: "B edited" }),
    a.revision,
  );
  assert.equal(b.zones[0].name, "A edited");
  assert.equal(b.zones[1].name, "B edited");
  assert.deepEqual(
    store.loadGardenZoneEdits("customer-b", data).zones,
    geographicZones,
  );
  assert.deepEqual(
    store.loadGardenZoneEdits("customer-a", {
      ...data,
      imageRevision: "changed-image",
    }).zones,
    b.zones,
  );
  assert.throws(() => store.gardenZoneEditsStorageKey("", data.mapId));
});

test("stale tab writes are rejected without replacing newer changes", () => {
  const memory = globalThis.localStorage;
  const first = store.saveGardenZoneEdit(
    "customer-a",
    data,
    editOf(geographicZones[0], { name: "First tab" }),
    "",
  );
  const before = JSON.stringify([...memory.items]);
  assert.throws(
    () =>
      store.saveGardenZoneEdit(
        "customer-a",
        data,
        editOf(geographicZones[1], { name: "Stale tab" }),
        "",
      ),
    /다른 탭/,
  );
  assert.equal(JSON.stringify([...memory.items]), before);
  assert.deepEqual(store.loadGardenZoneEdits("customer-a", data), first);
});

test("malformed saved payload is never silently overwritten", () => {
  const memory = globalThis.localStorage;
  const key = store.gardenZoneEditsStorageKey("customer-a", data.mapId);
  for (const raw of [
    "{",
    "null",
    '{"version":99}',
    JSON.stringify({
      version: 1,
      imageRevision: data.imageRevision,
      revision: "r",
      zones: [
        { ...editOf(geographicZones[0]), label: [1, 2] },
        { ...editOf(geographicZones[0]), label: [1, 2] },
      ],
    }),
  ]) {
    memory.setItem(key, raw);
    assert.throws(() => store.loadGardenZoneEdits("customer-a", data));
    assert.throws(() =>
      store.saveGardenZoneEdit(
        "customer-a",
        data,
        editOf(geographicZones[0]),
        "",
      ),
    );
    assert.equal(memory.getItem(key), raw);
  }
});

test("invalid names and missing zones cannot write", () => {
  for (const name of ["", "   ", "a".repeat(51), "line\nbreak"])
    assert.throws(() =>
      store.saveGardenZoneEdit(
        "customer-a",
        data,
        editOf(geographicZones[0], { name }),
        "",
      ),
    );
  assert.throws(() =>
    store.saveGardenZoneEdit(
      "customer-a",
      data,
      { id: "unknown", name: "ok", shape: data.zones[0].shape },
      "",
    ),
  );
  assert.equal(globalThis.localStorage.items.size, 0);
});

test("unavailable storage and full storage keep previous data intact", () => {
  const memory = globalThis.localStorage;
  const first = store.saveGardenZoneEdit(
    "customer-a",
    data,
    editOf(geographicZones[0], { name: "Keep me" }),
    "",
  );
  const before = JSON.stringify([...memory.items]);
  memory.failWrites = true;
  assert.throws(
    () =>
      store.saveGardenZoneEdit(
        "customer-a",
        data,
        editOf(geographicZones[1], { name: "Failed" }),
        first.revision,
      ),
    /저장하지 못/,
  );
  assert.equal(JSON.stringify([...memory.items]), before);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("SecurityError");
    },
  });
  assert.throws(() => store.loadGardenZoneEdits("customer-a", data), /읽지 못/);
});

// Independent Bernstein evaluation checks that subdivision keeps the drawn curve.
function evaluateSegment(segment, t) {
  const p = segment.start,
    q = segment.end,
    u = 1 - t;
  if (segment.kind === "C") {
    const [a, b] = segment.controls;
    return [0, 1].map(
      (i) =>
        u * u * u * p[i] +
        3 * u * u * t * a[i] +
        3 * u * t * t * b[i] +
        t * t * t * q[i],
    );
  }
  if (segment.kind === "Q") {
    const [a] = segment.controls;
    return [0, 1].map((i) => u * u * p[i] + 2 * u * t * a[i] + t * t * q[i]);
  }
  return [0, 1].map((i) => u * p[i] + t * q[i]);
}
function assertNearPoint(a, b, tolerance = 1e-8) {
  assert(
    Math.hypot(a[0] - b[0], a[1] - b[1]) < tolerance,
    `points differ: ${a} vs ${b}`,
  );
}
function assertSubdivisionPreserved(shape, segmentId, t) {
  const before = geometry.getZoneBoundarySegments(shape);
  const segment = before.find((s) => s.id === segmentId);
  const inserted = geometry.insertZoneBoundaryPoint(shape, segmentId, t);
  const after = geometry.getZoneBoundarySegments(inserted.shape);
  const index = before.findIndex((s) => s.id === segmentId);
  assert.equal(after.length, before.length + 1);
  const left = after[index],
    right = after[index + 1];
  assertNearPoint(left.end, evaluateSegment(segment, t));
  assertNearPoint(left.end, right.start);
  for (let step = 0; step <= 100; step++) {
    const originalT = step / 100;
    const result =
      originalT <= t
        ? evaluateSegment(left, originalT / t)
        : evaluateSegment(right, (originalT - t) / (1 - t));
    assertNearPoint(result, evaluateSegment(segment, originalT));
  }
  const handle = geometry
    .getZoneBoundaryHandles(inserted.shape)
    .find((h) => h.id === inserted.handleId);
  assert.equal(handle.kind, "anchor");
  assertNearPoint(handle.point, evaluateSegment(segment, t));
  assert.equal(inserted.shape.match(/M/g).length, shape.match(/M/g).length);
  assert.equal(inserted.shape.match(/Z/g).length, shape.match(/Z/g).length);
  geometry.validateZoneShape(inserted.shape, 1536, 1024);
  return inserted;
}

test("line, quadratic, cubic and closing-line insertions exactly preserve sampled silhouettes", () => {
  for (const [shape, id] of [
    ["M20 20 L100 20 L100 100 L20 100 Z", "1"],
    ["M20 20 Q60 0 100 20 L100 100 L20 100 Z", "1"],
    ["M20 20 C40 0 70 5 100 20 L100 100 L20 100 Z", "1"],
    ["M20 20 L100 20 L100 100 L20 100 Z", "4"],
  ])
    for (const t of [0.17, 0.5, 0.83]) assertSubdivisionPreserved(shape, id, t);
});

test("every segment of the 24 seed shapes supports insertion without losing multipart geometry", () => {
  let count = 0;
  for (const zone of data.zones) {
    const segments = geometry.getZoneBoundarySegments(zone.shape);
    for (const segment of segments) {
      assertSubdivisionPreserved(zone.shape, segment.id, 0.37);
      count++;
    }
  }
  assert(count > 150);
});

test("explicit closing curve and implicit closing line preserve a closed editable boundary", () => {
  const explicit = "M20 20 L100 20 C100 100 20 100 20 20 Z";
  assert.deepEqual(
    geometry.getZoneBoundarySegments(explicit).map((s) => s.kind),
    ["L", "C"],
  );
  const curved = assertSubdivisionPreserved(explicit, "2", 0.4);
  assert.equal(
    geometry
      .getZoneBoundaryHandles(curved.shape)
      .filter((h) => h.kind === "anchor").length,
    3,
  );
  const implicit = "M20 20 L100 20 L100 100 Z";
  const line = assertSubdivisionPreserved(implicit, "3", 0.4);
  assert.equal(geometry.getZoneBoundarySegments(line.shape).at(-1).kind, "Z");
  assert(line.shape.endsWith("Z"));
});

test("nearest boundary point projects lines and refines curves, including near endpoints", () => {
  const line = "M20 20 L100 20 L100 100 L20 100 Z";
  const nearest = geometry.findClosestZoneBoundaryPoint(line, [52, 12]);
  assert.equal(nearest.segmentId, "1");
  assert.equal(nearest.t, 0.4);
  assertNearPoint(nearest.point, [52, 20]);
  assert.equal(nearest.distance, 8);
  const curve = "M20 20 C50 0 70 0 100 20 L100 100 L20 100 Z";
  const segment = geometry.getZoneBoundarySegments(curve)[0];
  for (const t of [0.001, 0.13, 0.5123, 0.87, 0.999]) {
    const point = evaluateSegment(segment, t);
    const found = geometry.findClosestZoneBoundaryPoint(curve, point);
    assert.equal(found.segmentId, "1");
    assertNearPoint(found.point, point, 0.0001);
    assert(found.distance < 0.0001);
  }
  const multipart = "M20 20 L100 20 L100 100 Z M200 200 L300 200 L300 300 Z";
  const other = geometry.findClosestZoneBoundaryPoint(multipart, [250, 195]);
  assert.equal(other.segmentId, "5");
  assertNearPoint(other.point, [250, 200]);
  assert.equal(geometry.findClosestZoneBoundaryPoint(line, [NaN, 20]), null);
});

test("insertion rejects endpoints, invalid segments, duplicate closure and complexity overflow", () => {
  const shape = "M20 20 L100 20 L100 100 Z";
  for (const t of [NaN, Infinity, -1, 0, 0.0001, 0.9999, 1, 2])
    assert.throws(() => geometry.insertZoneBoundaryPoint(shape, "1", t));
  for (const id of ["0", "01", "99", "invalid"])
    assert.throws(() => geometry.insertZoneBoundaryPoint(shape, id, 0.5));
  const explicit = "M20 20 L100 20 L100 100 L20 20 Z";
  assert.throws(() => geometry.insertZoneBoundaryPoint(explicit, "4", 0.5));
  const full =
    "M20 20 " +
    Array.from({ length: 254 }, (_, i) => `L${40 + i} ${i % 2 ? 30 : 40}`).join(
      " ",
    ) +
    " Z";
  assert.throws(
    () => geometry.insertZoneBoundaryPoint(full, "1", 0.5),
    /점의 수/,
  );
});

test("inserted curved and multipart boundaries survive storage reload and a second insertion", () => {
  const zone = geographicZones.find((z) => z.letter === "I");
  const first = geometry.insertZoneBoundaryPoint(zone.shape, "1", 0.5);
  const saved = store.saveGardenZoneEdit(
    "added-points",
    data,
    editOf(zone, { shape: first.shape }),
    "",
  );
  const reloaded = store.loadGardenZoneEdits("added-points", data);
  assertSamePath(
    reloaded.zones.find((z) => z.id === zone.id).shape,
    first.shape,
  );
  const second = geometry.insertZoneBoundaryPoint(first.shape, "1", 0.3);
  const again = store.saveGardenZoneEdit(
    "added-points",
    data,
    editOf(zone, { shape: second.shape }),
    saved.revision,
  );
  assertSamePath(again.zones.find((z) => z.id === zone.id).shape, second.shape);
  assert.equal(second.shape.match(/M/g).length, zone.shape.match(/M/g).length);
  assert.equal(
    again.zones.find((z) => z.id === zone.id).stopNode,
    zone.stopNode,
  );
});

test("new zones persist stable UUIDs, display codes, unknown routing and derived GeoJSON", () => {
  const beforeSeed = JSON.stringify(data);
  const path = "M100 100 L170 100 L180 160 L100 170 Z";
  let next = store.loadGardenZoneEdits("new-customer", data);
  for (const code of ["Y", "Z", "AA"]) {
    next = store.createGardenZone(
      "new-customer",
      data,
      { name: ` New ${code} `, shape: path },
      next.revision,
    );
    const zone = next.zones.at(-1),
      record = next.records.at(-1);
    assert.equal(zone.letter, code);
    assert.match(zone.id, /^zone-/);
    assert.equal(zone.origin, "custom");
    assert.equal(zone.name, `New ${code}`);
    assert.equal(zone.stopNode, null);
    assert.equal(record.id, zone.id);
    assert.equal(record.routing.status, "unassigned");
    assert.equal(record.geojson.properties.navigationReady, false);
    assert.equal(record.geojson.properties.coordinateAccuracy, "map-edited");
    assert.equal(record.geojson.geometry.type, "Polygon");
    const ring = record.geojson.geometry.coordinates[0];
    assert.deepEqual(ring[0], ring.at(-1));
    assert(
      ring[0][0] > 127 && ring[0][0] < 128,
      "GeoJSON longitude must be first",
    );
    assert(
      ring[0][1] > 34 && ring[0][1] < 35,
      "GeoJSON latitude must be second",
    );
    assert.equal(record.createdAt, record.updatedAt);
    assert.equal(new Date(record.createdAt).toISOString(), record.createdAt);
  }
  assert.equal(next.zones.length, 27);
  assert.deepEqual(store.loadGardenZoneEdits("new-customer", data), next);
  assert.equal(JSON.stringify(data), beforeSeed);
  const key = store.gardenZoneEditsStorageKey("new-customer", data.mapId);
  const envelope = JSON.parse(localStorage.getItem(key));
  assert.equal(envelope.version, 3);
  assert.equal(
    envelope.records.length,
    3,
    "persist custom zones and overrides only",
  );
  assert.notEqual(
    key,
    store.gardenZoneEditsStorageKey("new-customer", "another-map"),
  );
});

test("custom zone edits preserve identity and regenerate GeoJSON from the edited curve", () => {
  const created = store.createGardenZone(
    "custom-update",
    data,
    { name: "새 구역", shape: "M100 100 L200 100 L200 200 L100 200 Z" },
    "",
  );
  const original = created.records.at(-1);
  const changed = store.saveGardenZoneEdit(
    "custom-update",
    data,
    {
      id: original.id,
      name: "곡선 구역",
      shape: "M100 100 C130 70 170 70 200 100 L200 200 L100 200 Z",
    },
    created.revision,
  );
  const record = changed.records.at(-1);
  assert.equal(record.id, original.id);
  assert.equal(record.displayCode, original.displayCode);
  assert.equal(record.createdAt, original.createdAt);
  assert(record.updatedAt >= record.createdAt);
  assert.notDeepEqual(record.geojson.geometry, original.geojson.geometry);
  assert.equal(record.geojson.properties.name, "곡선 구역");
  assert.equal(record.routing.stopNodeId, null);
  assert.deepEqual(store.loadGardenZoneEdits("custom-update", data), changed);
});

test("v1 changes migrate without writing on read, preserve source, and use v3 only after success", () => {
  const legacyKey = store.legacyGardenZoneEditsStorageKey(
    "legacy-customer",
    data.imageRevision,
  );
  const oldPayload = JSON.stringify({
    version: 1,
    imageRevision: data.imageRevision,
    revision: "legacy-r1",
    zones: [
      {
        ...editOf(data.zones[0], { name: "이전 수정" }),
        label: data.zones[0].label,
      },
    ],
  });
  localStorage.setItem(legacyKey, oldPayload);
  const v3Key = store.gardenZoneEditsStorageKey("legacy-customer", data.mapId);
  const loaded = store.loadGardenZoneEdits("legacy-customer", data);
  assert.equal(loaded.zones[0].name, "이전 수정");
  assert.equal(loaded.revision, "legacy-r1");
  assert.equal(loaded.records[0].createdAt, null);
  assert.equal(loaded.records[0].updatedAt, null);
  assert.equal(localStorage.getItem(v3Key), null);
  localStorage.failWrites = true;
  assert.throws(
    () =>
      store.createGardenZone(
        "legacy-customer",
        data,
        { name: "새 구역", shape: "M100 100 L150 100 L150 150 Z" },
        loaded.revision,
      ),
    /저장하지 못/,
  );
  assert.equal(localStorage.getItem(legacyKey), oldPayload);
  assert.equal(localStorage.getItem(v3Key), null);
  localStorage.failWrites = false;
  const saved = store.createGardenZone(
    "legacy-customer",
    data,
    { name: "새 구역", shape: "M100 100 L150 100 L150 150 Z" },
    loaded.revision,
  );
  assert.equal(saved.zones[0].name, "이전 수정");
  assert.equal(localStorage.getItem(legacyKey), oldPayload);
  assert(localStorage.getItem(v3Key));
  // Once v3 exists, an obsolete legacy revision cannot replace the new snapshot.
  localStorage.setItem(
    legacyKey,
    oldPayload.replace("이전 수정", "옛 버전 새 내용"),
  );
  assert.deepEqual(store.loadGardenZoneEdits("legacy-customer", data), saved);
});

test("v2 custom curves are imported as examples and remain geographic after saving", () => {
  const scope = "legacy-v2";
  const legacyKey = store.imageGardenZoneEditsStorageKey(
    scope,
    data.imageRevision,
    data.mapId,
  );
  const oldPayload = JSON.stringify({
    version: 2,
    scopeId: scope,
    mapId: data.mapId,
    imageRevision: data.imageRevision,
    revision: "v2-r1",
    records: [
      {
        schemaVersion: 2,
        mapId: data.mapId,
        id: "zone-v2-example-uuid",
        name: "이전 곡선",
        displayCode: "Y",
        origin: "custom",
        description: "직접 추가한 관수 구역 · 관수 지점 연결 전",
        editorGeometry: {
          type: "svg-path",
          coordinateSpace: "image-pixels",
          imageRevision: data.imageRevision,
          width: data.width,
          height: data.height,
          path: "M100 100 C130 85 170 85 200 100 L200 200 L100 200 Z",
        },
        label: [150, 150],
        routing: { status: "unassigned", stopNodeId: null },
        createdAt: "2026-11-12T08:00:00.000Z",
        updatedAt: "2026-11-12T08:00:00.000Z",
      },
    ],
  });
  localStorage.setItem(legacyKey, oldPayload);
  const initial = store.loadGardenZoneEdits(scope, data);
  const original = initial.records.at(-1);
  assert.equal(initial.revision, "v2-r1");
  assert.equal(original.geojson.properties.coordinateAccuracy, "illustrative");
  assert(original.boundary.some((c) => c.kind === "C"));
  assert.equal(localStorage.items.size, 1);
  const next = store.saveGardenZoneEdit(
    scope,
    data,
    editOf(initial.zones.at(-1), { name: "이름 변경" }),
    initial.revision,
  );
  assert.deepEqual(next.records.at(-1).boundary, original.boundary);
  assert.equal(localStorage.getItem(legacyKey), oldPayload);
  assert.deepEqual(
    store
      .loadGardenZoneEdits(scope, {
        ...data,
        imageRevision: "updated-image",
        width: 640,
      })
      .records.at(-1),
    next.records.at(-1),
  );
});

test("malformed legacy and tampered GeoJSON/identity cannot be silently imported", () => {
  const legacyKey = store.legacyGardenZoneEditsStorageKey(
    "malformed-legacy",
    data.imageRevision,
  );
  localStorage.setItem(legacyKey, "{broken");
  assert.throws(() => store.loadGardenZoneEdits("malformed-legacy", data));
  assert.equal(localStorage.getItem(legacyKey), "{broken");
  assert.equal(
    localStorage.getItem(
      store.gardenZoneEditsStorageKey("malformed-legacy", data.mapId),
    ),
    null,
  );
  const created = store.createGardenZone(
    "tamper",
    data,
    { name: "새 구역", shape: "M100 100 L150 100 L150 150 Z" },
    "",
  );
  const key = store.gardenZoneEditsStorageKey("tamper", data.mapId);
  const canonical = localStorage.getItem(key);
  const changes = [
    (value) => {
      value.records[0].geojson.geometry.coordinates[0][0][0] += 0.001;
    },
    (value) => {
      value.records[0].geojson.properties.navigationReady = true;
    },
    (value) => {
      value.records[0].routing.stopNodeId = "approach-a";
    },
    (value) => {
      value.records[0].mapId = "another-map";
    },
    (value) => {
      value.records[0].displayCode = "A";
    },
    (value) => {
      value.records[0].boundary[0].points[0][0] = 181;
    },
    (value) => {
      value.records[0].updatedAt = "tomorrow";
    },
    (value) => {
      value.records.push(structuredClone(value.records[0]));
    },
    (value) => {
      value.scopeId = "someone-else";
    },
  ];
  for (const change of changes) {
    const payload = JSON.parse(canonical);
    change(payload);
    const raw = JSON.stringify(payload);
    localStorage.setItem(key, raw);
    assert.throws(() => store.loadGardenZoneEdits("tamper", data));
    assert.throws(() =>
      store.saveGardenZoneEdit(
        "tamper",
        data,
        editOf(created.zones.at(-1)),
        created.revision,
      ),
    );
    assert.equal(localStorage.getItem(key), raw);
  }
});

test("new zone conflicts, invalid input and quota failures leave prior records unchanged", () => {
  const input = { name: "새 구역", shape: "M100 100 L150 100 L150 150 Z" };
  const created = store.createGardenZone("atomic-create", data, input, "");
  const before = JSON.stringify([...localStorage.items]);
  assert.throws(
    () => store.createGardenZone("atomic-create", data, input, ""),
    /다른 탭/,
  );
  for (const change of [
    { name: " " },
    { shape: "M100 100 L100 100 Z" },
    { shape: "M90000000 0 L90000100 0 L90000000 100 Z" },
  ]) {
    assert.throws(() =>
      store.createGardenZone(
        "atomic-create",
        data,
        { ...input, ...change },
        created.revision,
      ),
    );
  }
  localStorage.failWrites = true;
  assert.throws(
    () =>
      store.createGardenZone("atomic-create", data, input, created.revision),
    /저장하지 못/,
  );
  assert.equal(JSON.stringify([...localStorage.items]), before);
});

test("async API facade and detached GeoJSON export expose transferable data without storage coupling", async () => {
  const initial = await store.gardenZonesApi.read("http-ready", data);
  const created = await store.gardenZonesApi.create(
    "http-ready",
    data,
    { name: "새 구역", shape: "M100 100 L150 100 L150 150 Z" },
    initial.revision,
  );
  const updated = await store.gardenZonesApi.update(
    "http-ready",
    data,
    { ...editOf(created.zones.at(-1)), name: "변경 이름" },
    created.revision,
  );
  const collection = store.exportGardenZoneFeatureCollection(updated);
  assert.equal(collection.type, "FeatureCollection");
  assert.equal(collection.features.length, updated.zones.length);
  assert(collection.features.some((f) => f.geometry.type === "MultiPolygon"));
  assert.equal(collection.features.at(-1).properties.name, "변경 이름");
  collection.features.at(-1).properties.name = "외부에서 수정";
  assert.equal(updated.records.at(-1).geojson.properties.name, "변경 이름");
  assert.deepEqual(
    await store.gardenZonesApi.read("http-ready", data),
    updated,
  );
  assert.throws(
    () =>
      store.loadGardenZoneEdits("http-ready", {
        ...data,
        mapId: "unregistered-map",
      }),
    /좌표 변환/,
  );
});
