package com.tbcrew.saemgil.garden;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

import com.tbcrew.saemgil.TestcontainersConfiguration;
import com.tbcrew.saemgil.device.Device;
import com.tbcrew.saemgil.device.DeviceRepository;
import com.tbcrew.saemgil.device.DeviceState;
import com.tbcrew.saemgil.user.User;
import com.tbcrew.saemgil.user.UserRepository;
import com.tbcrew.saemgil.user.UserRole;

import jakarta.persistence.EntityManager;

// V2 테이블과 Garden·Device 엔티티가 실제 MySQL에서 맞물리는지 확인한다. 각 테스트는 끝나면 되돌린다(@Transactional).
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@Transactional
class GardenRepositoryTest {

    private static final String BOUNDARY = """
            [{"kind":"M","points":[[127.49812,34.92965]]},{"kind":"L","points":[[127.49889,34.9299]]},\
            {"kind":"L","points":[[127.49826,34.92855]]},{"kind":"Z","points":[]}]""";
    private static final String GEOJSON = """
            {"type":"Polygon","coordinates":[[[127.49812,34.92965],[127.49889,34.9299],\
            [127.49826,34.92855],[127.49812,34.92965]]]}""";

    @Autowired
    private GardenRepository gardenRepository;
    @Autowired
    private DeviceRepository deviceRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private EntityManager entityManager;

    @Test
    void savesGardenWithDeviceAndReadsItBack() {
        Long ownerId = owner().getId();
        deviceRepository.saveAndFlush(new Device("ROVEN-01", "RV-TEST-0001", "1.0.0"));
        Garden saved = gardenRepository.saveAndFlush(garden(ownerId, "4820.00", "ROVEN-01"));
        // DB가 채우는 값(등록일)까지 보려면 캐시를 비우고 다시 읽는다.
        entityManager.clear();

        Garden found = gardenRepository.findById(saved.getId()).orElseThrow();
        assertThat(found.getStatus()).isEqualTo(GardenStatus.ACTIVE);
        assertThat(found.getArea()).isEqualByComparingTo("4820.00");
        assertThat(found.getCenterLat()).isEqualByComparingTo("34.9292300");
        assertThat(found.getBoundary()).contains("\"kind\"");
        assertThat(found.getGeojson()).contains("Polygon");
        assertThat(found.getCreatedAt()).isNotNull();

        Device device = deviceRepository.findById("ROVEN-01").orElseThrow();
        assertThat(device.getState()).isEqualTo(DeviceState.IDLE);
        assertThat(device.isOnline()).isFalse();
        assertThat(device.getBattery()).isEqualTo(100);
        assertThat(device.getCreatedAt()).isNotNull();
    }

    @Test
    void rejectsAreaOfZero() {
        Long ownerId = owner().getId();

        assertThatThrownBy(() -> gardenRepository.saveAndFlush(garden(ownerId, "0", null)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsUnknownDevice() {
        Long ownerId = owner().getId();

        assertThatThrownBy(() -> gardenRepository.saveAndFlush(garden(ownerId, "100", "ROVEN-99")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsDuplicateSerial() {
        deviceRepository.saveAndFlush(new Device("ROVEN-01", "RV-TEST-0001", "1.0.0"));

        assertThatThrownBy(() -> deviceRepository.saveAndFlush(new Device("ROVEN-02", "RV-TEST-0001", "1.0.0")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private User owner() {
        return userRepository.saveAndFlush(new User("wind@example.com", "hash", UserRole.OPERATOR, "정바람", ""));
    }

    private Garden garden(Long ownerId, String area, String deviceId) {
        return new Garden(ownerId, "원형 화단 북측 구역", "전라남도 순천시 국가정원1호길 47", "장미, 초화",
                new BigDecimal(area), deviceId, new BigDecimal("34.9292300"), new BigDecimal("127.4988900"),
                BOUNDARY, GEOJSON);
    }
}
