package com.tbcrew.saemgil.auth;

import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;

// 로그인 토큰을 담는 쿠키. JS에서 읽을 수 없고(HttpOnly), 다른 사이트에서 보낸 요청에는 붙지 않으며(SameSite=Lax),
// API 요청(/api)에만 붙는다.
@Component
@RequiredArgsConstructor
public class AuthCookies {

    public static final String NAME = "saemgil_token";
    private static final String PATH = "/api";

    private final AuthProperties properties;

    public void write(HttpServletResponse response, String token) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(token, properties.tokenValidity()).toString());
    }

    // 같은 이름·경로로 만료된 쿠키를 보내 브라우저에서 지운다.
    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString());
    }

    public static Optional<String> read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        return Arrays.stream(cookies)
                .filter(cookie -> NAME.equals(cookie.getName()))
                .map(Cookie::getValue)
                .filter(value -> !value.isBlank())
                .findFirst();
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(properties.cookieSecure())
                .sameSite("Lax")
                .path(PATH)
                .maxAge(maxAge)
                .build();
    }
}
