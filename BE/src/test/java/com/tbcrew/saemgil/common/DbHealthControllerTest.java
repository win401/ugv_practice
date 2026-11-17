package com.tbcrew.saemgil.common;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.tbcrew.saemgil.WithSecurityConfig;

@WebMvcTest(DbHealthController.class)
@WithSecurityConfig
class DbHealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JdbcTemplate jdbcTemplate;

    @Test
    void dbUp() throws Exception {
        given(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).willReturn(1);

        mockMvc.perform(get("/health/db"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.db").value("up"));
    }

    @Test
    void dbDown() throws Exception {
        given(jdbcTemplate.queryForObject(eq("SELECT 1"), eq(Integer.class)))
                .willThrow(new DataAccessResourceFailureException("connection refused"));

        mockMvc.perform(get("/health/db"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.db").value("down"));
    }
}
