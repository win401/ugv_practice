CREATE TABLE missions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    garden_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    points JSON NOT NULL,
    end_policy VARCHAR(10) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_missions_garden (garden_id),
    CONSTRAINT fk_missions_garden FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE,
    CONSTRAINT ck_missions_end_policy CHECK (end_policy IS NULL OR end_policy IN ('stay', 'return'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
