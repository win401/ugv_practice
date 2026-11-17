package com.tbcrew.saemgil.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

import com.tbcrew.saemgil.TestcontainersConfiguration;

// V1 테이블과 User 엔티티가 실제 MySQL에서 맞물리는지 확인한다. 각 테스트는 끝나면 되돌린다(@Transactional).
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@Transactional
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    void savesWithDefaults() {
        User saved = userRepository.saveAndFlush(
                new User("kim@example.com", "hash", UserRole.OPERATOR, "김정원", "010-0000-0000"));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    void findsEmailIgnoringCase() {
        userRepository.saveAndFlush(new User("kim@example.com", "hash", UserRole.OPERATOR, "김정원", ""));

        assertThat(userRepository.findByEmail("KIM@example.com")).isPresent();
    }

    @Test
    void rejectsDuplicateEmailIgnoringCase() {
        userRepository.saveAndFlush(new User("kim@example.com", "hash", UserRole.OPERATOR, "김정원", ""));

        assertThatThrownBy(() -> userRepository.saveAndFlush(
                new User("KIM@example.com", "hash", UserRole.OPERATOR, "다른 사람", "")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}