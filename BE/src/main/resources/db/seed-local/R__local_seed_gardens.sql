-- 로컬 전용 시험 데이터. 실제 서버 연동을 로컬에서 시험할 때 쓴다.
-- application-local.yaml에서만 읽는다. 운영·테스트 DB에는 들어가지 않는다.
-- 시연 계정 파일(R__local_demo_users.sql) 다음에 실행된다(Flyway는 반복 실행 파일을 설명 이름순으로 실행한다).
-- 이메일·시리얼·주소·좌표·면적은 임의로 정한 예시 값이다.

-- 실제 서버용 시험 관리자. FE는 시연 계정(admin@saemgil.dev)을 가상 데이터로 보내므로 다른 이메일이 필요하다.
-- 비밀번호는 시연 관리자와 같다(해시를 그대로 복사한다).
INSERT IGNORE INTO users (email, password_hash, role, status, name, phone)
SELECT 'ops-admin@saemgil.dev', password_hash, 'ADMIN', 'ACTIVE', '시험 관리자', ''
FROM users
WHERE email = 'admin@saemgil.dev';

INSERT IGNORE INTO devices (id, serial, firmware, online, state, battery, water) VALUES
    ('ROVEN-01', 'RV-2611-0001', '1.4.2', TRUE, 'IDLE', 90, 80);

-- 운영자 정바람(wind.jung@example.com)의 정원 한 곳. 같은 이름의 정원이 없을 때만 넣는다.
INSERT INTO gardens (owner_id, name, address, flower, area, status, device_id,
                     center_lat, center_lng, boundary, geojson)
SELECT u.id, '원형 화단 북측 구역', '전라남도 순천시 국가정원1호길 47', '장미, 초화',
       4820.00, 'ACTIVE', 'ROVEN-01', 34.9292300, 127.4988900,
       '[{"kind":"M","points":[[127.49812,34.92965]]},{"kind":"L","points":[[127.49889,34.92990]]},{"kind":"Q","points":[[127.49980,34.92990],[127.49980,34.92920]]},{"kind":"L","points":[[127.49962,34.92858]]},{"kind":"L","points":[[127.49826,34.92855]]},{"kind":"Z","points":[]}]',
       '{"type":"Polygon","coordinates":[[[127.49812,34.92965],[127.49889,34.92990],[127.499288,34.929856],[127.499573,34.929725],[127.499743,34.929506],[127.49980,34.92920],[127.49962,34.92858],[127.49826,34.92855],[127.49812,34.92965]]]}'
FROM users u
WHERE u.email = 'wind.jung@example.com'
  AND NOT EXISTS (
      SELECT 1 FROM gardens g WHERE g.owner_id = u.id AND g.name = '원형 화단 북측 구역');
