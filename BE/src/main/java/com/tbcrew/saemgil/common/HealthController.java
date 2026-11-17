package com.tbcrew.saemgil.common;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// 서버가 떠 있는지 확인하는 API. DB 등 외부 의존성 없이 항상 응답한다.
@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
