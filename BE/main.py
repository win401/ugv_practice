import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import Boolean, Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


def create_db_engine():
    # Cloud Run: 환경변수에 연결 이름이 있으면 Cloud SQL(MySQL)에 커넥터로 접속
    instance = os.getenv("INSTANCE_CONNECTION_NAME")
    if instance:
        from google.cloud.sql.connector import Connector

        connector = Connector()

        def getconn():
            return connector.connect(
                instance,
                "pymysql",
                user=os.environ["DB_USER"],
                password=os.environ["DB_PASS"],
                db=os.environ["DB_NAME"],
            )

        return create_engine("mysql+pymysql://", creator=getconn)

    # 로컬 / CI: 파일 하나짜리 DB(SQLite)로 대신 실행
    return create_engine("sqlite:///./local.db")


engine = create_db_engine()


class Base(DeclarativeBase):
    pass


# todos 테이블 모양 (엑셀 시트의 열 정의)
class Todo(Base):
    __tablename__ = "todos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    done: Mapped[bool] = mapped_column(Boolean, default=False)


# 테이블이 없으면 만들고, 비어 있으면 기본 데이터 넣기
Base.metadata.create_all(engine)
with Session(engine) as session:
    if session.scalar(select(Todo).limit(1)) is None:
        session.add_all([
            Todo(title="FastAPI"),
            Todo(title="Cloud Run"),
            Todo(title="Git Hub", done=True),
        ])
        session.commit()


class TodoCreate(BaseModel):
    title: str
    done: bool = False


def to_dict(todo: Todo):
    return {"id": todo.id, "title": todo.title, "done": todo.done}


app = FastAPI()


@app.get("/")
def hello():
    return {"message": "hello"}


@app.get("/todos")
def list_todos():
    with Session(engine) as session:
        todos = session.scalars(select(Todo).order_by(Todo.id)).all()
        return [to_dict(t) for t in todos]


@app.get("/todos/{todo_id}")
def get_todo(todo_id: int):
    with Session(engine) as session:
        todo = session.get(Todo, todo_id)
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