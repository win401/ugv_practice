package com.tbcrew.saemgil.device;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.tbcrew.saemgil.common.Patch;
import com.tbcrew.saemgil.garden.Garden;
import com.tbcrew.saemgil.garden.GardenRepository;

import jakarta.persistence.EntityManager;

import lombok.RequiredArgsConstructor;

// 관리자의 장비 관리: 목록, 등록, 값 수정, 회수.
// 연결 여부·상태·배터리·물은 장비 연동 전까지 관리자가 넣는 값이다.
@Service
@RequiredArgsConstructor
public class DeviceService {

    private static final String ID_PREFIX = "ROVEN-";

    private final DeviceRepository deviceRepository;
    private final GardenRepository gardenRepository;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public List<Device> list() {
        return deviceRepository.findAll(Sort.by("id"));
    }

    @Transactional
    public Device register(RegisterDeviceRequest request) {
        String serial = request.serial() == null ? "" : request.serial().trim();
        String firmware = request.firmware() == null ? "" : request.firmware().trim();
        if (serial.isEmpty() || serial.length() > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "시리얼 번호는 1~50자로 입력해 주세요.");
        }
        if (firmware.isEmpty() || firmware.length() > 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "펌웨어 버전은 1~30자로 입력해 주세요.");
        }
        if (deviceRepository.existsBySerial(serial)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 등록된 시리얼 번호입니다.");
        }
        try {
            Device saved = deviceRepository.saveAndFlush(new Device(nextId(), serial, firmware));
            // 등록일은 DB가 채우므로 다시 읽어 응답에 담는다.
            entityManager.refresh(saved);
            return saved;
        } catch (DataIntegrityViolationException e) {
            // 위 확인과 저장 사이에 다른 등록이 먼저 들어간 경우
            throw new ResponseStatusException(HttpStatus.CONFLICT, "같은 장비가 방금 등록됐습니다. 다시 시도해 주세요.");
        }
    }

    @Transactional
    public Device update(String id, Patch patch) {
        Device device = find(id);
        if (patch.has("firmware")) {
            device.changeFirmware(patch.text("firmware", 30, true));
        }
        if (patch.has("online")) {
            device.changeOnline(patch.flag("online"));
        }
        if (patch.has("state")) {
            device.changeState(parseState(patch));
        }
        if (patch.has("battery")) {
            device.changeBattery(patch.integer("battery", 0, 100));
        }
        if (patch.has("water")) {
            device.changeWater(patch.integer("water", 0, 100));
        }
        if (patch.has("activeGardenId")) {
            device.changeActiveGarden(patch.isNull("activeGardenId") ? null : activeGarden(device, patch));
        }
        // 켜져 있는 장비의 값이 바뀌면 방금 수신한 것으로 본다.
        if (device.isOnline()) {
            device.markSeen(LocalDateTime.now());
        }
        return device;
    }

    // 맡은 정원에서 모두 빼고 대기 상태로 돌린다.
    @Transactional
    public Device release(String id) {
        Device device = find(id);
        gardenRepository.findByDeviceId(id).forEach(garden -> garden.assignDevice(null));
        device.stopWork();
        return device;
    }

    private Device find(String id) {
        return deviceRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "장비를 찾을 수 없습니다."));
    }

    // 지금 있는 번호 중 가장 큰 것 다음 번호. ROVEN-01, ROVEN-02 ...
    private String nextId() {
        int max = deviceRepository.findAll().stream()
                .map(device -> device.getId().replaceAll("\\D", ""))
                .filter(digits -> !digits.isEmpty())
                .mapToInt(Integer::parseInt)
                .max().orElse(0);
        return ID_PREFIX + String.format("%02d", max + 1);
    }

    private static DeviceState parseState(Patch patch) {
        try {
            return DeviceState.valueOf(patch.text("state", 20, true).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw Patch.invalid("state");
        }
    }

    // 작업 중인 정원은 이 장비가 맡은 정원이어야 한다.
    private Long activeGarden(Device device, Patch patch) {
        Garden garden = gardenRepository.findById(patch.id("activeGardenId")).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "정원을 찾을 수 없습니다."));
        if (!device.getId().equals(garden.getDeviceId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이 장비가 맡은 정원이 아닙니다.");
        }
        return garden.getId();
    }
}
