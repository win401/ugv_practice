package com.tbcrew.saemgil.common;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.tbcrew.saemgil.WithSecurityConfig;

// 컨트롤러가 늘어도 이 테스트에 필요한 것만 띄우도록 대상을 정한다.
@WebMvcTest(DbHealthController.class)
@WithSecurityConfig
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JdbcTemplate jdbcTemplate;

    // 로그인하지 않으면 없는 주소도 401이 먼저 난다. 로그인한 상태에서 404 형식을 확인한다.
    @Test
    @WithMockUser
    void notFound() throws Exception {
        mockMvc.perform(get("/no-such-path"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType("application/problem+json"))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.title").value("Not Found"));
    }

    @Test
    void unexpectedError() throws Exception {
        given(jdbcTemplate.queryForObject("SELECT 1", Integer.class))
                .willThrow(new IllegalStateException("내부 정보"));

        mockMvc.perform(get("/health/db"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.detail").value("서버 오류가 발생했습니다."))
                .andExpect(content().string(not(containsString("내부 정보"))));
    }
}
