import axios from "axios";
import { ApiError } from "./types";

/** 주소 뒤에 붙는 검색 조건. 값이 없는(undefined·null) 항목은 보내지 않는다. */
export type Query = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * 실제 서버(BE)에 요청을 보낸다. 주소는 화면과 같은 주소의 /api 다(개발은 Vite 프록시,
 * 운영은 nginx 프록시). 로그인 쿠키는 브라우저가 알아서 붙인다.
 * 서버가 거절하면 서버가 준 안내 문장(ProblemDetail 의 detail)을 담아 ApiError 로 던진다.
 *
 * 검색 조건은 주소에 직접 이어 붙이지 말고 query 로 넘긴다. 한글·특수문자를 주소에 맞게 바꾸는 일은 axios 가 한다.
 * 예: http("GET", "/api/admin/geocode", undefined, { query })
 */
export async function http<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  query?: Query,
): Promise<T> {
  try {
    const response = await axios.request<T>({
      method,
      url: path,
      data: body,
      params: query,
    });
    // 본문이 없는 응답(204)은 빈 글자로 온다.
    return (response.status === 204 ? undefined : response.data) as T;
  } catch (e) {
    // 서버가 응답은 했지만 거절한 경우(4xx, 5xx)
    if (axios.isAxiosError(e) && e.response) {
      const problem = e.response.data as { detail?: unknown } | null;
      throw new ApiError(
        e.response.status,
        typeof problem?.detail === "string"
          ? problem.detail
          : "요청을 처리하지 못했습니다.",
      );
    }
    // 응답을 받지 못한 경우(서버 꺼짐, 네트워크 끊김)
    throw new Error("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
