package com.tbcrew.saemgil.garden;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
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

// 관리자 전용 정원 관리. /api/admin/** 은 SecurityConfig에서 관리자만 통과한다.
@RestController
@RequestMapping("/api/admin/gardens")
@RequiredArgsConstructor
public class AdminGardenController {

    private final GardenService gardenService;

    @GetMapping
    public List<GardenResponse> list() {
        return gardenService.list().stream().map(GardenResponse::from).toList();
    }

    // 위성지도에 그린 위경도 경계와 함께 등록한다.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GardenResponse create(@RequestBody CreateGardenRequest request) {
        return GardenResponse.from(gardenService.create(request));
    }

    // 보낸 값만 고친다. name, address, flower, area, status, deviceId(null이면 배정 해제), customerId
    // 위치와 경계를 고칠 때는 centerLat, centerLng, boundary, geojson 넷을 함께 보낸다.
    @PatchMapping("/{id}")
    public GardenResponse update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return GardenResponse.from(gardenService.update(id, new Patch(body)));
    }

    // 정원을 지운다. 작업 중이던 장비는 대기로 돌리고, 장비는 남는다.
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        gardenService.delete(id);
    }
}
