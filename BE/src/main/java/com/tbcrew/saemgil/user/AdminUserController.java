package com.tbcrew.saemgil.user;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

// 관리자 전용 계정 관리. /api/admin/** 은 SecurityConfig에서 관리자만 통과한다.
// 응답에는 비밀번호와 해시를 담지 않는다.
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    public List<UserResponse> list() {
        return adminUserService.list().stream().map(UserResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@RequestBody CreateUserRequest request) {
        return UserResponse.from(adminUserService.create(request));
    }

    // 보낸 값만 고친다. name, phone, password(새 비밀번호), status
    @PatchMapping("/{id}")
    public UserResponse update(@PathVariable Long id, @RequestBody UpdateUserRequest request,
            @AuthenticationPrincipal Long currentUserId) {
        return UserResponse.from(adminUserService.update(id, request, currentUserId));
    }

    // 계정과 그 계정의 정원을 함께 지운다.
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Long currentUserId) {
        adminUserService.delete(id, currentUserId);
    }
}
