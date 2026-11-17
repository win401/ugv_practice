import { GARDEN_IMAGE } from "../lib/gardenImage";

export type Point = [number, number];

export interface DetailZone {
  id: string;
  letter: string;
  name: string;
  description: string;
  shape: string;
  label: Point;
  stopNode: string | null;
  origin?: "seed" | "custom";
  coordinateAccuracy?: "illustrative" | "map-edited";
}

export interface DetailMapData {
  mapId: string;
  imageUrl: string;
  imageRevision: string;
  width: number;
  height: number;
  zones: DetailZone[];
  paths: Point[][];
  dock: Point;
}

export interface DetailPlan {
  zoneIds: string[];
  points: Point[];
  stops: { zoneId: string; point: Point }[];
  pixelLength: number;
}

// Fictional garden detail data manually traced against the expanded 1536 × 1024 image.
// Planting boundaries and walkway bends are traced in the image pixel frame.
// The image URL/revision travel with these coordinates. Several small planting
// islands form one selectable area. No navigation clearance is inferred.
// Coordinates are image pixels, not surveyed metres or geographic coordinates.
// These planting outlines and approach points are UI examples, not navigation
// clearance, irrigation coverage, real telemetry, or device commands.
const zones: DetailZone[] = [
  {
    id: "circle-nw",
    letter: "A",
    name: "원형정원 북서 화단",
    description: "원형 광장 왼쪽 위의 곡선형 초화 화단",
    shape:
      "M540 343 C469 346 411 383 383 447 L494 491 C506 474 521 463 541 459 Z",
    label: [466.4, 405.1],
    stopNode: "approach-a",
  },
  {
    id: "circle-ne",
    letter: "B",
    name: "원형정원 북동 화단",
    description: "원형 광장 오른쪽 위의 곡선형 초화 화단",
    shape:
      "M572 342 C644 348 707 389 730 453 L625 492 C611 472 592 458 571 456 Z",
    label: [631.6, 402.2],
    stopNode: "approach-b",
  },
  {
    id: "circle-se",
    letter: "C",
    name: "원형정원 남동 화단",
    description: "동쪽 산책로 아래의 노란색·보라색 초화 화단",
    shape:
      "M627 501 L744 482 C756 539 741 595 703 639 L624 565 C632 544 632 522 627 501 Z",
    label: [687.5, 546.5],
    stopNode: "approach-c",
  },
  {
    id: "circle-s",
    letter: "D",
    name: "원형정원 남측 화단",
    description: "두 갈래 산책로 사이에 놓인 남측 부채꼴 화단",
    shape:
      "M536 589 C559 597 586 592 608 582 L687 666 C633 710 570 723 498 704 Z",
    label: [584.5, 659.6],
    stopNode: "approach-d",
  },
  {
    id: "circle-sw",
    letter: "E",
    name: "원형정원 남서 화단",
    description: "진입 산책로 왼쪽의 보라색·노란색 초화 화단",
    shape:
      "M371 480 L488 508 C488 540 500 565 524 581 L478 683 C403 653 358 565 371 480 Z",
    label: [428.6, 573.3],
    stopNode: "approach-e",
  },
  {
    id: "rose-south",
    letter: "F",
    name: "장미정원 남측 화단",
    description: "장미 모양 정원의 남쪽 꽃잎 구역 · 내부 산책로 제외",
    shape:
      "M787 407 C816 429 852 434 884 420 C877 442 846 450 816 440 C800 433 791 421 787 407 Z",
    label: [837, 430],
    stopNode: "approach-f",
  },
  {
    id: "leaf-south",
    letter: "G",
    name: "잎새정원 남측 화단",
    description: "하얀 아치가 놓인 큰 잎 모양의 초화 화단",
    shape:
      "M933 466 C957 465 977 484 984 508 C991 539 970 567 939 578 C899 590 849 573 829 550 C815 536 820 522 844 509 C879 490 908 467 933 466 Z",
    label: [916, 541],
    stopNode: "approach-g",
  },
  {
    id: "rose-north",
    letter: "H",
    name: "장미정원 북측 꽃잎",
    description: "아치 안쪽 북서·북동 꽃잎 두 곳",
    shape:
      "M774 331 C779 312 802 299 825 299 C807 307 792 321 785 337 Z M853 296 C883 295 914 311 925 337 C903 325 888 316 865 313 Z",
    label: [888, 314],
    stopNode: "approach-h",
  },
  {
    id: "rose-center",
    letter: "I",
    name: "장미정원 중앙 꽃잎",
    description: "장미 중심의 작은 꽃잎들을 묶은 예시 구역",
    shape:
      "M813 332 C824 314 851 309 875 321 C849 318 831 324 813 332 Z M799 354 C786 366 785 389 802 396 L814 401 C804 386 804 372 807 358 Z M834 350 C833 339 840 336 845 346 L842 361 Z M846 342 C855 340 867 345 875 352 L873 359 C860 354 853 353 846 342 Z M845 365 C848 355 860 357 866 366 L872 372 C863 377 852 375 845 365 Z M830 374 C833 382 841 387 850 385 C843 396 830 391 824 384 Z M862 392 C874 387 881 379 884 370 C890 380 885 393 873 398 L861 401 Z M907 347 C917 356 922 372 916 385 L903 398 C911 378 906 366 900 354 Z",
    label: [856, 368],
    stopNode: "approach-i",
  },
  {
    id: "rose-east",
    letter: "J",
    name: "장미정원 동측 꽃잎",
    description: "장미 외곽 남동쪽의 긴 곡선 화단",
    shape:
      "M942 401 C932 426 909 451 873 458 L874 445 C905 439 926 424 930 408 Z",
    label: [916, 435],
    stopNode: "approach-j",
  },
  {
    id: "rose-west",
    letter: "K",
    name: "장미정원 서측 화단",
    description: "장미 모양 정원 서쪽의 좁은 가장자리 화단",
    shape:
      "M758 347 C756 375 759 401 770 430 L757 432 C745 415 742 389 747 365 Z",
    label: [755, 394],
    stopNode: "approach-k",
  },
  {
    id: "crescent-pink",
    letter: "L",
    name: "분홍 초승달 화단",
    description: "장미정원 오른쪽 위의 굽은 분홍 초화 화단",
    shape:
      "M952 340 C974 363 1001 357 1013 335 C1021 320 1034 304 1049 304 C1057 313 1041 323 1036 337 C1029 361 1004 376 982 372 C966 369 955 358 952 340 Z",
    label: [998, 355],
    stopNode: "approach-l",
  },
  {
    id: "north-islands",
    letter: "M",
    name: "북측 작은 화단",
    description: "상단의 작은 초화·수목 화단 세 곳",
    shape:
      "M953 307 C963 294 982 295 993 307 C988 320 965 325 953 307 Z M1007 289 C1011 279 1025 274 1038 279 L1030 297 Z M1065 266 C1075 262 1088 270 1095 284 L1082 302 C1069 302 1062 283 1065 266 Z",
    label: [974, 309],
    stopNode: "approach-m",
  },
  {
    id: "upper-leaf",
    letter: "N",
    name: "북동쪽 잎새 화단",
    description: "북동쪽의 두 갈래 초록·노랑 식재",
    shape:
      "M1114 292 C1133 286 1158 303 1177 327 L1178 336 C1145 337 1124 330 1114 316 Z",
    label: [1146, 317],
    stopNode: "approach-n",
  },
  {
    id: "east-small-beds",
    letter: "O",
    name: "동측 작은 화단",
    description: "분홍 초화와 그 오른쪽 초록 잎새 화단",
    shape:
      "M1051 339 C1054 322 1070 315 1085 321 L1098 339 C1086 355 1065 365 1048 360 Z M1105 361 C1114 345 1131 340 1153 347 L1178 355 C1176 375 1157 386 1139 385 C1121 384 1106 377 1105 361 Z",
    label: [1138, 369],
    stopNode: "approach-o",
  },
  {
    id: "lavender-leaf",
    letter: "P",
    name: "라벤더 잎새 화단",
    description: "보라색과 노란색 줄무늬가 있는 중부 화단",
    shape:
      "M966 408 C989 392 1035 388 1066 405 C1082 425 1078 453 1058 469 C1032 485 995 469 978 450 C968 438 958 422 966 408 Z",
    label: [1024, 439],
    stopNode: "approach-p",
  },
  {
    id: "round-east",
    letter: "Q",
    name: "원형 조형물 화단",
    description: "동그란 분홍 포인트를 둘러싼 둥근 초화 화단",
    shape:
      "M1101 408 C1124 399 1161 405 1180 421 C1186 448 1168 477 1145 490 C1128 498 1098 495 1084 484 C1082 464 1090 435 1101 408 Z",
    label: [1132, 457],
    stopNode: "approach-q",
  },
  {
    id: "heart-east",
    letter: "R",
    name: "동쪽 하트 화단",
    description: "가장 오른쪽의 길쭉한 분홍·흰색 초화 화단",
    shape:
      "M1220 344 C1240 339 1250 358 1254 373 C1270 376 1291 377 1317 383 L1307 400 C1282 415 1257 439 1234 438 C1215 437 1202 413 1200 392 C1200 369 1208 349 1220 344 Z",
    label: [1236, 402],
    stopNode: "approach-r",
  },
  {
    id: "north-lawn",
    letter: "S",
    name: "북측 잔디·수목 구역",
    description: "상단 산책로 바깥의 넓은 잔디와 수목 구역",
    shape:
      "M281 118 L448 81 L680 70 L905 107 L1086 151 L1061 201 L796 225 L580 247 L330 288 L206 285 L224 202 Z",
    label: [645, 174],
    stopNode: "approach-s",
  },
  {
    id: "southwest-border",
    letter: "T",
    name: "남서측 가장자리 화단",
    description: "원형정원 바깥 진입길 옆의 꽃나무와 초화",
    shape:
      "M300 688 C333 685 366 704 384 720 L447 741 L443 757 C397 775 337 764 298 749 L276 733 Z",
    label: [357, 738],
    stopNode: "approach-t",
  },
  {
    id: "west-lawn",
    letter: "U",
    name: "서측 잔디 구역",
    description: "원형정원 서쪽 산책로 바깥 잔디·수목 구역",
    shape:
      "M24 402 L108 412 L214 366 L302 383 L285 482 L244 582 L189 648 L85 684 L19 649 Z",
    label: [165, 501],
    stopNode: "approach-u",
  },
  {
    id: "northeast-lawn",
    letter: "V",
    name: "북동측 잔디 구역",
    description: "동쪽 큰 산책길 너머 북쪽의 잔디·꽃나무 구역",
    shape:
      "M1360 145 L1434 135 L1519 155 L1519 272 L1458 290 L1393 257 L1350 216 Z",
    label: [1442, 209],
    stopNode: "approach-v",
  },
  {
    id: "east-lawn",
    letter: "W",
    name: "동측 잔디 구역",
    description: "동쪽 큰 산책길 바깥의 잔디·수목 구역",
    shape:
      "M1408 402 L1518 366 L1518 530 L1466 556 L1401 581 L1375 532 L1371 469 Z",
    label: [1445, 481],
    stopNode: "approach-w",
  },
  {
    id: "waterfront-border",
    letter: "X",
    name: "호숫가 식재 구역",
    description: "남측 산책길 위쪽의 가늘고 긴 수목·초화 구역",
    shape:
      "M600 727 L730 693 L891 651 L1046 611 L1080 626 L928 673 L755 721 L625 757 Z",
    label: [837, 684],
    stopNode: "approach-x",
  },
];

