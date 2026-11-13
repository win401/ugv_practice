package com.ugv.practice;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DeviceStatusController {
    @GetMapping("/devices/{deviceId}/status")
    ResponseEntity<Map<String, Object>> status(@PathVariable String deviceId) {
        if (!"UGV-01".equals(deviceId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("detail", "device not found"));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("device_id", deviceId);
        result.put("status", "unknown");
        result.put("checked_at", null);
        return ResponseEntity.ok(result);
    }
}
