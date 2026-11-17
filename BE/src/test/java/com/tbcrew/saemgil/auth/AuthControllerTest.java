package com.tbcrew.saemgil.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import com.tbcrew.saemgil.TestcontainersConfiguration;
import com.tbcrew.saemgil.user.User;
import com.tbcrew.saemgil.user.UserRepository;
import com.tbcrew.saemgil.user.UserRole;

import jakarta.servlet.http.Cookie;

// 실제 MySQL에 계정을 만들고 로그인 → 쿠키 → me → 로그아웃 흐름을 확인한다.
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {

    private static final String PASSWORD = "demo1234";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        userRepository.save(new User("kim@example.com", passwordEncoder.encode(PASSWORD), UserRole.OPERATOR, "김정원", "010-0000-1001"));
        userRepository.save(new User("admin@example.com", passwordEncoder.encode(PASSWORD), UserRole.ADMIN, "관리자", ""));
    }

    @Test
    void loginSetsHttpOnlyCookie() throws Exception {
        mockMvc.perform(login("kim@example.com", PASSWORD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("operator"))
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.email").value("kim@example.com"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(header().string("Set-Cookie", containsString(AuthCookies.NAME + "=")))
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
                .andExpect(header().string("Set-Cookie", containsString("SameSite=Lax")))
                .andExpect(header().string("Set-Cookie", containsString("Path=/api")));
    }

    @Test
    void wrongPasswordAndUnknownEmailLookTheSame() throws Exception {
        mockMvc.perform(login("kim@example.com", "wrong"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("이메일 또는 비밀번호가 맞지 않습니다."));
        mockMvc.perform(login("nobody@example.com", PASSWORD))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("이메일 또는 비밀번호가 맞지 않습니다."));
    }

    @Test
    void suspendedAccountCannotLogin() throws Exception {
        suspend("kim@example.com");

        mockMvc.perform(login("kim@example.com", PASSWORD))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("정지된 계정입니다. 관리자에게 문의하세요."));
    }

    @Test
    void meWithCookie() throws Exception {
        Cookie cookie = loginCookie("kim@example.com");

        mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("김정원"));
    }

    @Test
    void meWithoutCookie() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("로그인이 필요합니다."));
    }

    // 로그인한 뒤 관리자가 정지하면, 토큰이 남아 있어도 다음 요청부터 막힌다.
    @Test
    void suspensionAppliesImmediately() throws Exception {
        Cookie cookie = loginCookie("kim@example.com");
        suspend("kim@example.com");

        mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("정지된 계정입니다. 관리자에게 문의하세요."));
    }

    @Test
    void operatorCannotUseAdminApi() throws Exception {
        Cookie cookie = loginCookie("kim@example.com");

        mockMvc.perform(get("/api/admin/customers").cookie(cookie))
                .andExpect(status().isForbidden());
    }

    @Test
    void logoutClearsCookie() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
    }

    private Cookie loginCookie(String email) throws Exception {
        Cookie cookie = mockMvc.perform(login(email, PASSWORD))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie(AuthCookies.NAME);
        assertThat(cookie).isNotNull();
        return cookie;
    }

    private void suspend(String email) {
        jdbcTemplate.update("UPDATE users SET status = 'SUSPENDED' WHERE email = ?", email);
    }

    private static org.springframework.test.web.servlet.RequestBuilder login(String email, String password) {
        return post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }
}
