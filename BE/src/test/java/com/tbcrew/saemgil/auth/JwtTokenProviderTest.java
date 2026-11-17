package com.tbcrew.saemgil.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.junit.jupiter.api.Test;

// 스프링 없이 토큰 만들기·검증만 확인한다.
class JwtTokenProviderTest {

    private static final String SECRET = "test-only-jwt-secret-0123456789abcdef0123";

    private final JwtTokenProvider provider =
            new JwtTokenProvider(new AuthProperties(SECRET, Duration.ofHours(8), false));

    @Test
    void readsUserIdBack() {
        String token = provider.create(42L);

        assertThat(provider.parseUserId(token)).contains(42L);
    }

    @Test
    void rejectsTokenSignedWithOtherKey() {
        JwtTokenProvider other = new JwtTokenProvider(
                new AuthProperties("another-secret-key-0123456789abcdef0123", Duration.ofHours(8), false));

        assertThat(provider.parseUserId(other.create(42L))).isEmpty();
    }

    @Test
    void rejectsExpiredToken() {
        JwtTokenProvider expired = new JwtTokenProvider(new AuthProperties(SECRET, Duration.ofSeconds(-1), false));

        assertThat(provider.parseUserId(expired.create(42L))).isEmpty();
    }

    @Test
    void rejectsGarbage() {
        assertThat(provider.parseUserId("not-a-token")).isEmpty();
    }
}