// Graph edges approximate visible paved paths in the expanded example image.
// Approach nodes are placed beside planting beds for a UI preview only. "dock" is a sample start marker on a path;
// it does not assert that a charging station exists at this location.
const nodes: Record<string, Point> = {
  dock: [470.0, 764.0],
  entrance: [472.1, 737.2],
  southwest1: [485.9, 697.3],
  southwest2: [501.9, 658.2],
  "approach-e": [515.6, 624.1],
  southwest3: [535.2, 577.0],
  center: [557.7, 521.1],
  westInner: [494.6, 501.6],
  "approach-a": [447.5, 487.1],
  westSpoke: [394.6, 471.8],
  westJunction: [350.4, 458.8],
  northInner: [555.5, 452.3],
  "approach-b": [555.5, 395.0],
  northEnd: [553.3, 335.5],
  eastInner: [625.8, 493.6],
  "approach-c": [686.8, 473.3],
  eastEnd: [743.3, 458.1],
  southeastInner: [606.3, 563.2],
  "approach-d": [638.2, 596.5],
  southeast1: [672.2, 629.2],
  southeast2: [705.6, 662.5],
  eastGarden1: [731.7, 651.6],
  eastGarden2: [767.2, 613.2],
  eastGarden3: [802.8, 575.5],
  leafWest1: [812.9, 552.3],
  leafWest2: [810.7, 524.8],
  roseApproach1: [826.7, 504.5],
  roseApproach2: [860.8, 497.2],
  roseApproach3: [894.1, 479.1],
  "approach-f": [898.4, 452.3],
  leafSouth1: [836.1, 592.2],
  leafSouth2: [867.3, 600.2],
  "approach-g": [914, 601],
  westOuter1: [335.9, 501.6],
  westOuter2: [332.9, 550.1],
  westOuter3: [322.8, 596.5],
  westOuter4: [303.2, 637.1],
  westOuter5: [269.9, 677.0],
  westOuter6: [246.7, 707.5],
  westOuter7: [256.1, 741.5],
  westOuter8: [298.9, 771.3],
  westOuter9: [351.8, 787.2],
  westOuter10: [409.1, 785.8],
  roseSouthJunction: [900, 474],
  roseOuterEast1: [956, 455],
  roseOuterEast2: [956, 393],
  roseInnerEast: [935, 385],
  roseInnerSouth: [906, 408],
  roseInnerTurn: [894, 407],
  roseCenterTurn: [895, 387],
  "approach-i": [893, 372],
  "approach-j": [941, 447],
  roseNorthEast: [949, 338],
  roseNorthTurn: [945, 304],
  roseNorthTop: [914, 284],
  "approach-h": [858, 283],
  roseWestSouth: [751, 430],
  roseWestMiddle: [745, 407],
  "approach-k": [741, 383],
  eastWalkWest: [983, 386],
  "approach-l": [1013, 380],
  eastWalkMiddle: [1064, 380],
  eastWalkFork: [1092, 390],
  eastWalkNorth: [1090, 368],
  "approach-o": [1094, 361],
  "approach-n": [1120, 338],
  upperWalk: [1107, 314],
  upperWalkEast: [1097, 310],
  upperWalkBend: [1066, 310],
  upperWalkGap: [1048, 292],
  upperWalkWest: [1028, 303],
  "approach-m": [1000, 299],
  eastWalkEnd: [1189, 395],
  "approach-r": [1194, 410],
  eastWalkSouth: [1193, 465],
  "approach-q": [1186, 477],
  leafNorthCorner: [973, 478],
  leafJunction: [996, 495],
  leafEastLower: [1076, 491],
  leafEastBend: [1073, 480],
  leafEastMiddle: [1077, 458],
  leafEastUpper: [1085, 416],
  "approach-p": [1024, 489],
  northCircleWalk: [555, 322],
  northMainWalk: [559, 290],
  "approach-s": [655, 270],
  southEntranceWalk: [452, 783],
  "approach-t": [405, 780],
  "approach-u": [341, 465],
  eastBorderTurn: [1265, 468],
  eastMainWalk: [1340, 450],
  eastMainNorth: [1332, 341],
  northeastJunction: [1320, 267],
  "approach-v": [1304, 185],
  "approach-w": [1366, 510],
  eastMainSouth: [1354, 588],
  riverEast: [1354, 665],
  riverMiddle: [1188, 699],
  riverWest: [1043, 738],
  "approach-x": [894, 759],
};

