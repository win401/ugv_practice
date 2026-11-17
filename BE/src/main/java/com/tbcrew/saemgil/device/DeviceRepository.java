package com.tbcrew.saemgil.device;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DeviceRepository extends JpaRepository<Device, String> {

    boolean existsBySerial(String serial);

    // 이 정원에서 작업 중인 장비
    List<Device> findByActiveGardenId(Long activeGardenId);

    // 장비 행을 잠그고 그 장비가 있는지 알려 준다. 잠금은 트랜잭션이 끝날 때 풀린다.
    // 같은 장비를 동시에 배정하는 요청이 한 번에 하나씩 처리되게 하려고 쓴다.
    @Query(value = "SELECT id FROM devices WHERE id = :id FOR UPDATE", nativeQuery = true)
    Optional<String> lockById(@Param("id") String id);
}
