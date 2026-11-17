-- 로컬 전용 시연 계정. FE 로그인 화면의 예시 계정과 같다(관리자 admin1234, 운영자 demo1234).
-- application-local.yaml에서만 읽는다. 운영·테스트 DB에는 들어가지 않는다.
-- 이 파일이 바뀌면 Flyway가 다시 실행하므로, 이미 있는 계정은 건너뛴다(INSERT IGNORE).

-- 예전 시연 관리자 이메일(samgil 오타)을 지운다. 이미 이 계정이 들어간 로컬 DB를 정리하기 위한 줄이다.
DELETE FROM users WHERE email = 'admin@samgil.dev';

INSERT IGNORE INTO users (email, password_hash, role, status, name, phone) VALUES
    ('admin@saemgil.dev', '$2y$10$2uedgKOrvSeCTpFSyppunOUIoRLASabQw.qG21q/aM0COA4IdKo3m', 'ADMIN', 'ACTIVE', '관리자', ''),
    ('garden.kim@example.com', '$2y$10$I1GgUhnM7UG.UY670zdGr.hwKYwellNg1IiDOYpsZrhGOIIPGrDka', 'OPERATOR', 'ACTIVE', '김정원', '010-0000-1001'),
    ('wind.jung@example.com', '$2y$10$I1GgUhnM7UG.UY670zdGr.hwKYwellNg1IiDOYpsZrhGOIIPGrDka', 'OPERATOR', 'ACTIVE', '정바람', '010-0000-1005'),
    ('field.choi@example.com', '$2y$10$I1GgUhnM7UG.UY670zdGr.hwKYwellNg1IiDOYpsZrhGOIIPGrDka', 'OPERATOR', 'SUSPENDED', '최들', '010-0000-1004');
