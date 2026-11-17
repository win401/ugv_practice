package com.tbcrew.saemgil.user;

import java.time.LocalDate;
import java.util.Locale;

// API로 내보내는 사용자 정보. FE의 User 타입(FE/src/api/types.ts)과 같은 모양이다. 비밀번호 해시는 담지 않는다.
public record UserResponse(
        Long id,
        String role,
        String name,
        String email,
        String phone,
        LocalDate joined,
        String status) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getRole().name().toLowerCase(Locale.ROOT),
                user.getName(),
                user.getEmail(),
                user.getPhone(),
                user.getCreatedAt().toLocalDate(),
                user.getStatus().name().toLowerCase(Locale.ROOT));
    }
}
