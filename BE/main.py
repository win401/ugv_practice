# =============================================================
# main.py — Todo API 서버 (FastAPI + SQLAlchemy + Cloud SQL)
# -------------------------------------------------------------
# 구조
#   1) DB 연결 준비
#   2) 테이블 모양 정의 + 처음 실행 시 기본 데이터 넣기
#   3) API 서버 생성 + CORS 설정
#   4) API 엔드포인트 (조회 / 단건 조회 / 생성)
#
# 주의: 1~2는 파일이 import되는 순간 실행됨
#   → DB 접속이 실패하면 서버(uvicorn)가 포트를 열기도 전에 죽고,
#     Cloud Run은 "PORT=8080에서 응답 없음"이라는 에러만 보여줌.
#   → 그럴 땐 Cloud Run 로그에서 Python traceback 마지막 줄 확인해보세요!!
# =============================================================

import os  # 환경변수(os.getenv / os.environ)를 읽기 위해 사용

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware  # 다른 도메인(FE)에서 오는 브라우저 요청 허용용
from pydantic import BaseModel                       # 요청 body의 모양을 정의하고 자동 검증
from sqlalchemy import Boolean, Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


# -------------------------------------------------------------
# 1) DB 연결 준비
# -------------------------------------------------------------
# engine = "DB로 가는 연결 통로". SQLAlchemy는 이 engine을 통해 DB와 대화함.
# 환경에 따라 다른 DB에 붙도록 분기:

def create_db_engine():
    instance = os.getenv("INSTANCE_CONNECTION_NAME")
    if instance:
        # 필요할 때만 import → 로컬/CI에서는 이 라이브러리가 없어도 동작
        from google.cloud.sql.connector import Connector

        # Cloud SQL 공식 커넥터
        #   - DB를 인터넷(공개 IP)에 열지 않고도 안전하게 접속
        #   - Cloud Run 서비스 계정 권한(Cloud SQL 클라이언트)으로 인증
        connector = Connector()

        # SQLAlchemy가 "새 연결이 필요할 때마다" 호출하는 함수
        def getconn():
            return connector.connect(
                instance,
                "pymysql",                        # MySQL 드라이버 (requirements.txt의 pymysql)
                user=os.environ["DB_USER"],       # os.environ[...] : 없으면 KeyError로 즉시 실패
                password=os.environ["DB_PASS"],   # TODO: DB_PASS를 Secret Manager로 주입하도록 변경
                db=os.environ["DB_NAME"],
            )

        # 주소 대신 creator(연결 만드는 함수)를 넘겨서 커넥터를 쓰게 함
        return create_engine("mysql+pymysql://", creator=getconn)

    # 로컬 / CI: 파일 하나짜리 DB(SQLite). 별도 설치 없이 바로 동작
    return create_engine("sqlite:///./local.db")


# 서버 전체에서 공유하는 DB 연결 통로 (한 번만 만듦)
engine = create_db_engine()


# -------------------------------------------------------------
# 2) 테이블 정의
# -------------------------------------------------------------
class Base(DeclarativeBase):
    pass


# todos 테이블 모양 (엑셀 시트의 열 정의)
class Todo(Base):
    __tablename__ = "todos"  # 실제 DB에 생기는 테이블 이름

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    done: Mapped[bool] = mapped_column(Boolean, default=False)

Base.metadata.create_all(engine)

with Session(engine) as session:
    if session.scalar(select(Todo).limit(1)) is None:
        session.add_all([
            Todo(title="FastAPI"),
            Todo(title="Cloud Run"),
            Todo(title="Git Hub", done=True),
        ])
        session.commit()


# -------------------------------------------------------------
# 요청/응답 모양 정의
# -------------------------------------------------------------
class TodoCreate(BaseModel):
    title: str
    done: bool = False

def to_dict(todo: Todo):
    return {"id": todo.id, "title": todo.title, "done": todo.done}

# -------------------------------------------------------------
# 3) API 서버 생성 + CORS
# -------------------------------------------------------------
# uvicorn main:app 의 "app"이 바로 이것
app = FastAPI()

# CORS: 브라우저 보안 규칙
#   FE(toy-web)와 BE(toy-api-github)는 도메인이 달라서,
#   BE가 "이 출처는 허용"이라고 응답 헤더에 적어줘야 브라우저가 데이터를 넘겨줌.
#   ※ curl / 서버끼리 호출은 CORS와 무관 (브라우저에서만 막힘)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://toy-web-s5xoza2y4a-uc.a.run.app",   # 배포된 FE (끝에 / 붙이면 매칭 안 됨!)
        "http://localhost:5173",                    # 로컬 FE (npm run dev)
    ],
    allow_methods=["*"],   # GET, POST 등 모든 메서드 허용
    allow_headers=["*"],   # Content-Type 등 모든 요청 헤더 허용
)


# -------------------------------------------------------------
# 4) API 엔드포인트
# -------------------------------------------------------------

@app.get("/")
def hello():
    return {"message": "hello"}

@app.get("/todos")
def list_todos():
    with Session(engine) as session:
        # SELECT * FROM todos ORDER BY id
        todos = session.scalars(select(Todo).order_by(Todo.id)).all()
        return [to_dict(t) for t in todos]

@app.get("/todos/{todo_id}")
def get_todo(todo_id: int):
    with Session(engine) as session:
        todo = session.get(Todo, todo_id)  # 기본키로 1건 조회, 없으면 None
        if todo is None:
            raise HTTPException(status_code=404, detail="todo not found")
        return to_dict(todo)

@app.post("/todos", status_code=201)
def create_todo(body: TodoCreate):
    with Session(engine) as session:
        todo = Todo(title=body.title, done=body.done)
        session.add(todo)
        session.commit()
        return to_dict(todo)
