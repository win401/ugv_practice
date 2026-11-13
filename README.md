# ugv_practice

GCP 인프라 연습용 프로젝트.
목표: **깃헙에 push하면 자동 배포되고, DB에서 데이터를 읽고 쓰는 API**

## 백엔드 실행

Java 17과 Maven 3.9 이상이 필요합니다.

```bash
cd BE
mvn spring-boot:run
```

`http://localhost:8080`에서 서버를 확인할 수 있습니다. 로컬에서는 `BE/local.db` SQLite 파일을 사용합니다. 기존 SQLite 파일이 있으면 해당 데이터를 사용합니다.

```bash
cd BE
mvn test
```

Cloud Run에서는 기존 `INSTANCE_CONNECTION_NAME`, `DB_USER`, `DB_PASS`, `DB_NAME` 환경 변수를 사용해 Cloud SQL MySQL에 연결합니다.

## 배포 (1단계: 수동 배포)

```bash
gcloud run deploy toy-api --source . --region asia-northeast3 --allow-unauthenticated
```

| 옵션 | 의미 |
|---|---|
| `toy-api` | Cloud Run 서비스 이름 |
| `--source .` | 현재 폴더 코드를 Cloud Build로 보내서 이미지로 만듦 |
| `--region asia-northeast3` | 서울 리전 |
| `--allow-unauthenticated` | 로그인 없이 누구나 URL로 접속 가능 (빼면 403 에러) |

배포가 끝나면 출력되는 `Service URL`로 접속해서 확인하면 됩니다.