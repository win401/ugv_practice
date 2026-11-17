package com.tbcrew.saemgil.user;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

    // 컬럼 정렬 규칙(ai_ci) 덕분에 대소문자를 구분하지 않고 찾는다.
    Optional<User> findByEmail(String email);

    // 계정 행을 잠그고 그 계정이 있는지 알려 준다. 잠금은 트랜잭션이 끝날 때 풀린다.
    // 같은 주인의 정원을 동시에 등록하거나 이름을 바꾸는 요청이 한 번에 하나씩 처리되게 하려고 쓴다.
    @Query(value = "SELECT id FROM users WHERE id = :id FOR UPDATE", nativeQuery = true)
    Optional<Long> lockById(@Param("id") Long id);
}
