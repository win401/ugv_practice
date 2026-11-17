package com.tbcrew.saemgil.device;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Locale;

// API로 내보내는 장비 정보. FE의 Device 타입(FE/src/api/types.ts)에 맞춘다.
// lastSeen은 한 번도 수신한 적이 없으면 null이다.
public record DeviceResponse(
        String id,
        String serial,
        String firmware,
        boolean online,
        String state,
        int battery,
        int water,
        LocalDateTime lastSeen,
        LocalDate registered,
        Long activeGardenId) {

    public static DeviceResponse from(Device device) {
        return new DeviceResponse(
                device.getId(),
                device.getSerial(),
                device.getFirmware(),
                device.isOnline(),
                device.getState().name().toLowerCase(Locale.ROOT),
                device.getBattery(),
                device.getWater(),
                device.getLastSeenAt(),
                device.getCreatedAt().toLocalDate(),
                device.getActiveGardenId());
    }
}
