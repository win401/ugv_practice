package com.tbcrew.saemgil.user;

import java.time.LocalDateTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// users 테이블의 한 행. 비밀번호는 해시만 들고 있고, API 응답에는 이 엔티티를 그대로 내보내지 않는다.
@Entity
@Table(name = "users")
@Getter
// JPA가 DB에서 읽어 올 때 쓰는 빈 생성자. 코드에서는 쓰지 못하게 막아 둔다.
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    // MySQL에서 Hibernate는 enum을 DB의 ENUM 타입으로 기대한다. 테이블은 VARCHAR라 맞춰 준다.
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false)
    private UserRole role;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false)
    private UserStatus status;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String phone;

    // 값은 DB 기본값(CURRENT_TIMESTAMP)이 채운다.
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public User(String email, String passwordHash, UserRole role, String name, String phone) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.status = UserStatus.ACTIVE;
        this.name = name;
        this.phone = phone;
    }

    // 정지하거나 정지를 푼다. 정지된 계정은 로그인과 모든 API가 거절된다.
    public void changeStatus(UserStatus status) {
        this.status = status;
    }

    public void rename(String name) {
        this.name = name;
    }

    public void changePhone(String phone) {
        this.phone = phone;
    }

    public void changePasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }
}
