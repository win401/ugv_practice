# 백엔드

Java 17 · Spring Boot 4.1 · Gradle 기반 API 영역이다. 데이터베이스는 MySQL 8.4(운영: Cloud SQL)를 사용한다.

## 시작하기

명령은 **`BE` 폴더에서** 실행한다(`gradlew`가 이 폴더에 있다). 준비물은 두 가지다.

- **JDK 17 이상**: Gradle을 실행하는 데 필요하다. `java -version`으로 확인한다.
- **Docker Desktop**: 설치 후 앱을 한 번 실행해 엔진이 켜진 상태(Engine running)로 둔다.

Windows는 PowerShell에서 설치할 수 있다(브라우저 다운로드가 막힐 때도 쓸 수 있다). 설치 후에는 **터미널(IDE 포함)을 새로 연다.**

```powershell
winget install -e --id EclipseAdoptium.Temurin.17.JDK
winget install -e --id Docker.DockerDesktop
```

그 밖에는 설치할 것이 없다.

- Gradle: Wrapper(`gradlew`)가 정해진 버전을 받아 쓴다. 컴파일용 JDK 17이 없으면(예: JDK 21만 있음) 자동으로 내려받는다.
- `.env`: 없어도 된다. 로컬 전용 기본값으로 실행된다. 값을 바꾸고 싶을 때만 `.env.example`을 참고해 `.env`를 만든다.

macOS / Linux:

```bash
cd BE
./gradlew bootRun   # http://localhost:8080 (local 프로필)
./gradlew test      # 테스트 (Docker로 MySQL 8.4를 잠깐 띄워 실행)
```

Windows (PowerShell):

```powershell
cd BE
.\gradlew.bat bootRun
.\gradlew.bat test
```

