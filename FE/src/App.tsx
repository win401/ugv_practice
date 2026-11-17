import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import AdminApp from "./admin/AdminApp";
import { api } from "./api/client";
import type { User } from "./api/types";
import LoginPage from "./views/LoginPage";
import WorkspaceView from "./views/WorkspaceView";

/**
 * 경로는 세 개다.
 * - /login : 로그인
 * - /admin : 관리자(개발자) 화면. 관리자만
 * - /      : 운영 화면. 운영자는 내 정원을, 관리자는 고객을 골라 그 고객의 화면을 본다.
 *            관리자는 프로필 메뉴의 "관리자 페이지"로 /admin 에 간다.
 * 운영 화면과 관리자 화면 사이는 라우터로 옮긴다(페이지를 새로 불러오지 않는다).
 * 로그인·로그아웃처럼 사용자가 바뀌는 이동은 페이지를 새로 불러와 앞사람의 데이터를 비운다.
 * 화면에서 막는 것은 안내용이다. 실제 권한 검사는 API(지금은 가상 서버)가 한다.
 */

/** 로그인하면 누구나 운영 화면에서 시작한다. */
const HOME = "/";

/** 로그인 후 돌아갈 곳. 이 앱의 경로만 허용한다. */
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next === "/" || next === "/admin" ? next : null;
}

/** 페이지를 새로 불러오며 옮긴다. 사용자가 바뀌는 이동에만 쓴다. */
function reloadTo(to: string) {
  window.location.replace(to);
}

export default function App() {
  const path = useLocation().pathname.replace(/\/+$/, "") || "/";
  // 로그인한 사람은 서버(또는 가상 서버)에 물어서 안다. 여러 화면이 이 값을 같이 쓴다.
  // undefined: 아직 확인 중, null: 로그인 안 함
  // 관리자가 계정을 정지하는 등 데이터가 바뀌면 다시 확인한다(main.tsx 의 변경 알림 연결).
  const session = useQuery({
    queryKey: ["session"],
    queryFn: api.auth.session,
  });
  // 서버에 닿지 못해 확인에 실패하면 로그인하지 않은 것으로 본다. 그래야 백엔드 없이 화면만 띄웠을 때도
  // 로그인 화면이 나오고, 가상 데이터 계정으로 들어갈 수 있다. 받아 둔 값이 있으면(쓰는 도중의 재확인 실패) 그 값을 쓴다.
  const user: User | null | undefined =
    session.data !== undefined
      ? session.data
      : session.isError
        ? null
        : undefined;

  // 로그인 여부와 맞지 않는 곳에 있으면 새로 불러오며 옮긴다.
  const target =
    user === undefined
      ? null
      : path === "/login"
        ? user && (nextPath() ?? HOME)
        : !user
          ? `/login${path === "/" ? "" : `?next=${path}`}`
          : null;

  useEffect(() => {
    if (target) reloadTo(target);
  }, [target]);

  const logout = () => api.auth.logout().then(() => reloadTo("/login"));

  if (user === undefined || target) return null;
  if (!user) return <LoginPage onLogin={() => reloadTo(nextPath() ?? HOME)} />;

  // 운영 화면은 계정 종류와 관계없이 같은 화면이다. 정원과 장비만 로그인한 계정의 것을 보여 준다.
  const workspace = <WorkspaceView onLogout={logout} />;
  return (
    <Routes>
      <Route
        path="/admin"
        element={
          // 정지된 계정은 그대로 두어 API의 안내를 보여 주고, 관리자가 아니면 운영 화면으로 보낸다.
          user.status !== "active" || user.role === "admin" ? (
            <AdminApp user={user} onLogout={logout} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="*" element={workspace} />
    </Routes>
  );
}
