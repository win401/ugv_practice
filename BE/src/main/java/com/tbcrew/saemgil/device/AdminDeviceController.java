package com.tbcrew.saemgil.device;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.tbcrew.saemgil.common.Patch;

import lombok.RequiredArgsConstructor;

// 관리자 전용 장비 관리. /api/admin/** 은 SecurityConfig에서 관리자만 통과한다.
@RestController
@RequestMapping("/api/admin/devices")
@RequiredArgsConstructor
public class AdminDeviceController {

    private final DeviceService deviceService;

    @GetMapping
    public List<DeviceResponse> list() {
        return deviceService.list().stream().map(DeviceResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DeviceResponse register(@RequestBody RegisterDeviceRequest request) {
        return DeviceResponse.from(deviceService.register(request));
    }

    // 보낸 값만 고친다. firmware, online, state, battery, water, activeGardenId
    @PatchMapping("/{id}")
    public DeviceResponse update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return DeviceResponse.from(deviceService.update(id, new Patch(body)));
    }

    @PostMapping("/{id}/release")
    public DeviceResponse release(@PathVariable String id) {
        return DeviceResponse.from(deviceService.release(id));
    }
}
