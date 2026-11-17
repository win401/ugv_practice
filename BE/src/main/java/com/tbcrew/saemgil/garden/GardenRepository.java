package com.tbcrew.saemgil.garden;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface GardenRepository extends JpaRepository<Garden, Long> {

    // 이 장비가 맡은 정원
    List<Garden> findByDeviceId(String deviceId);

    List<Garden> findByOwnerId(Long ownerId);

    // 정원 행을 잠그고 최신 값을 읽는다. 잠금은 트랜잭션이 끝날 때 풀린다.
    // 같은 정원을 동시에 고치는 요청이 한 번에 하나씩 처리되어, 뒤 요청이 앞 요청의 저장 내용을 덮어쓰지 않는다.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from Garden g where g.id = :id")
    Optional<Garden> findByIdForUpdate(@Param("id") Long id);

    // 이 장비가 맡은 정원의 주인들. 장비 행을 잠근 뒤(DeviceRepository.lockById)에 부른다.
    // GardenService는 "방금 저장된 값까지 읽는" 설정(READ_COMMITTED)으로 실행하므로 다른 요청이 막 저장한 배정도 보인다.
    @Query(value = "SELECT owner_id FROM gardens WHERE device_id = :deviceId", nativeQuery = true)
    List<Long> findOwnerIdsByDeviceIdLatest(@Param("deviceId") String deviceId);

    // 이 주인이 쓰고 있는 정원 이름(비활성 제외, selfId 정원은 빼고).
    // 주인 계정 행을 잠근 뒤(UserRepository.lockById)에 부른다. 위와 같은 이유로 막 저장된 정원도 보인다.
    @Query(value = "SELECT name FROM gardens WHERE owner_id = :ownerId AND status <> 'INACTIVE' "
            + "AND id <> :selfId", nativeQuery = true)
    List<String> findNamesInUseLatest(@Param("ownerId") Long ownerId, @Param("selfId") Long selfId);
}
