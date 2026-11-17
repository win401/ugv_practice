package com.tbcrew.saemgil.dashboard;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

// 운영 화면용 API. /api/me/** 은 SecurityConfig에서 운영자와 관리자가 통과한다.
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    // customerId는 관리자가 다른 계정의 화면을 볼 때만 쓴다. 운영자가 보내면 무시한다.
    @GetMapping("/dashboard")
    public DashboardResponse dashboard(@AuthenticationPrincipal Long userId,
            @RequestParam(required = false) Long customerId) {
        return dashboardService.dashboard(userId, customerId);
    }
}