const chains: string[][] = [
  [
    "dock",
    "entrance",
    "southwest1",
    "southwest2",
    "approach-e",
    "southwest3",
    "center",
  ],
  ["center", "westInner", "approach-a", "westSpoke", "westJunction"],
  ["center", "northInner", "approach-b", "northEnd"],
  ["center", "eastInner", "approach-c", "eastEnd"],
  ["center", "southeastInner", "approach-d", "southeast1", "southeast2"],
  ["southeast2", "eastGarden1", "eastGarden2", "eastGarden3"],
  [
    "eastGarden3",
    "leafWest1",
    "leafWest2",
    "roseApproach1",
    "roseApproach2",
    "roseApproach3",
    "approach-f",
  ],
  ["eastGarden3", "leafSouth1", "leafSouth2", "approach-g"],
  [
    "westJunction",
    "westOuter1",
    "westOuter2",
    "westOuter3",
    "westOuter4",
    "westOuter5",
    "westOuter6",
    "westOuter7",
    "westOuter8",
    "westOuter9",
    "westOuter10",
    "dock",
  ],
  ["roseApproach3", "roseSouthJunction", "roseOuterEast1", "approach-j"],
  [
    "roseOuterEast1",
    "roseOuterEast2",
    "roseNorthEast",
    "roseNorthTurn",
    "roseNorthTop",
    "approach-h",
  ],
  [
    "roseOuterEast2",
    "roseInnerEast",
    "roseInnerSouth",
    "roseInnerTurn",
    "roseCenterTurn",
    "approach-i",
  ],
  ["eastEnd", "roseWestSouth", "roseWestMiddle", "approach-k"],
  [
    "roseOuterEast2",
    "eastWalkWest",
    "approach-l",
    "eastWalkMiddle",
    "eastWalkFork",
    "eastWalkEnd",
    "approach-r",
  ],
  ["eastWalkFork", "eastWalkNorth", "approach-o", "approach-n"],
  [
    "approach-n",
    "upperWalk",
    "upperWalkEast",
    "upperWalkBend",
    "upperWalkGap",
    "upperWalkWest",
    "approach-m",
  ],
  ["eastWalkEnd", "eastWalkSouth", "approach-q"],
  [
    "roseOuterEast1",
    "leafNorthCorner",
    "leafJunction",
    "approach-p",
    "leafEastLower",
    "leafEastBend",
    "leafEastMiddle",
    "leafEastUpper",
    "eastWalkFork",
  ],
  ["northEnd", "northCircleWalk", "northMainWalk", "approach-s"],
  ["dock", "southEntranceWalk", "approach-t"],
  ["westJunction", "approach-u"],
  [
    "eastWalkSouth",
    "eastBorderTurn",
    "eastMainWalk",
    "eastMainNorth",
    "northeastJunction",
    "approach-v",
  ],
  [
    "eastMainWalk",
    "approach-w",
    "eastMainSouth",
    "riverEast",
    "riverMiddle",
    "riverWest",
    "approach-x",
  ],
];

