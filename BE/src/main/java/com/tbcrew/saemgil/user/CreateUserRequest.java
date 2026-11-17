package com.tbcrew.saemgil.user;

// 관리자가 계정을 추가할 때 보내는 값. role은 "admin" 또는 "operator"다.
public record CreateUserRequest(String email, String password, String role, String name, String phone) {
}
