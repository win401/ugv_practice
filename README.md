# ugv_practice

GCP 인프라 연습용 프로젝트.
목표: **깃헙에 push하면 자동 배포되고, DB에서 데이터를 읽고 쓰는 API**

## 파일 구성

| 파일 | 역할 |
|---|---|
| `main.py` | API 서버 코드 (FastAPI) |
| `requirements.txt` | 필요한 파이썬 라이브러리 목록 |
| `Dockerfile` | 이미지를 만드는 레시피 (Cloud Build가 읽음) |
| `.gitignore` | 깃헙에 올리면 안 되는 파일 목록 |
| `README.md` | 이 문서. 실행·배포 방법 기록 |

## 로컬 실행

```bash
# (선택) 가상환경 만들기: 프로젝트마다 라이브러리를 분리해서 설치
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux

# 라이브러리 설치
pip install -r requirements.txt

# 서버 실행 (--reload: 코드 저장하면 자동 재시작)
uvicorn main:app --reload
```

- http://127.0.0.1:8000 → `{"message":"hello"}` 나오면 성공
- http://127.0.0.1:8000/docs → API 문서 자동 생성 확인

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