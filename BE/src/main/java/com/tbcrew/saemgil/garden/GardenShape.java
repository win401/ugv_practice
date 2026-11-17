package com.tbcrew.saemgil.garden;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;

// 화면이 보낸 정원 경계가 저장해도 되는 모양인지 검사한다.
// 곡선을 직선으로 나누는 계산과 교차 검사는 화면이 한다. 여기서는 형식, 닫힘, 점 개수, 좌표 범위만 본다.
final class GardenShape {

    // 경계 원본의 명령 종류와 명령마다 필요한 점 개수. M: 시작, L: 직선, Q·C: 곡선, Z: 닫기
    private static final Map<String, Integer> POINTS = Map.of("M", 1, "L", 1, "Q", 2, "C", 3, "Z", 0);
    private static final int MAX_COMMANDS = 256;
    private static final int MAX_RING_POINTS = 4097;

    private GardenShape() {
    }

    // [{"kind":"M","points":[[경도,위도]]}, ..., {"kind":"Z","points":[]}]
    static void requireBoundary(JsonNode boundary) {
        if (boundary == null || !boundary.isArray() || boundary.size() < 4 || boundary.size() > MAX_COMMANDS) {
            throw invalid();
        }
        for (int i = 0; i < boundary.size(); i++) {
            JsonNode command = boundary.get(i);
            JsonNode kind = command.path("kind");
            JsonNode points = command.path("points");
            Integer count = kind.isString() ? POINTS.get(kind.asString()) : null;
            if (count == null || !points.isArray() || points.size() != count) {
                throw invalid();
            }
            // 한 번에 닫힌 경계 하나만 받는다: 맨 앞이 M, 맨 뒤가 Z
            boolean first = i == 0;
            boolean last = i == boundary.size() - 1;
            if (first != "M".equals(kind.asString()) || last != "Z".equals(kind.asString())) {
                throw invalid();
            }
            points.forEach(GardenShape::requirePosition);
        }
    }

    // {"type":"Polygon","coordinates":[[[경도,위도], ..., 처음 점과 같은 마지막 점]]}
    static void requirePolygon(JsonNode geojson) {
        if (geojson == null || !geojson.isObject() || geojson.size() != 2
                || !"Polygon".equals(geojson.path("type").asString(""))) {
            throw invalid();
        }
        JsonNode rings = geojson.path("coordinates");
        if (!rings.isArray() || rings.size() != 1) {
            throw invalid();
        }
        JsonNode ring = rings.get(0);
        if (!ring.isArray() || ring.size() < 4 || ring.size() > MAX_RING_POINTS) {
            throw invalid();
        }
        ring.forEach(GardenShape::requirePosition);
        JsonNode start = ring.get(0);
        JsonNode end = ring.get(ring.size() - 1);
        if (start.get(0).asDouble() != end.get(0).asDouble() || start.get(1).asDouble() != end.get(1).asDouble()) {
            throw invalid();
        }
    }

    private static void requirePosition(JsonNode position) {
        if (!position.isArray() || position.size() != 2 || !position.get(0).isNumber()
                || !position.get(1).isNumber()) {
            throw invalid();
        }
        double lng = position.get(0).asDouble();
        double lat = position.get(1).asDouble();
        if (!Double.isFinite(lng) || !Double.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
            throw invalid();
        }
    }

    private static ResponseStatusException invalid() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "정원 경계가 올바르지 않습니다. 지도에서 다시 그려 주세요.");
    }
}
