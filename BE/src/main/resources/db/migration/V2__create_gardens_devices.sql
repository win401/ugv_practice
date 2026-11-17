-- 장비(ROVEN). 번호(ROVEN-01)는 서버가 붙인다.
-- 연결 여부·상태·배터리·물은 장비 연동 전까지 관리자가 넣는 값이다. 장비 연동 때 다시 정한다.
CREATE TABLE devices (
    id               VARCHAR(20)  NOT NULL,
    serial           VARCHAR(50)  NOT NULL,
    firmware         VARCHAR(30)  NOT NULL,
    online           BOOLEAN      NOT NULL DEFAULT FALSE,
    state            VARCHAR(20)  NOT NULL DEFAULT 'IDLE',
    battery          TINYINT      NOT NULL DEFAULT 100,
    water            TINYINT      NOT NULL DEFAULT 0,
    last_seen_at     DATETIME     NULL,
    active_garden_id BIGINT       NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_devices_serial (serial),
    CONSTRAINT ck_devices_state CHECK (state IN ('IDLE', 'WORKING', 'CHARGING', 'FAULT')),
    CONSTRAINT ck_devices_battery CHECK (battery BETWEEN 0 AND 100),
    CONSTRAINT ck_devices_water CHECK (water BETWEEN 0 AND 100)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 정원. 위치와 경계는 위경도로 저장한다. 좌표 순서는 [경도, 위도]다.
-- boundary: 화면에서 그린 원본(직선·곡선 명령). 다시 편집할 때 쓴다.
-- geojson: 곡선을 짧은 직선으로 나눈 Polygon. 지도 표시와 장비 전달에 쓴다.
CREATE TABLE gardens (
    id          BIGINT        NOT NULL AUTO_INCREMENT,
    owner_id    BIGINT        NOT NULL,
    name        VARCHAR(100)  NOT NULL,
    address     VARCHAR(200)  NOT NULL DEFAULT '',
    flower      VARCHAR(200)  NOT NULL DEFAULT '',
    area        DECIMAL(10,2) NOT NULL,
    status      VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    device_id   VARCHAR(20)   NULL,
    center_lat  DECIMAL(10,7) NOT NULL,
    center_lng  DECIMAL(10,7) NOT NULL,
    boundary    JSON          NOT NULL,
    geojson     JSON          NOT NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_gardens_owner (owner_id),
    CONSTRAINT fk_gardens_owner FOREIGN KEY (owner_id) REFERENCES users (id),
    CONSTRAINT fk_gardens_device FOREIGN KEY (device_id) REFERENCES devices (id),
    CONSTRAINT ck_gardens_status CHECK (status IN ('ACTIVE', 'PENDING', 'INACTIVE')),
    CONSTRAINT ck_gardens_area CHECK (area > 0),
    CONSTRAINT ck_gardens_lat CHECK (center_lat BETWEEN -90 AND 90),
    CONSTRAINT ck_gardens_lng CHECK (center_lng BETWEEN -180 AND 180)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- 두 테이블이 서로를 가리켜서 마지막에 연결한다.
ALTER TABLE devices
    ADD CONSTRAINT fk_devices_active_garden
    FOREIGN KEY (active_garden_id) REFERENCES gardens (id);
