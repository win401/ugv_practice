package com.tbcrew.saemgil.auth;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

// application.yaml의 app.auth 값. 비밀키는 로컬 .env, 운영 Secret Manager에서 들어온다.
@ConfigurationProperties("app.auth")
public record AuthProperties(String jwtSecret, Duration tokenValidity, boolean cookieSecure) {
}
