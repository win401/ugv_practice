import { useEffect, useState } from "react";

type Todo = {
  id: number;
  title: string;
  done: boolean;
};

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/todos`)
      .then((res) => res.json())
      .then(setTodos);
  }, []);

  return (
    <main>
      <h1>sungwoo's todos</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            {todo.done ? "✅" : "⬜️"} {todo.title}
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
