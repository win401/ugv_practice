import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import App from "./App";
import { api } from "./api/client";
import { queryClient } from "./api/queryClient";
import GlobalLoading from "./components/GlobalLoading";
import "./index.css";

// 가상 서버는 데이터가 바뀌면(다른 탭 포함) 알려 준다. 그때 받아 둔 데이터를 다시 불러온다.
// 실제 서버는 알림이 없어서, 등록·수정이 성공했을 때 화면이 직접 다시 불러온다.
api.onChange(() => {
  void queryClient.invalidateQueries();
});

// 경로 나누기는 App 안에서 한다. 여기서는 "저장하지 않은 내용이 있으면 이동을 막는" 기능(useBlocker)을
// 쓸 수 있는 방식으로 라우터를 만든다.
const router = createBrowserRouter([{ path: "*", element: <App /> }]);

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
    <GlobalLoading />
  </QueryClientProvider>,
);
