package com.tbcrew.saemgil.auth;

import java.io.IOException;
import java.util.List;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.tbcrew.saemgil.user.UserRepository;
import com.tbcrew.saemgil.user.UserStatus;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;

// 요청마다 로그인 쿠키의 토큰을 확인하고, DB에서 사용자를 다시 읽어 역할과 정지 여부를 바로 반영한다.
// 토큰이 없거나 잘못됐으면 아무것도 하지 않는다. 그 뒤 SecurityConfig 규칙이 401·403을 정한다.
// 서블릿 필터로 자동 등록되지 않도록 @Component를 붙이지 않고 SecurityConfig에서 만든다.
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    // 정지된 계정이면 401 대신 403 "정지된 계정"으로 응답하도록 표시해 둔다.
    public static final String SUSPENDED_ATTRIBUTE = JwtAuthenticationFilter.class.getName() + ".suspended";

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        AuthCookies.read(request)
                .flatMap(tokenProvider::parseUserId)
                .flatMap(userRepository::findById)
                .ifPresent(user -> {
                    if (user.getStatus() != UserStatus.ACTIVE) {
                        request.setAttribute(SUSPENDED_ATTRIBUTE, true);
                        return;
                    }
                    // principal은 사용자 id다. 컨트롤러에서 @AuthenticationPrincipal Long userId로 받는다.
                    var authentication = UsernamePasswordAuthenticationToken.authenticated(
                            user.getId(), null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                });
        chain.doFilter(request, response);
    }
}