`bootRun`이 `compose.yaml`의 MySQL 8.4 컨테이너(DB `saemgil`, 사용자 `app_user`, 포트 `127.0.0.1:3307`)를 자동으로 띄우고, 접속 정보도 컨테이너에서 읽는다(spring-boot-docker-compose). 따로 `docker compose up`을 하지 않아도 된다. 로컬 시연 계정(관리자 `admin@saemgil.dev` / `admin1234`)과 [로컬 시험 데이터](#로컬-시험-데이터)도 함께 들어간다.

- 서버를 끄면 bootRun이 띄운 컨테이너도 멈춘다(데이터는 남는다). DB만 계속 켜 두려면 `docker compose up -d`로 먼저 띄운다.
- 이미 떠 있는 컨테이너는 bootRun이 다시 만들지 않는다. `compose.yaml`이 바뀌었으면(포트 등) `docker compose up -d`를 한 번 실행한다.
- DB 도구(Workbench, DBeaver 등)로 볼 때는 `127.0.0.1:3307`, `app_user`, 비밀번호 `saemgil-local`(`.env`에서 바꿨다면 그 값)로 접속한다. 이 PC에서만 접속할 수 있다.
- `docker compose down -v`는 로컬 데이터까지 지운다.

### 서버를 끄지 않고 코드 반영하기

`bootRun`에는 Spring Boot DevTools가 들어 있어서, 서버가 켜진 채로 코드가 다시 컴파일되면 몇 초 안에 스스로 재시작한다. 로그인 쿠키는 그대로라 다시 로그인하지 않아도 된다.

저장할 때마다 컴파일되도록 터미널을 하나 더 열어 아래를 켜 둔다. VS Code의 Java 확장이 하는 자동 컴파일은 다른 폴더(`bin`)에 결과를 써서 재시작이 일어나지 않는다.

```powershell
cd BE
.\gradlew.bat classes --continuous   # macOS / Linux: ./gradlew classes --continuous
```

- `application*.yaml`, `db/migration`처럼 `src/main/resources` 아래 파일도 같은 방식으로 반영된다.
- `build.gradle`의 의존성이 바뀌었거나 재시작 뒤 오류가 이어지면 `bootRun`을 껐다 다시 켠다.
- DevTools는 로컬 `bootRun`에서만 쓴다. 배포용 jar와 테스트에는 들어가지 않는다.

| 요청 | 정상 응답 | 의미 |
| --- | --- | --- |
| `GET /health` | `200 {"status":"ok"}` | 서버가 떠 있다. DB 상태와 관계없다. |
| `GET /health/db` | `200 {"db":"up"}` | DB에 연결된다. 연결되지 않으면 `503 {"db":"down"}` |

API 목록과 시험 화면은 <http://localhost:8080/swagger-ui.html>(Swagger)에서 본다. 문서 JSON은 `/v3/api-docs`다. 운영(`prod` 프로필)에서는 둘 다 꺼져 있다.

서버가 시작할 때 Flyway가 DB에 접속한다. 실행 중에 DB가 끊기면 `/health/db`가 `503`을 돌려주고, DB가 돌아오면 재시작 없이 `up`이 된다.

Docker 이미지로 확인하려면 다음을 실행한다.

```bash
docker build -t saemgil-api:local .
docker run --rm -p 8080:8080 \
  -e SPRING_DATASOURCE_URL=jdbc:mysql://host.docker.internal:3307/saemgil \
  saemgil-api:local   # 컨테이너 안에서 로컬 MySQL에 접속 (MySQL 컨테이너를 먼저 켠다). .env 값을 바꿨다면 --env-file .env 추가
```

### 문제 해결

| 증상 | 원인과 해결 |
| --- | --- |
| `Access denied for user 'app_user'` | MySQL은 볼륨을 **처음 만들 때만** 비밀번호를 정한다. 볼륨을 만든 뒤 비밀번호(`.env` 또는 기본값)가 바뀌었다는 뜻이다. 처음 만들 때 쓴 비밀번호를 `.env`에 다시 넣거나, `docker compose down -v`로 볼륨을 지우고 다시 실행한다(로컬 데이터 삭제, 테이블과 시연 계정은 다시 만들어진다). |
| `port is already allocated`, 3307 포트 충돌 | 다른 프로그램이 3307을 쓰고 있다. `netstat -ano \| findstr :3307`(Windows) / `lsof -i :3307`(macOS)로 확인하고 `.env`의 `SAEMGIL_DB_PORT`를 다른 값으로 바꾼다. |
| Docker 관련 오류로 시작하지 않음 | Docker Desktop이 켜져 있는지 확인한다. `docker version`에 `Server:`가 나와야 한다. |
| `Cannot run program "docker"` | Docker를 설치하기 전에 연 터미널이나 Gradle 백그라운드 프로세스가 예전 PATH를 쓰고 있다. 터미널(IDE)을 새로 열고 `.\gradlew.bat --stop`(macOS: `./gradlew --stop`) 후 다시 실행한다. 그래도 안 되면 로그아웃 후 다시 로그인한다. |
| `JAVA_HOME is not set`, `Gradle requires JVM 17 or later` | JDK 17 이상이 없다. 위 설치 명령으로 설치하고 터미널을 새로 연다. |
| `'.\gradlew.bat' ... 인식되지 않습니다` | `BE` 폴더가 아닌 곳에서 실행했다. `cd BE` 후 실행한다. |
| `WeakKeyException`, 서명 키 오류로 시작하지 않음 | `.env`의 `SAEMGIL_JWT_SECRET`이 비어 있거나 32바이트보다 짧다. 줄을 지우거나(기본값 사용) 긴 값을 넣는다. |
| `No matching toolchains found` | 컴파일용 JDK 17 자동 설치가 막힌 환경(회사 프록시 등)이다. JDK 17을 직접 설치한다. |

로컬 변수에는 `SAEMGIL_` 접두어를 붙인다(운영은 Cloud Run이 `DB_PASSWORD`, `JWT_SECRET`으로 넣는다). `DB_PASSWORD`, `JWT_SECRET`처럼 흔한 이름은 개발 PC의 OS 환경변수와 겹치면 `.env`보다 OS 값이 우선해(Spring, Docker Compose 모두) 엉뚱한 비밀번호로 접속하게 된다.

## 설정 프로필

| 프로필 | 파일 | 쓰는 곳 | DB |
| --- | --- | --- | --- |
| `local` (기본) | `application-local.yaml` | 로컬 `bootRun` | `compose.yaml`의 MySQL(bootRun이 자동 실행). 값은 `.env` 또는 로컬 기본값. 시연 계정(`db/seed-local`)도 넣는다 |
| `prod` | `application-prod.yaml` | Cloud Run | Cloud SQL 커넥터. 값은 배포 설정과 Secret Manager에서 주입 |
| `test` | `src/test/resources/application-test.yaml` (`build.gradle`에서 지정) | `./gradlew test`, CI | Testcontainers가 띄우는 MySQL 8.4 |

## 테이블 변경 (Flyway)

테이블은 Flyway가 `src/main/resources/db/migration`의 SQL 파일로 만든다. 서버가 시작할 때 아직 적용하지 않은 파일만 버전 순서대로 실행하고, 적용 기록은 DB의 `flyway_schema_history` 테이블에 남는다. 로컬·운영·테스트 모두 같은 방식이다.

- 파일 이름은 `V<번호>__<설명>.sql`이다. 예: `V1__create_garden.sql` (밑줄 두 개)
- 한 번 적용된 파일은 고치거나 지우지 않는다. 바꿀 내용은 다음 번호의 새 파일로 추가한다.
- Hibernate는 테이블을 만들지 않고 엔티티와 테이블이 맞는지만 검사한다(`ddl-auto: validate`). 맞지 않으면 서버가 시작하지 않는다.
- 운영에서 SQL이 실패하면 새 버전이 시작하지 않고 이전 버전이 계속 서비스된다.
- 시간대는 DB(Cloud SQL `default_time_zone=+09:00`, 로컬 `TZ`)와 서버(`user.timezone`, Hibernate `jdbc.time_zone`), JSON 응답(Jackson `time-zone`) 모두 한국 시간(KST)이다.

### 테이블

| 파일 | 테이블 | 내용 |
| --- | --- | --- |
| `V1__create_users.sql` | `users` | 로그인 계정. 역할은 `ADMIN`(관리자)·`OPERATOR`(운영자), 상태는 `ACTIVE`·`SUSPENDED` |
| `V2__create_gardens_devices.sql` | `devices` | 장비(ROVEN). 번호(`ROVEN-01`)는 서버가 붙인다. 연결 여부·상태·배터리·물은 장비 연동 전까지 관리자가 넣는 값이다 |
| `V2__create_gardens_devices.sql` | `gardens` | 정원. 주인(`owner_id` → `users`), 배정 장비(`device_id` → `devices`), 위경도 중심과 경계 |

정원의 위치와 경계는 위경도(WGS84)로 저장한다. 좌표 순서는 `[경도, 위도]`다.

- `center_lat`, `center_lng`: 경계의 중심.
- `boundary`(JSON): 화면에서 그린 경계 원본. 명령 목록이며 `M` 시작, `L` 직선, `Q`·`C` 곡선, `Z` 닫기다. 다시 편집할 때 쓴다.
- `geojson`(JSON): 곡선을 짧은 직선으로 나눈 GeoJSON `Polygon`. 지도 표시와 장비 전달에 쓴다. 곡선을 나누는 계산은 화면이 하고, 서버는 형식·닫힘·점 개수·좌표 범위만 검사한다.

지역, 최근 작업, 실패 횟수는 저장하지 않는다. 지역은 화면이 주소 앞 두 마디로 만든다.

### 로컬 시험 데이터

`src/main/resources/db/seed-local`의 파일은 `local` 프로필에서만 실행된다. 운영·테스트 DB에는 들어가지 않는다.

| 파일 | 넣는 것 |
| --- | --- |
| `R__local_demo_users.sql` | 계정 4개: `admin@saemgil.dev`(관리자), `garden.kim@example.com`·`wind.jung@example.com`(운영자), `field.choi@example.com`(정지된 운영자) |
| `R__local_seed_gardens.sql` | 시험 관리자 `ops-admin@saemgil.dev`(비밀번호는 `admin@saemgil.dev`와 같다), 장비 `ROVEN-01`, `wind.jung@example.com`의 정원 1곳 |

FE는 `admin@saemgil.dev`와 `garden.kim@example.com`을 브라우저의 가상 데이터로 보낸다(시연 계정). 그래서 화면에서 실제 서버 연동을 시험할 때는 `ops-admin@saemgil.dev`(관리자) 또는 `wind.jung@example.com`(운영자, `demo1234`)으로 로그인한다. 이메일·시리얼·주소·좌표는 임의로 정한 예시 값이다.

## API 응답 규칙

- 성공하면 데이터를 감싸지 않고 그대로 보낸다. 목록은 배열, 하나는 객체다. 성공·실패는 HTTP 상태 코드로 구분한다.
- 날짜·시간은 ISO 형식 한국 시간으로 보낸다. 예: `"2026-11-04T09:20:00"`. 화면 표시 형식(`2026.11.04`, `09:20`)은 프론트엔드에서 바꾼다.
- 필드 이름은 camelCase다.
- 에러는 표준 형식(ProblemDetail, `Content-Type: application/problem+json`)으로 보낸다. 화면에는 `detail`을 보여 준다.

```json
{ "status": 404, "title": "Not Found", "detail": "구역을 찾을 수 없습니다.", "instance": "/zones/9" }
```

- 의도한 에러는 `throw new ResponseStatusException(HttpStatus.NOT_FOUND, "구역을 찾을 수 없습니다.")`처럼 낸다.
- 처리하지 못한 예외는 `GlobalExceptionHandler`가 내부 내용을 숨기고 `500 "서버 오류가 발생했습니다."`로 응답한다. 원인은 서버 로그에 남는다.
- 요청 값 검사(`@Valid`)에 걸리면 `400`이고, 검사 규칙에 적은 `message`가 `detail`에 담긴다. 여러 값이 걸려도 하나만 보낸다.

## 코드 규칙

- **Lombok**: getter와 생성자를 직접 쓰지 않는다.
  - 엔티티는 `@Getter`와 `@NoArgsConstructor(access = AccessLevel.PROTECTED)`만 붙인다. `@Setter`, `@Data`는 쓰지 않는다. 값은 `changeArea()`처럼 뜻이 드러나는 메서드로만 바꾼다.
  - 컨트롤러·서비스는 `private final` 필드와 `@RequiredArgsConstructor`로 부품을 받는다. 생성자에서 설정값을 읽거나 준비 작업을 하는 클래스(`AuthService`, `AddressSearchService`)는 생성자를 직접 쓴다.
  - 요청·응답은 지금처럼 `record`로 만든다.
- **요청 값 검사**: 새로 만드는 등록 API는 요청 `record`에 `@NotBlank(message = "이름을 입력해 주세요.")`처럼 규칙과 한국어 안내를 적고, 컨트롤러 인자에 `@Valid`를 붙인다. 일부만 고치는 요청(`PATCH`)은 "보내지 않은 값"과 "null로 보낸 값"을 구분해야 해서 지금처럼 `Patch`로 받아 서비스에서 검사한다. 기존 API의 검사는 그대로 서비스에 있다.

## 로그인

로그인하면 서버가 사용자 id를 담은 토큰(JWT)을 만들어 쿠키로 내려 준다. 브라우저는 이후 `/api` 요청마다 이 쿠키를 자동으로 붙인다.

- 쿠키 `saemgil_token`: `HttpOnly`(JS에서 읽을 수 없음), `SameSite=Lax`, `Path=/api`, 8시간. 운영은 `Secure`(HTTPS 전용)도 켠다.
- 토큰에는 사용자 id만 담는다. 역할·정지 여부는 요청마다 DB에서 읽으므로, 계정을 정지하면 다음 요청부터 바로 막힌다.
- 서명 키는 로컬 `.env`의 `SAEMGIL_JWT_SECRET`(없으면 로컬 전용 기본값), 운영 Secret Manager `saemgil-jwt-secret`(환경변수 `JWT_SECRET`)이다. 32바이트 이상이어야 하며 운영에서 없으면 서버가 시작하지 않는다. 만들기: `openssl rand -base64 48`
- 비밀번호는 BCrypt 해시로만 저장한다.

| 요청 | 성공 | 실패 |
| --- | --- | --- |
| `POST /api/auth/login` `{ "email", "password" }` | `200` 사용자 정보 + 쿠키 | `401` 이메일·비밀번호 불일치, `403` 정지된 계정 |
| `GET /api/auth/me` | `200` 사용자 정보 | `401` 로그인 필요, `403` 정지된 계정 |
| `POST /api/auth/logout` | `204` 쿠키 삭제 | |

접근 규칙은 `SecurityConfig`에 있다. `/api/admin/**`은 관리자만, `/api/me/**`는 운영자와 관리자가 쓸 수 있고, `/health`·`/health/db`·로그인·로그아웃 외의 경로는 로그인이 필요하다.

로컬에서는 FE 로그인 화면의 시연 계정으로 로그인할 수 있다(관리자 `admin@saemgil.dev` / `admin1234`, 운영자 `garden.kim@example.com` / `demo1234`). 운영 DB에는 시연 계정을 넣지 않는다.

운영 첫 관리자 계정은 직접 넣는다. 비밀번호 해시는 로컬에서 만들고(입력한 비밀번호는 화면과 기록에 남지 않는다), Cloud SQL Studio에서 실행한다.

```bash
htpasswd -nBC 10 "" | tr -d ':\n'   # 비밀번호를 두 번 입력하면 $2y$10$... 해시가 나온다
```

```sql
INSERT INTO users (email, password_hash, role, name) VALUES ('<이메일>', '<해시>', 'ADMIN', '<이름>');
```

## 관리자·운영 화면 API

요청·응답 형태와 화면 함수의 대응은 [API 계약](../FE/docs/api.md)에 있다. 로컬에서는 Swagger(<http://localhost:8080/swagger-ui.html>)로도 볼 수 있다.

### 계정 (`/api/admin/users`)

| 요청 | 내용 |
| --- | --- |
| `GET /api/admin/users` | 계정 목록(관리자·운영자). 비밀번호와 해시는 담지 않는다 |
| `POST /api/admin/users` | 계정 추가. `{ email, password, role, name, phone }`. `role`은 `admin`·`operator`. 이메일 중복이면 `409` |
| `PATCH /api/admin/users/{id}` | 보낸 값만 고친다: `name`, `phone`, `password`(새 비밀번호), `status`(`active`·`suspended`). 이메일과 역할은 바꾸지 않는다 |
| `DELETE /api/admin/users/{id}` | 계정과 그 계정의 정원을 함께 지운다. 그 정원에서 작업 중이던 장비는 대기로 돌린다(장비는 남는다) |

- 비밀번호는 공백을 뺀 영문·숫자·특수문자 8~16자다. 연락처는 비우거나 `010-1234-5678` 형식이다.
- 자기 계정은 정지하거나 삭제할 수 없다.
- 비밀번호를 바꿔도 이미 발급된 로그인 쿠키는 만료(8시간)까지 유효하다. 바로 막으려면 정지한다.

### 장비 (`/api/admin/devices`)

| 요청 | 내용 |
| --- | --- |
| `GET /api/admin/devices` | 장비 목록 |
| `POST /api/admin/devices` | 장비 등록. `{ serial, firmware }`. 다음 `ROVEN-NN` 번호를 붙인다. 시리얼 중복이면 `409` |
| `PATCH /api/admin/devices/{id}` | 보낸 값만 고친다: `firmware`, `online`, `state`, `battery`, `water`, `activeGardenId`. 켜져 있는 장비의 값이 바뀌면 마지막 수신 시각을 지금으로 둔다 |
| `POST /api/admin/devices/{id}/release` | 맡은 모든 정원에서 빼고 대기로 돌린다 |

### 정원 (`/api/admin/gardens`)

| 요청 | 내용 |
| --- | --- |
| `GET /api/admin/gardens` | 정원 목록 |
| `POST /api/admin/gardens` | 정원 등록. `{ customerId, name, address, flower, area, deviceId, centerLat, centerLng, boundary, geojson }`. 바로 사용 중(`active`)이 된다 |
| `PATCH /api/admin/gardens/{id}` | 보낸 값만 고친다: `name`, `address`, `flower`, `area`, `status`, `deviceId`(`null`이면 배정 해제), `customerId`(소유권 이전). 위치와 경계는 `centerLat`, `centerLng`, `boundary`, `geojson` 넷을 함께 보낸다 |
| `DELETE /api/admin/gardens/{id}` | 정원 삭제. 되돌릴 수 없다. 이 정원에서 작업 중이던 장비는 대기로 바뀌고, 장비와 그 장비의 다른 정원 배정은 남는다 |

- 같은 계정에 같은 이름의 정원은 하나만 둔다(비활성 제외). 어기면 `409`.
- 장비 한 대는 한 계정의 정원만 맡는다. 다른 계정의 정원을 맡은 장비를 배정하면 `409`.
- 주인을 바꾸면 장비 배정을 함께 푼다. 작업 중이던 정원에서 장비가 빠지면 그 장비는 대기로 바뀐다.
- 정원 주인은 운영자와 관리자 모두 될 수 있다.
- 면적은 소수 둘째 자리로 맞춰 저장한다. 맞춘 값이 0이면(예: `0.001`) `400`으로 거절한다.
- 위치와 경계는 등록할 때와 같은 검사를 거친다. 넷 중 일부만 보내면 지도 위치와 모양이 어긋나므로 `400`으로 거절한다.
- 쓰지 않는 정원은 `status`를 `inactive`로 바꾸거나 지운다. 지우기 전 확인(연결된 장비 안내)은 화면이 한다.

정원 등록과 수정은 동시에 들어온 요청이 위 규칙을 깨거나 서로의 저장 내용을 덮어쓰지 않도록 관련 행을 잠그고 진행한다(`GardenService`).

- 수정과 삭제는 정원 행을 잠그고 최신 값을 읽은 뒤 처리한다. 같은 정원의 동시 수정·삭제가 한 번에 하나씩 처리된다.
- 이름 중복 확인 전에 주인 계정 행을, 장비 배정 전에 장비 행을 잠근다.
- 잠그는 순서는 항상 정원 → 주인 계정 → 장비다. 순서가 같아야 두 요청이 서로를 기다리며 멈추지 않는다.
- 등록·수정은 `READ_COMMITTED`로 실행한다. 잠금을 기다린 뒤의 조회가 앞 요청이 막 저장한 값을 보게 하기 위해서다.
- 장비 값 수정과 계정 수정에는 아직 이 처리가 없다. 같은 장비나 같은 계정을 동시에 고치면 나중 저장이 앞의 저장을 덮어쓸 수 있다.

### 주소 검색 (`/api/admin/geocode`)

`GET /api/admin/geocode?query=` 는 V-world 장소·도로명 주소 검색을 서버가 대신 불러 `[{ title, address, lat, lng }]`(최대 8건)를 돌려준다. V-world 검색은 브라우저에서 바로 부를 수 없어(다른 주소의 화면에서 온 요청을 허용하지 않는다) 서버를 거친다.

- 키는 로컬 `.env`의 `SAEMGIL_VWORLD_API_KEY`, 운영 환경변수 `VWORLD_API_KEY`다. `FE/.env.local`의 `VITE_VWORLD_API_KEY`와 같은 키를 쓴다.
- 키가 없으면 `503`과 안내 문장을 돌려준다. 주소 검색만 꺼지고 나머지는 동작한다. 화면에서는 지도를 직접 옮겨 정원을 등록할 수 있다.
- 운영에서는 `deploy-be.yml`이 Secret Manager의 `vworld-api-key`를 `VWORLD_API_KEY`로 넣는다. BE 실행 계정 `sa-backend`에 이 시크릿 하나의 읽기 권한(보안 비밀 접근자)을 줬다.

### 운영 화면 (`/api/me/dashboard`)

`GET /api/me/dashboard?customerId=` 는 내 정원(비활성 제외, 최근 등록순)과 그 정원에 배정된 장비를 돌려준다.

- 운영자는 자기 정원만 본다. `customerId`를 보내도 무시한다.
- 관리자는 처음에 자기 정원을 보고, `customerId`로 정원이 있는 운영자를 골라 그 화면을 본다. 응답에 `viewAs`(지금 보는 계정, 고를 수 있는 계정 목록)가 붙는다.
- `records`(작업 기록)는 항상 비어 있다. 작업 기록 테이블이 아직 없다.

## 확인한 사실

- 프론트엔드는 로그인한 계정에 따라 브라우저 가상 데이터(시연 계정) 또는 이 서버(그 외 계정)를 쓴다.
- 기존 업무 테이블은 `devices`, `gardens`다. 미션 테이블은 V3 마이그레이션 초안에 추가했으며, 관수 구역·회차·작업 기록 테이블은 아직 없다.
- 운영 DB에는 시연 계정과 시험 데이터를 넣지 않는다.

## 완료한 작업

- Spring Boot · Gradle 프로젝트를 생성했다 (`com.tbcrew.saemgil`).
- DB 없이 응답하는 `GET /health`와 테스트를 추가했다.
- Dockerfile을 추가했다. JDK에서 빌드하고 JRE 이미지에서 root가 아닌 사용자로 실행한다.
- PR에서 BE가 바뀌면 테스트와 Docker 빌드를 검사하고, `main`에 반영되면 Cloud Run에 배포한다.
- MySQL 연결과 로컬·운영·테스트 프로필을 구성했다.
- DB 연결을 확인하는 `GET /health/db`와 테스트를 추가했다. 배포 후 이 응답을 확인해 연결 설정 실수를 잡는다.
- DB·서버 시간대를 한국 시간(KST)으로 통일했다.
- 테이블 변경을 Flyway로 관리하도록 설정했다.
- 테스트를 운영과 같은 MySQL 8.4에서 실행하도록 Testcontainers로 바꿨다. Flyway SQL과 엔티티 검사도 테스트에서 함께 확인된다.
- API 응답 규칙을 정하고 에러 응답을 ProblemDetail 형식으로 통일했다.
- JSON 응답의 날짜 시간대도 한국 시간(KST)으로 맞췄다.
- Swagger(springdoc)로 API 문서와 시험 화면을 추가했다. 로컬에서만 켜고 운영에서는 끈다.
- 로그인(JWT HttpOnly 쿠키)과 관리자·운영자 접근 규칙을 추가했다. 계정 테이블은 `users`다.
- 새 PC에서도 바로 실행되도록 로컬 DB 설정을 정리했다. `bootRun`이 MySQL 컨테이너를 자동으로 띄우고, 포트(3307)와 변수 이름(`SAEMGIL_`)을 PC에 설치된 MySQL·다른 프로젝트 환경변수와 겹치지 않게 바꿨다.
- FE nginx가 `/api` 요청을 BE로 넘기도록 연결했다. 같은 주소라 CORS가 필요 없다.
- `.env`와 JDK 설치 없이 `bootRun` 한 번으로 실행되도록 로컬 기본값과 JDK 자동 설치를 넣었다. 로컬 MySQL 포트는 이 PC에서만 열린다.
- 정원·장비 테이블(`V2`)과 로컬 시험 데이터를 추가했다. 정원 위치와 경계는 위경도로 저장한다.
- 관리자 API를 추가했다: 계정(목록·추가·수정·삭제), 장비(목록·등록·수정·회수), 정원(목록·등록·수정).
- 주소 검색 중계(`/api/admin/geocode`)를 추가했다. 키가 없으면 주소 검색만 꺼진다.
- 운영 화면 조회(`/api/me/dashboard`)를 추가하고, 관리자도 운영 화면 API를 쓸 수 있게 했다.
- 위 API를 실제 MySQL과 실제 로그인 쿠키로 확인하는 테스트를 추가했다(권한, 잘못된 입력, 중복, 장비 배정 규칙, 계정 삭제 시 정원 정리).
- 정원 등록·수정에 행 잠금을 넣어 동시 요청을 한 번에 하나씩 처리하게 했다. 동시 요청을 실제로 재현하는 테스트는 아직 없다.
- 정원 위치·경계 수정과 정원 삭제 API를 추가했다. 삭제하면 그 정원에서 작업 중이던 장비는 대기로 바뀐다.
- Lombok, 요청 값 검사(validation), DevTools를 넣고 엔티티와 컨트롤러·서비스를 Lombok 방식으로 바꿨다. 동작은 그대로다.

## 미션 저장 API (구현 초안)

로그인한 사용자의 정원에서 `GET /api/me/gardens/{gardenId}/missions`로 목록을 조회하고 `POST`로 미션을 저장한다. 정원이 없거나 다른 사용자의 정원이거나 비활성 상태이면 404를 반환한다. 관리자가 운영자 화면을 대신 보는 기능과 별도로, 이 API는 로그인한 사용자 본인의 정원만 처리한다.

```json
{"name":"오전 관수","points":[{"id":"p1","name":"첫 지점","seconds":30,"x":0.25,"y":0.5}],"endPolicy":"stay"}
```

생성 응답은 `201`이며 `id`, `gardenId`, `name`, `version`(1), `points`, `endPolicy`를 포함한다. 목록 응답은 같은 형식의 배열이다. `endPolicy`는 `stay`, `return`, `null`을 받는다. `x`, `y`는 현재 FE의 이미지 기반 시뮬레이션 좌표이며 실제 장비 좌표는 합의 전이다. 정원을 삭제하면 미션도 함께 삭제되도록 마이그레이션에 설정했다.

미션 저장·조회 초안은 컴파일과 MySQL 통합 테스트가 아직 실행되지 않았다. 수정·삭제, 실행·장비 제어와 FE 연동은 구현되지 않았다.

## 아직 구현하지 않은 것

아래 항목은 아직 작업을 시작하지 않았다. 맡아서 구현하거나 설계를 바꿔도 된다. 이미 운영에 적용된 테이블(`V1`, `V2`)만 고치지 말고 새 번호의 파일로 추가한다.

- **관수 구역(A~X), 추가 정원 경계**: 서버에 테이블과 API가 없다. 화면이 브라우저에만 저장한다. 미션 저장·조회는 위 초안으로 작성했으며 FE 연동과 검증이 필요하다.
- **관수 실행(회차), 명령(일시정지·재개·종료·비상정지)**: 없다. 화면의 가상 진행은 브라우저 타이머가 만든다. 실제 계정은 관수를 시작할 수 없다.
- **작업 기록(이력)**: 테이블이 없다. `/api/me/dashboard`의 `records`는 항상 비어 있다.
- **장비 통신**(Pub/Sub, 상태 보고 수신, 실시간 전달): 없다. 장비의 연결 여부·상태·배터리·물은 관리자가 넣은 값이다. 한 번도 연결된 적 없는 새 장비도 배터리가 100으로 보인다.
- **장비 삭제**: 없다. 회수로 대신한다.
- **운영자 본인의 정보·비밀번호 변경, 비밀번호 분실 처리**: 없다. 관리자가 계정 수정에서 바꿔 준다.
- **로그인 쿠키 무효화**: 비밀번호를 바꾸거나 로그아웃해도 이미 발급된 토큰을 서버에서 무효로 만들지 않는다(만료 8시간). 정지는 다음 요청부터 바로 막힌다.
- **장비·계정 수정의 동시 요청 처리**: 정원에만 넣었다. 장비 회수와 정원 수정이 서로 반대 순서로 잠그게 되므로 잠금 순서를 먼저 정해야 한다.
- **동시 요청 테스트**: 같은 장비 배정, 같은 이름 등록, 같은 정원 수정을 동시에 보내 확인하는 테스트가 없다.
- **계정·정원 삭제 시 작업 기록 처리**: 작업 기록이 생기면, 계정과 정원을 지울 때 그 기록을 어떻게 할지 다시 정해야 한다. 실제 장비와 통신하게 되면 작업 중인 정원의 삭제를 막을지도 함께 정한다.

## 예정된 작업

1. 미션 저장(테이블과 API).
2. 회차와 명령. 장비가 없는 동안에는 서버가 가상 장비 역할을 하는 방안을 검토한다.
3. 작업 기록(이력) 조회.
4. 관수 구역과 추가 정원 경계의 서버 저장.

장비 통신·자율주행·원격 제어·자동 보충 기능은 요구사항이 확정된 후 검토한다.
