package com.tbcrew.saemgil.garden;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Locale;

import com.fasterxml.jackson.annotation.JsonRawValue;

// API로 내보내는 정원 정보. 좌표 순서는 [경도, 위도]다.
// boundary와 geojson은 DB에 저장한 JSON을 글자로 감싸지 않고 그대로 내보낸다.
public record GardenResponse(
        Long id,
        Long customerId,
        String name,
        String address,
        String flower,
        BigDecimal area,
        String status,
        String deviceId,
        LocalDate registered,
        BigDecimal centerLat,
        BigDecimal centerLng,
        @JsonRawValue String boundary,
        @JsonRawValue String geojson) {

    public static GardenResponse from(Garden garden) {
        return new GardenResponse(
                garden.getId(),
                garden.getOwnerId(),
                garden.getName(),
                garden.getAddress(),
                garden.getFlower(),
                garden.getArea(),
                garden.getStatus().name().toLowerCase(Locale.ROOT),
                garden.getDeviceId(),
                garden.getCreatedAt().toLocalDate(),
                garden.getCenterLat(),
                garden.getCenterLng(),
                garden.getBoundary(),
                garden.getGeojson());
    }
}
