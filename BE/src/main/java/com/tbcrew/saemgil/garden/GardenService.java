package com.tbcrew.saemgil.garden;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.tbcrew.saemgil.common.Patch;
import com.tbcrew.saemgil.device.Device;
import com.tbcrew.saemgil.device.DeviceRepository;
import com.tbcrew.saemgil.user.UserRepository;

import jakarta.persistence.EntityManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import lombok.RequiredArgsConstructor;

// 관리자의 정원 관리: 목록, 등록, 수정(정보·상태·장비 배정·주인 변경·위치와 경계), 삭제.
// 지키는 규칙: 같은 고객에게 같은 이름의 정원은 하나(비활성 제외), 장비 한 대는 한 고객의 정원만 맡는다.
//
// 동시에 들어온 요청이 이 규칙을 깨거나 서로의 저장 내용을 덮어쓰지 않도록, 등록·수정은 관련 행을 잠그고 진행한다.
// - 잠그는 순서는 항상 정원 → 주인 계정 → 장비다. 순서가 같아야 두 요청이 서로를 기다리며 멈추지 않는다.
// - 등록·수정은 READ_COMMITTED로 실행한다. 잠금을 기다린 뒤에 하는 조회가 앞 요청이 막 저장한 값을 보게 하기 위해서다.
//   (MySQL 기본 설정은 요청이 시작할 때의 모습을 계속 보여 줘서, 기다린 뒤에도 예전 값을 읽는다.)
@Service
@RequiredArgsConstructor
public class GardenService {

    // 경계를 고칠 때 함께 보내야 하는 값. 하나만 바뀌면 지도 위치와 모양이 서로 어긋난다.
    private static final List<String> BOUNDARY_KEYS = List.of("centerLat", "centerLng", "boundary", "geojson");

    private final GardenRepository gardenRepository;
    private final DeviceRepository deviceRepository;
    private final UserRepository userRepository;
    private final EntityManager entityManager;
    private final JsonMapper jsonMapper;

    @Transactional(readOnly = true)
    public List<Garden> list() {
        return gardenRepository.findAll(Sort.by("id"));
    }

