package com.tbcrew.saemgil.auth;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.tbcrew.saemgil.user.User;
import com.tbcrew.saemgil.user.UserResponse;

import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;

// 로그인·로그인 상태 확인·로그아웃. 토큰은 응답 본문이 아니라 HttpOnly 쿠키로만 보낸다.
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtTokenProvider tokenProvider;
    private final AuthCookies authCookies;

    @PostMapping("/login")
    public UserResponse login(@RequestBody LoginRequest request, HttpServletResponse response) {
        User user = authService.login(request.email(), request.password());
        authCookies.write(response, tokenProvider.create(user.getId()));
        return UserResponse.from(user);
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Long userId) {
        return UserResponse.from(authService.currentUser(userId));
    }

    // 로그인하지 않았거나 정지된 계정이어도 쿠키는 지울 수 있게 누구나 호출할 수 있다.
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletResponse response) {
        authCookies.clear(response);
    }
}
