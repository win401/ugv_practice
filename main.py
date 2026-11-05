
from fastapi import FastAPI, HTTPException
app = FastAPI()

todos = [
    {"id": 1, "title": "FastAPI", "done": False},
    {"id": 2, "title": "Cloud Run", "done": False},
]

@app.get("/")
def hello():
    return {"message": "hello"}

@app.get("/todos")
def list_todos():
    return todos

@app.get("/todos/{todo_id}")
def get_todo(todo_id: int):
    for todo in todos:
        if todo["id"] == todo_id:
            return todo
    raise HTTPException(status_code=404, detail="todo not found")