const copyPoint = (point: Point): Point => [point[0], point[1]];
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const graph = new Map<string, { id: string; distance: number }[]>();

for (const id of Object.keys(nodes)) graph.set(id, []);
for (const chain of chains) {
  for (let index = 1; index < chain.length; index += 1) {
    const a = chain[index - 1];
    const b = chain[index];
    const edgeDistance = distance(nodes[a], nodes[b]);
    graph.get(a)!.push({ id: b, distance: edgeDistance });
    graph.get(b)!.push({ id: a, distance: edgeDistance });
  }
}

function shortestPath(start: string, destination: string) {
  const remaining = new Set(graph.keys());
  const distances = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, string>();

  while (remaining.size > 0) {
    let current: string | undefined;
    let currentDistance = Infinity;
    for (const id of remaining) {
      const candidate = distances.get(id) ?? Infinity;
      if (candidate < currentDistance) {
        current = id;
        currentDistance = candidate;
      }
    }
    if (current === undefined) break;
    if (current === destination) {
      const route = [destination];
      while (route[0] !== start) {
        const predecessor = previous.get(route[0]);
        if (!predecessor)
          throw new Error("미리보기 경로를 연결하지 못했습니다.");
        route.unshift(predecessor);
      }
      return { route, distance: currentDistance };
    }
    remaining.delete(current);
    for (const edge of graph.get(current) ?? []) {
      if (!remaining.has(edge.id)) continue;
      const candidate = currentDistance + edge.distance;
      if (candidate < (distances.get(edge.id) ?? Infinity)) {
        distances.set(edge.id, candidate);
        previous.set(edge.id, current);
      }
    }
  }
  throw new Error("선택한 구역까지 연결된 예시 경로가 없습니다.");
}

