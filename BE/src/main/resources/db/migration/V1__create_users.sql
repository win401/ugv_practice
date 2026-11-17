-- 로그인 계정. 관리자(개발자)와 운영자(정원주인)를 role로 구분한다.
-- 이메일 비교는 대소문자를 구분하지 않는다(utf8mb4_0900_ai_ci). 같은 이메일을 대소문자만 바꿔 두 번 가입할 수 없다.
CREATE TABLE users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    name          VARCHAR(50)  NOT NULL,
    phone         VARCHAR(20)  NOT NULL DEFAULT '',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email),
    CONSTRAINT ck_users_role CHECK (role IN ('ADMIN', 'OPERATOR')),
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'SUSPENDED'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
