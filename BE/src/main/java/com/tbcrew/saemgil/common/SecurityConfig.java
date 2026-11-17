package com.tbcrew.saemgil.common;

import java.io.IOException;
import java.net.URI;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.tbcrew.saemgil.auth.AuthProperties;
import com.tbcrew.saemgil.auth.JwtAuthenticationFilter;
import com.tbcrew.saemgil.auth.JwtTokenProvider;
import com.tbcrew.saemgil.user.UserRepository;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.json.JsonMapper;

import lombok.RequiredArgsConstructor;

// 경로별 접근 규칙과 401·403 응답 형식. 요청은 컨트롤러에 닿기 전에 여기서 걸러진다.
@Configuration
@EnableConfigurationProperties(AuthProperties.class)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JsonMapper jsonMapper;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtTokenProvider tokenProvider,
            UserRepository userRepository) throws Exception {
        http
                // 로그인 상태는 서버 세션이 아니라 요청마다 오는 토큰(JWT 쿠키)으로 판단한다.
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // CSRF는 토큰 대신 쿠키의 SameSite=Lax와 같은 주소 호출(FE nginx 프록시)로 막는다.
                .csrf(AbstractHttpConfigurer::disable)
                // 화면은 FE가 그린다. Spring 기본 로그인 페이지·팝업·로그아웃 경로는 쓰지 않는다.
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        // 에러가 /error로 다시 전달될 때 막히면 원래 에러 대신 401이 나가므로 열어 둔다.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers("/health", "/health/db").permitAll()
                        .requestMatchers(HttpMethod.GET, "/devices/*/status").permitAll()
                        // 운영에서는 Swagger 자체가 꺼져 있어 404가 난다.
                        .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/logout").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        // 운영 화면 API. 관리자도 운영 화면에서 자기 정원과 고객의 정원을 본다.
                        .requestMatchers("/api/me/**").hasAnyRole("OPERATOR", "ADMIN")
                        .anyRequest().authenticated())
                // 규칙 검사 전에 로그인 쿠키를 읽어 누가 보낸 요청인지 정한다.
                .addFilterBefore(new JwtAuthenticationFilter(tokenProvider, userRepository),
                        UsernamePasswordAuthenticationFilter.class)
                // 기본 응답(빈 본문) 대신 다른 에러와 같은 ProblemDetail로 보낸다. FE는 detail을 그대로 보여 준다.
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, e) -> {
                            if (request.getAttribute(JwtAuthenticationFilter.SUSPENDED_ATTRIBUTE) != null) {
                                writeProblem(request, response, HttpStatus.FORBIDDEN, "정지된 계정입니다. 관리자에게 문의하세요.");
                            } else {
                                writeProblem(request, response, HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
                            }
                        })
                        .accessDeniedHandler((request, response, e) ->
                                writeProblem(request, response, HttpStatus.FORBIDDEN, "권한이 없습니다.")));
        return http.build();
    }

    // 비밀번호는 BCrypt 해시로만 저장하고 비교한다.
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    private void writeProblem(HttpServletRequest request, HttpServletResponse response,
            HttpStatus status, String detail) throws IOException {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setInstance(URI.create(request.getRequestURI()));
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        // 다른 에러 응답과 같게 charset 없이 보낸다. JSON은 바이트로 쓰면 항상 UTF-8이다.
        jsonMapper.writeValue(response.getOutputStream(), problem);
    }
}
