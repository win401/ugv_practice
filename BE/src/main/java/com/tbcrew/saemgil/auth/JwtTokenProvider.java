package com.tbcrew.saemgil.auth;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Component;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

// 로그인 토큰(JWT)을 만들고 검증한다. 토큰에는 사용자 id만 담는다. 역할·정지 여부는 요청마다 DB에서 읽는다.
@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final Duration validity;

    public JwtTokenProvider(AuthProperties properties) {
        // 키가 32바이트보다 짧으면 여기서 예외가 나서 서버가 시작하지 않는다.
        this.key = Keys.hmacShaKeyFor(properties.jwtSecret().getBytes(StandardCharsets.UTF_8));
        this.validity = properties.tokenValidity();
    }

    public String create(Long userId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(validity)))
                .signWith(key)
                .compact();
    }

    // 서명이 틀리거나 만료됐거나 형식이 이상하면 비어 있는 값을 돌려준다(= 로그인 안 한 것으로 본다).
    public Optional<Long> parseUserId(String token) {
        try {
            String subject = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token)
                    .getPayload()
                    .getSubject();
            return Optional.of(Long.valueOf(subject));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
