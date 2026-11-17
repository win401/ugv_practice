package com.tbcrew.saemgil.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.tbcrew.saemgil.WithSecurityConfig;

// 경로별 접근 규칙과 401·403 응답 형식을 확인한다. 로그인 상태는 @WithMockUser로 흉내 낸다.
@WebMvcTest(HealthController.class)
@WithSecurityConfig
class SecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void publicPathWithoutLogin() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk());
    }

    @Test
    void loginRequired() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentType("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("로그인이 필요합니다."))
                .andExpect(jsonPath("$.instance").value("/api/auth/me"));
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void operatorCannotUseAdminApi() throws Exception {
        mockMvc.perform(get("/api/admin/customers"))
                .andExpect(status().isForbidden())
                .andExpect(content().contentType("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("권한이 없습니다."));
    }

    // 운영 화면 API는 로그인해야 쓸 수 있다. 운영자와 관리자 모두 통과하는 것은 AdminApiTest에서 실제 로그인으로 확인한다.
    @Test
    void operatorApiNeedsLogin() throws Exception {
        mockMvc.perform(get("/api/me/dashboard"))
                .andExpect(status().isUnauthorized());
    }

    // 규칙은 통과하고, 아직 컨트롤러가 없어서 404가 난다.
    @Test
    @WithMockUser(roles = "ADMIN")
    void adminPassesAdminRule() throws Exception {
        mockMvc.perform(get("/api/admin/customers"))
                .andExpect(status().isNotFound());
    }
}
