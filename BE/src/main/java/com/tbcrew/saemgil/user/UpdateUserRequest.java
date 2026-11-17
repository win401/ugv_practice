package com.tbcrew.saemgil.user;

// 관리자가 계정을 고칠 때 보내는 값. 보내지 않은(null) 항목은 그대로 둔다.
// status는 "active" 또는 "suspended", password는 새 비밀번호다.
public record UpdateUserRequest(String status, String name, String phone, String password) {
}
