from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_hello():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json() == {"message": "hello"}

def test_list_todos():
      res = client.get("/todos")
      assert res.status_code == 200
      assert len(res.json()) > 0


def test_get_todo():
    res = client.get("/todos/1")
    assert res.status_code == 200
    assert res.json()["id"] == 1


def test_get_todo_not_found():
    res = client.get("/todos/999")
    assert res.status_code == 404