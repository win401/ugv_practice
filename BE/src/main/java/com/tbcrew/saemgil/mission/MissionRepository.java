package com.tbcrew.saemgil.mission;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MissionRepository extends JpaRepository<Mission, Long> {
    List<Mission> findByGardenIdOrderByIdAsc(Long gardenId);
}
