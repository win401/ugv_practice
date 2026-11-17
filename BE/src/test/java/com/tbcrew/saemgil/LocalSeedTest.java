package com.tbcrew.saemgil;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import com.tbcrew.saemgil.device.DeviceRepository;
import com.tbcrew.saemgil.garden.Garden;
import com.tbcrew.saemgil.garden.GardenRepository;
import com.tbcrew.saemgil.user.User;
import com.tbcrew.saemgil.user.UserRepository;
import com.tbcrew.saemgil.user.UserRole;

// 로컬 전용 시험 데이터(db/seed-local)가 빈 DB에 오류 없이 들어가는지 확인한다.
// 로컬 설정과 같은 위치를 읽도록 Flyway 위치만 바꾼다. 테스트용 MySQL은 따로 뜬다.
@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "spring.flyway.locations=classpath:db/migration,classpath:db/seed-local")
class LocalSeedTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private DeviceRepository deviceRepository;
    @Autowired
    private GardenRepository gardenRepository;

    @Test
    void seedsTestAdminDeviceAndGarden() {
        User admin = userRepository.findByEmail("ops-admin@saemgil.dev").orElseThrow();
        User owner = userRepository.findByEmail("wind.jung@example.com").orElseThrow();
        assertThat(admin.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(deviceRepository.findById("ROVEN-01")).isPresent();

        assertThat(gardenRepository.findAll()).singleElement().satisfies((Garden garden) -> {
            assertThat(garden.getOwnerId()).isEqualTo(owner.getId());
            assertThat(garden.getDeviceId()).isEqualTo("ROVEN-01");
            assertThat(garden.getGeojson()).contains("Polygon");
        });
    }
}
