import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";

/** 이보다 빨리 끝나는 요청에는 보이지 않는다. 금방 끝나는 요청마다 화면이 깜빡이지 않게 한다. */
const SHOW_AFTER_MS = 300;

/**
 * 전역 로딩 표시. 서버 요청(조회, 등록·수정·삭제)이 0.3초 넘게 걸리면 화면 가운데에 돌아가는 원을 보여 준다.
 * 요청은 모두 React Query를 거치므로 화면마다 로딩 코드를 넣지 않아도 된다. 앱에 한 번만 둔다(main.tsx).
 * 보이는 동안에는 반투명 배경이 화면을 덮어 조작을 막는다(같은 요청이 두 번 가지 않게).
 */
export default function GlobalLoading() {
  const busy = useIsFetching() + useIsMutating() > 0;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!busy) {
      setShown(false);
      return;
    }
    const timer = window.setTimeout(() => setShown(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [busy]);

  if (!shown) return null;
  return (
    <div className="global-loading" role="status" aria-live="polite">
      <span className="global-loading-spinner" aria-hidden="true" />
      <span className="global-loading-text">불러오는 중</span>
    </div>
  );
}