    // 관리자가 등록한 정원은 바로 사용 중이 된다.
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Garden create(CreateGardenRequest request) {
        if (request.customerId() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "계정을 찾을 수 없습니다.");
        }
        lockOwner(request.customerId());
        String name = trimmed(request.name());
        String address = trimmed(request.address());
        String flower = trimmed(request.flower());
        if (name.isEmpty() || name.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "정원 이름을 1~100자로 입력해 주세요.");
        }
        if (address.length() > 200 || flower.length() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "주소와 주요 식재는 200자 이하로 입력해 주세요.");
        }
        BigDecimal area = validArea(request.area());
        requireCenter(request.centerLat(), request.centerLng());
        GardenShape.requireBoundary(request.boundary());
        GardenShape.requirePolygon(request.geojson());

        String deviceId = trimmed(request.deviceId());
        Garden garden = new Garden(request.customerId(), name, address, flower, area, null,
                request.centerLat().setScale(7, RoundingMode.HALF_UP),
                request.centerLng().setScale(7, RoundingMode.HALF_UP),
                request.boundary().toString(), request.geojson().toString());
        if (!deviceId.isEmpty()) {
            garden.assignDevice(assignable(garden, deviceId));
        }
        rejectDuplicateName(garden);
        Garden saved = gardenRepository.saveAndFlush(garden);
        // 등록일은 DB가 채우므로 다시 읽어 응답에 담는다.
        entityManager.refresh(saved);
        return saved;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Garden update(Long id, Patch patch) {
        // 정원 행을 잠그고 최신 값을 읽은 뒤 고친다. 잠그지 않으면 동시에 온 두 수정 중 뒤의 것이
        // 예전 값 위에 자기 변경만 얹어 저장해서, 앞의 수정이 사라진다.
        Garden garden = gardenRepository.findByIdForUpdate(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "정원을 찾을 수 없습니다."));

        long ownerId = patch.has("customerId") ? patch.id("customerId") : garden.getOwnerId();
        lockOwner(ownerId);
        boolean ownerChanged = ownerId != garden.getOwnerId();
        if (ownerChanged) {
            garden.changeOwner(ownerId);
        }
        if (patch.has("name")) {
            garden.rename(patch.text("name", 100, true));
        }
        if (patch.has("address")) {
            garden.changeAddress(patch.text("address", 200, false));
        }
        if (patch.has("flower")) {
            garden.changeFlower(patch.text("flower", 200, false));
        }
        if (patch.has("area")) {
            garden.changeArea(validArea(patch.decimal("area")));
        }
        if (patch.has("status")) {
            garden.changeStatus(parseStatus(patch));
        }
        if (BOUNDARY_KEYS.stream().anyMatch(patch::has)) {
            changeBoundary(garden, patch);
        }
        // 주인이 바뀌면 이전 고객의 장비를 계속 쓰지 않도록 배정을 푼다.
        if (ownerChanged) {
            garden.assignDevice(null);
        } else if (patch.has("deviceId")) {
            garden.assignDevice(patch.isNull("deviceId") ? null
                    : assignable(garden, patch.text("deviceId", 20, true)));
        }
        if (garden.getStatus() != GardenStatus.INACTIVE) {
            rejectDuplicateName(garden);
        }
        // 작업 중이던 정원에서 장비가 빠지면 작업도 멈춘다.
        deviceRepository.findByActiveGardenId(garden.getId()).stream()
                .filter(device -> !device.getId().equals(garden.getDeviceId()))
                .forEach(Device::stopWork);
        return garden;
    }

    // 정원을 지운다. 되돌릴 수 없다.
    // 이 정원에서 작업 중이던 장비는 대기 상태로 돌린다. 장비 자체와 그 장비의 다른 정원 배정은 그대로 둔다.
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void delete(Long id) {
        Garden garden = gardenRepository.findByIdForUpdate(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "정원을 찾을 수 없습니다."));
        deviceRepository.findByActiveGardenId(garden.getId()).forEach(Device::stopWork);
        // 장비가 정원을 가리키는 값을 먼저 비워야 정원을 지울 수 있다.
        deviceRepository.flush();
        gardenRepository.delete(garden);
    }

    // 위치와 경계는 넷을 함께 받아 등록할 때와 같은 검사를 거친다.
    private void changeBoundary(Garden garden, Patch patch) {
        for (String key : BOUNDARY_KEYS) {
            if (!patch.has(key)) {
                throw Patch.invalid(key);
            }
        }
        BigDecimal centerLat = patch.decimal("centerLat");
        BigDecimal centerLng = patch.decimal("centerLng");
        requireCenter(centerLat, centerLng);
        JsonNode boundary = jsonMapper.valueToTree(patch.values().get("boundary"));
        JsonNode geojson = jsonMapper.valueToTree(patch.values().get("geojson"));
        GardenShape.requireBoundary(boundary);
        GardenShape.requirePolygon(geojson);
        garden.changeBoundary(centerLat.setScale(7, RoundingMode.HALF_UP), centerLng.setScale(7, RoundingMode.HALF_UP),
                boundary.toString(), geojson.toString());
    }

    private static void requireCenter(BigDecimal centerLat, BigDecimal centerLng) {
        if (centerLat == null || centerLng == null
                || centerLat.abs().compareTo(BigDecimal.valueOf(90)) > 0
                || centerLng.abs().compareTo(BigDecimal.valueOf(180)) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "정원 위치가 올바르지 않습니다.");
        }
    }

    private static GardenStatus parseStatus(Patch patch) {
        try {
            return GardenStatus.valueOf(patch.text("status", 20, true).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw Patch.invalid("status");
        }
    }

    // 배정하려는 장비가 있고, 다른 고객의 정원을 맡고 있지 않아야 한다.
    // 확인과 저장 사이에 다른 요청이 같은 장비를 다른 고객에게 배정하지 못하도록 장비 행을 먼저 잠근다.
    // 뒤에 온 요청은 앞 요청이 끝날 때까지 기다렸다가, 앞 요청이 저장한 배정을 보고 거절된다.
    private String assignable(Garden garden, String deviceId) {
        if (deviceRepository.lockById(deviceId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "장비를 찾을 수 없습니다.");
        }
        boolean servesOtherOwner = gardenRepository.findOwnerIdsByDeviceIdLatest(deviceId).stream()
                .anyMatch(ownerId -> !ownerId.equals(garden.getOwnerId()));
        if (servesOtherOwner) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "다른 고객의 정원을 맡고 있는 장비입니다.");
        }
        return deviceId;
    }

    private static String trimmed(String value) {
        return value == null ? "" : value.trim();
    }

    // 저장할 면적을 돌려준다. 테이블 칸이 DECIMAL(10,2)라 소수 둘째 자리로 맞춘 값이 0보다 커야 하고,
    // 정수 부분은 8자리까지다. 0.001처럼 맞추면 0이 되는 값은 여기서 거절한다(DB 검사에 걸려 서버 오류가 나지 않게).
    private static BigDecimal validArea(BigDecimal area) {
        BigDecimal scaled = area == null ? BigDecimal.ZERO : area.setScale(2, RoundingMode.HALF_UP);
        if (scaled.signum() <= 0 || scaled.precision() - scaled.scale() > 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "정원 면적은 0보다 커야 합니다.");
        }
        return scaled;
    }

    // 주인 계정 행을 잠근다. 계정이 없으면 404.
    // 같은 주인의 정원 등록·이름 변경이 한 번에 하나씩 처리되어, 이름 중복 확인과 저장 사이에 다른 요청이 끼어들지 못한다.
    // 정원 다음, 장비(assignable)보다 먼저 잠근다.
    private void lockOwner(Long ownerId) {
        if (userRepository.lockById(ownerId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "계정을 찾을 수 없습니다.");
        }
    }

    // lockOwner 로 주인을 잠근 뒤에 부른다.
    private void rejectDuplicateName(Garden garden) {
        // 아직 저장하지 않은 새 정원은 id가 없다.
        Long selfId = garden.getId() == null ? -1L : garden.getId();
        boolean duplicated = gardenRepository.findNamesInUseLatest(garden.getOwnerId(), selfId)
                .contains(garden.getName());
        if (duplicated) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이 고객에게 같은 이름의 정원이 있습니다.");
        }
    }
}
