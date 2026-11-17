package com.tbcrew.saemgil.common;

import java.util.Map;

import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

// DB 연결 상태를 확인하는 API. DB에 못 붙으면 서버는 그대로 두고 503으로 알려 준다.
@RestController
@RequiredArgsConstructor
public class DbHealthController {

    private final JdbcTemplate jdbcTemplate;

    @GetMapping("/health/db")
    public ResponseEntity<Map<String, String>> db() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok(Map.of("db", "up"));
        } catch (DataAccessException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("db", "down"));
        }
    }
}
