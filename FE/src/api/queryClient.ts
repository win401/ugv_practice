import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./types";

/**
 * 서버에서 받은 데이터를 보관하는 곳. 여러 화면이 같은 데이터를 한 번만 받아 같이 쓴다.
 * 등록·수정·명령은 실패해도 자동으로 다시 보내지 않는다(같은 요청이 두 번 들어가면 안 된다).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 창으로 돌아올 때 다시 불러오면 편집 중인 값이 덮일 수 있어 끈다.
      refetchOnWindowFocus: false,
      // 서버가 거절한 요청(로그인 필요, 권한 없음 등)은 다시 보내도 같아서 한 번만 시도한다.
      retry: (failures, error) => !(error instanceof ApiError) && failures < 1,
    },
    mutations: { retry: false },
  },
});
