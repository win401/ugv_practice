# hyundai-innovation

현대건설 오픈이노베이션 — 정원 관수 UGV 대시보드.

화면은 운영자 화면(`/`), 관리자 화면(`/admin`), 로그인(`/login`)으로 이루어진다. 시연 계정은 브라우저 안의 가상 서버를, 그 외 계정은 백엔드(Spring Boot, MySQL)를 쓴다. 백엔드에는 로그인과 계정·정원·장비 관리, 운영 화면 조회가 구현되어 있다. 관수 구역·미션·관수 실행·이력은 아직 서버에 없고 [API 계약](FE/docs/api.md#구현-상태-2026-11-13)에 상태를 적어 두었다. 실제 장비 연결은 포함하지 않는다.

## 시작하기

통합 도구 또는 FE·BE 개별 실행 방법을 선택한다. 명령은 macOS와 Windows(PowerShell) 모두 같고, 다른 곳만 따로 적었다.

### 권장: 명령 하나로 실행하기

저장소 최상위(`hyundai-innovation`)에서 실행한다. Node.js 24가 필요하며, 최초 한 번 `FE` 폴더에서 `npm ci`로 의존성을 설치한다. 최신 코드를 받은 뒤 의존성 점검이 실패하면 실행 중인 FE를 종료하고 `npm ci`를 다시 실행한다. FE·BE를 함께 실행하려면 JDK 17 이상과 실행 중인 Docker Desktop도 필요하다.

```bash
node scripts/dev.mjs doctor    # 실행 환경과 포트 점검
node scripts/dev.mjs start     # FE + BE 실행, 준비될 때까지 로그 표시
```

`[READY]`가 나오면 <http://127.0.0.1:5174/>를 연다. BE는 <http://127.0.0.1:8080/swagger-ui.html>이다. FE·BE·DB가 모두 응답해야 준비 완료로 표시한다. 처음에는 Gradle·JDK·MySQL 이미지를 받느라 시간이 걸릴 수 있다. 5분 안에 준비되지 않거나 서비스가 종료되면 함께 실행한 FE·BE를 정리하고 오류로 종료한다.

| 명령 | 동작 |
|---|---|
| `node scripts/dev.mjs start` | FE·BE 실행. 이 터미널에 두 서비스 로그가 표시된다. |
| `node scripts/dev.mjs stop` | 다른 터미널에서 실행. 이 checkout의 도구가 실행한 FE·BE와 하위 프로세스만 종료한다. |
| `node scripts/dev.mjs status` | 실행 상태와 FE·BE·DB의 실제 응답을 확인한다. 별도로 실행한 서비스도 조회할 수 있다. |
| `node scripts/dev.mjs doctor` | Node, FE 직접 의존성과 lock 일치 여부, Java, Docker 엔진, Compose, 앱·DB 포트를 확인한다. 환경변수 값은 출력하지 않는다. |
| `node scripts/dev.mjs start --fe-only` | FE만 실행한다. Java·Docker 없이 화면을 확인할 때 사용한다. |
| `node scripts/dev.mjs doctor --fe-only` | FE 실행에 필요한 환경만 점검한다. |

실행한 터미널의 `Ctrl+C`로도 함께 종료한다. 이미 다른 터미널에서 실행한 프로그램을 종료하거나 사용 중인 포트를 강제로 비우지 않는다. **MySQL 컨테이너와 DB 데이터는 유지**한다. DB까지 멈추려면 FE·BE 종료 후 `BE` 폴더에서 `docker compose stop mysql`을 실행한다(다른 개발 작업이 DB를 쓰는지 먼저 확인).

기본 포트가 사용 중이면 기존 실행을 직접 종료하거나 다른 포트를 지정한다.

```bash
node scripts/dev.mjs start --fe-port 5175 --be-port 8081
```

`status`, `stop`, `doctor`는 실행 중인 도구의 포트와 모드를 자동으로 인식한다. 관리 세션 없이 별도로 실행한 서비스를 확인할 때는 `status --fe-port 5175 --be-port 8081`처럼 지정한다. 같은 checkout에서 도구를 중복 실행하면 기존 실행을 유지하고 안내한다.

통합 실행은 로컬 프로필과 BE 포트를 지정하고, FE의 API 프록시도 그 BE로 연결한다(`API_PROXY_TARGET`을 해당 자식 프로세스에만 적용). `--fe-only`는 기존 FE 프록시 설정을 따른다. `.env` 파일이나 지도 키는 수정하지 않는다. 다른 FE 포트를 쓰면 V-world에 등록한 접속 URL도 확인한다. 통합 실행은 기존 Gradle Wrapper를 사용하며 공용 Gradle daemon을 종료하지 않는다.

`doctor`는 필수 환경 누락이나 포트 충돌 시, `status`는 대상 서비스가 준비되지 않았을 때 종료 코드 `1`을 반환한다. `.env`와 지도 키는 선택 사항이며, 키가 없으면 관련 지도·주소 검색 기능만 제한된다. 실행 중인 도구의 앱 포트는 정상 사용으로 표시한다.

도구와 배포 제어의 검사는 저장소 최상위에서 `node --test "scripts/*.test.mjs"`로 실행한다. 테스트는 임시 폴더·임시 포트·로컬 Git 저장소를 사용하며 실제 배포는 하지 않는다. Linux에서는 Git·Bash로 배포 순서 회귀 검사와 부모 종료 후 하위 프로세스 정리까지 확인한다. Windows CI에서는 실행 도구와 워크플로 연결을 검사한다.

### Windows 줄바꿈과 의존성 갱신

저장소의 `.gitattributes`는 텍스트를 LF로, Windows 실행 파일(`.bat`, `.cmd`)은 CRLF로 관리한다. 이미지·JAR 파일은 줄바꿈을 변환하지 않는다. 개인의 전역 Git 설정을 바꿀 필요가 없다.

최신 코드를 받은 뒤 `doctor`가 의존성 불일치를 알리면 FE를 종료하고 `FE` 폴더에서 `npm ci`를 실행한다. 기존 작업 폴더에 CRLF가 남아 포맷 검사만 실패하면 같은 폴더에서 `npm run format`을 한 번 실행한 뒤 `npm run format:check`로 확인한다. `.env`와 지도 키는 그대로 유지한다.

### 화면만 볼 때 (FE만)

준비물: Node.js 24. 백엔드·DB·환경변수 없이 브라우저 안의 가상 서버로 동작한다.

```bash
cd FE
npm ci
npm run dev
```

<http://127.0.0.1:5174/>를 연다. 서버 실행과 함께 브라우저를 열려면 `npm run dev -- --open`을 쓴다. 종료는 실행한 터미널에서 `Ctrl+C`.

### 백엔드도 함께 띄울 때 (BE)

준비물: JDK 17 이상, Docker Desktop(켜 두기). `.env`는 없어도 된다. 설치 방법(Windows `winget` 포함)은 [BE README](BE/README.md#시작하기)를 본다.

```bash
cd BE
./gradlew bootRun        # Windows: .\gradlew.bat bootRun
```

MySQL 컨테이너가 자동으로 뜨고 <http://localhost:8080>에서 API가 응답한다. API 목록과 시험 화면은 <http://localhost:8080/swagger-ui.html>이다. 자세한 내용과 문제 해결은 [BE README](BE/README.md)를 본다.

FE 개발 서버는 `/api` 요청을 로컬 백엔드(8080)로 넘긴다. 로그인 화면의 시연 계정은 가상 서버를 쓰므로 백엔드를 띄우지 않아도 동작한다. 화면에서 실제 서버 연동을 보려면 로컬 시험 계정으로 로그인한다(관리자 `ops-admin@saemgil.dev` / `admin1234`, 운영자 `wind.jung@example.com` / `demo1234`). [FE README의 실제 서버 연동](FE/README.md#실제-서버-연동)을 본다.

### 검사와 빌드

```bash
# FE 폴더에서
npm run format:check
npm run build

# BE 폴더에서
./gradlew test           # Windows: .\gradlew.bat test
```

## 자동 검사와 배포

PR은 항상 `Build verification` 결과를 남긴다. 검사와 배포는 [.github/change-filters.yml](.github/change-filters.yml)의 같은 경로 규칙을 사용한다.

| 변경 내용 | PR 검사 | main 반영 후 자동 배포 |
|---|---|---|
| FE 실행 코드·정적 파일·의존성·빌드 설정 | FE | FE |
| BE 실행 코드·리소스·의존성·빌드 설정·Flyway SQL | BE | BE |
| `FE/tests/**`만 | FE 유지 | 생략 |
| `BE/src/test/**`만 | BE 유지 | 생략 |
| 각 서비스 최상위 `*.md`, `FE/docs/**`, `BE/docs/**`만 | 앱 검사 생략 | 생략 |
| 루트 README·`docs/**` 등 앱 밖 문서만 | 앱 검사 생략 | 생략 |
| CI 워크플로·공통 필터 | FE·BE·로컬 도구 | 생략 |
| 개발 도구·회귀 테스트 (`scripts/**`, 배포 제어 스크립트 제외) | 도구·배포 제어 검사 (Windows·Linux) | 생략 |
| `scripts/deployment-current.sh` | FE·BE·도구·배포 제어 | FE·BE |
| FE/BE 배포 워크플로 | 해당 앱·도구·배포 제어 | 해당 앱 |
| `.gitattributes` | FE·BE·로컬 도구 | FE·BE |

여러 종류가 함께 바뀌면 필요한 작업을 모두 실행한다. 테스트/문서를 제외한 앱 폴더의 다른 파일은 보수적으로 검사·배포에 포함한다. `src/`·`public/` 안의 Markdown은 실제 서비스 입력일 수 있어 문서로 일괄 제외하지 않는다. `.editorconfig` 변경은 FE 검사를, `.nvmrc` 변경은 FE·로컬 도구 검사를 실행한다.

배포 워크플로는 main의 push에서 먼저 변경 범위를 확인하고, 대상 앱에 실행 변경이 없으면 빌드·배포 job을 생략한다. 서비스별 배포는 직렬 큐에서 기다리며 실행 중이거나 대기 중인 다른 배포를 취소하지 않는다(`queue: max`, 최대 100개 대기). 삭제/이름 변경은 제거된 실행 파일도 반영하며, 한 번에 여러 커밋을 push해도 전체 범위를 확인한다.

큐 진입 순서는 커밋 순서와 다를 수 있어 `scripts/deployment-current.sh`가 빌드 전·배포 직전에 최신 main과 해당 서비스의 배포 입력을 비교한다. 오래된 입력이면 이후 인증·빌드 또는 배포를 생략한다. main에 문서·테스트·다른 서비스만 변경됐다면 필요한 배포는 계속 진행한다. 수동 배포도 같은 검사를 거치며, 현재 main과 배포 입력이 같은 버전은 변경 여부와 무관하게 재배포할 수 있다. 공통 빌드 입력이나 테스트 위치를 추가하면 경로 필터와 배포 제어 스크립트의 입력 목록을 함께 갱신한다.

### 배포 이미지 캐시

FE·BE 배포는 Docker Buildx로 빌드·업로드하며 GitHub Actions 캐시를 다음 배포에서 복원한다. 캐시 이름은 `saemgil-fe`와 `saemgil-be`로 분리하고, 의존성 설치 같은 중간 레이어도 저장한다(`mode=max`). 캐시가 없으면 일반 빌드를 수행하며, 캐시 저장 실패만으로 배포를 실패시키지 않는다. 이미지 빌드·업로드, Cloud Run 배포, 배포 후 FE API 프록시·BE DB 연결 확인은 실패 시 그대로 중단한다.

FE는 `deps` 단계의 `npm ci`를 재사용하고, 지도 키를 넣는 `build` 단계는 매 배포 다시 실행한다. Secret Manager에서 최신 키를 읽어 임시 파일로만 전달하며 성공·실패와 무관하게 정리한다. Docker는 secret 값 변경만으로 캐시를 무효화하지 않으므로 `no-cache-filters: build`를 유지한다. 키를 빌드 인자로 전달하거나 `.env`를 이미지에 복사하지 않는다. 최종 브라우저 JS에는 기존처럼 V-world 웹 지도 키가 포함된다.

BE는 기존 Dockerfile의 의존성 준비·컴파일 레이어를 변경 여부에 따라 재사용한다. DB 비밀번호·JWT 키·주소 검색 키는 기존처럼 Cloud Run 실행 시 주입한다. Docker 빌드 기록 파일을 별도 artifact로 업로드하는 기능은 사용하지 않는다.

## 저장소 구성

```text
hyundai-innovation/
├── BE/                 # Java · Spring Boot · Gradle 백엔드 (로그인, 계정·정원·장비 API, MySQL)
├── FE/                 # React · Vite · TypeScript 프론트엔드
│   └── src/
│       ├── components/ # 헤더, 정원 지도, 장비 일러스트, 확인 창
│       ├── views/      # 작업 공간, 관수 작업, 장비, 이력 화면
│       ├── api/        # API 함수와 타입, 가상 서버와 실제 서버 구현
│       ├── admin/      # 관리자 화면
│       ├── hooks/      # 브라우저 내 관수 시뮬레이션
│       ├── data/       # 가상 정원·구역·경로·이력
│       ├── lib/        # 순수 계산 함수
│       ├── types/      # 화면 데이터 타입
│       └── styles/     # 공통·화면·반응형 스타일
├── docs/               # 구조·개발 안내
├── scripts/            # 로컬 실행·종료·상태·환경 점검 도구와 회귀 검사
└── work-log/           # 날짜별 작업 기록
```

## 화면 범위

- 예시 항공사진 기반 정원 지도와 정원 전환, 확대·축소·구역도 전환.
- 가상 관수 진행률·장비 위치 변화와 일시정지·재개·종료·다시 시작.
- 완료 장면 바로 보기, 작업 이력 필터·상세, 장비 상태·알림.
- 데스크톱 오른쪽 패널과 모바일 하단 패널.

위 범위는 시연 계정(가상 데이터) 기준이다. 실제 계정에서 서버에 저장되는 것과 아직 구현하지 않은 것은 [FE README](FE/README.md#실제-서버-연동)와 [BE README](BE/README.md#아직-구현하지-않은-것)에 있다.

시연 기준일은 **2026년 11월 4일**로 고정되어 있다. 상태와 이력은 브라우저 `localStorage`에 저장되며, 관리자 화면에서 초기화할 수 있다. 정원은 장미·초화·잔디 3곳이며 같은 예시 항공사진에 표시되고, 전환하면 지도 구역과 정보가 그 정원 기준으로 바뀐다. 장비 외형·물 잔량·사용량·경로는 화면 제안이며 실제 사양이나 자율주행 기능의 확정이 아니다.

## 문서

- [프론트엔드 실행 안내](FE/README.md)
- [프론트엔드 개발 규칙](FE/docs/guidelines.md)
- [백엔드 현재 상태와 계획](BE/README.md)
- [구조와 검증 기록](docs/architecture.md)
- [업무일지](work-log/2026-11-05.md)

서비스 이름·장비 통신 규격·세부 제어 기능은 미확정이다.