const zonesById = new Map(zones.map((zone) => [zone.id, zone]));

export const gardenDetailApi = {
  async read(): Promise<DetailMapData> {
    return {
      mapId: "suncheon-garden-detail",
      imageUrl: GARDEN_IMAGE.url,
      imageRevision: GARDEN_IMAGE.revision,
      width: GARDEN_IMAGE.width,
      height: GARDEN_IMAGE.height,
      zones: zones.map((zone) => ({ ...zone, label: copyPoint(zone.label) })),
      paths: chains.map((chain) => chain.map((id) => copyPoint(nodes[id]))),
      dock: copyPoint(nodes.dock),
    };
  },

  async preview(zoneIds: string[]): Promise<DetailPlan> {
    if (!Array.isArray(zoneIds) || zoneIds.length === 0) {
      throw new Error("관수할 구역을 하나 이상 선택하세요.");
    }
    if (zoneIds.some((id) => typeof id !== "string" || !zonesById.has(id))) {
      throw new Error("지도에 없는 구역이 포함되어 있습니다.");
    }

    // Dijkstra finds each leg on the manually authored path graph. We visit the
    // nearest remaining approach point, breaking ties by zone id. This is a
    // deterministic example ordering, not a globally optimal multi-stop route.
    const remaining = [...new Set(zoneIds)].sort();
    const plan: DetailPlan = {
      zoneIds: [],
      points: [copyPoint(nodes.dock)],
      stops: [],
      pixelLength: 0,
    };
    let current = "dock";

    while (remaining.length > 0) {
      let selectedIndex = 0;
      let leg = shortestPath(current, zonesById.get(remaining[0])!.stopNode!);
      for (let index = 1; index < remaining.length; index += 1) {
        const candidate = shortestPath(
          current,
          zonesById.get(remaining[index])!.stopNode!,
        );
        if (candidate.distance < leg.distance) {
          selectedIndex = index;
          leg = candidate;
        }
      }
      const [zoneId] = remaining.splice(selectedIndex, 1);
      current = zonesById.get(zoneId)!.stopNode!;
      plan.zoneIds.push(zoneId);
      plan.points.push(...leg.route.slice(1).map((id) => copyPoint(nodes[id])));
      plan.stops.push({ zoneId, point: copyPoint(nodes[current]) });
      plan.pixelLength += leg.distance;
    }
    return plan;
  },
};
