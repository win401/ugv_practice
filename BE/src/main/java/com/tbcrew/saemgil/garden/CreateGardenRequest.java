package com.tbcrew.saemgil.garden;

import java.math.BigDecimal;

import tools.jackson.databind.JsonNode;

// 관리자가 정원을 등록할 때 보내는 값. 좌표 순서는 [경도, 위도]다.
// boundary: 화면에서 그린 경계 원본(직선·곡선 명령 목록)
// geojson: 화면이 곡선을 짧은 직선으로 나눠 만든 GeoJSON Polygon
public record CreateGardenRequest(
        Long customerId,
        String name,
        String address,
        String flower,
        BigDecimal area,
        String deviceId,
        BigDecimal centerLat,
        BigDecimal centerLng,
        JsonNode boundary,
        JsonNode geojson) {
}
