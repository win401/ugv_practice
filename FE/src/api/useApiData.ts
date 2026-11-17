import {
  keepPreviousData,
  useQuery,
  type QueryKey,
} from "@tanstack/react-query";

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "요청을 처리하지 못했습니다.";
}

/**
 * API에서 데이터를 불러온다. React Query가 받아 둔 값을 보관하므로, 같은 이름(key)의 데이터는
 * 여러 화면이 한 번만 받아 같이 쓰고, 화면을 오갈 때는 받아 둔 값을 먼저 보여 준 뒤 새로 확인한다.
 * 데이터가 바뀌면(등록·수정 성공, 가상 서버의 변경 알림) 다시 불러온다.
 *
 * key 에는 무엇을, 누구 것을 불러오는지 적는다. 예: ["operator", "dashboard", 고객 id]
 */
export function useApiData<T>(key: QueryKey, fetcher: () => Promise<T>) {
  const query = useQuery({
    queryKey: key,
    queryFn: fetcher,
    // key 가 바뀌어 새로 불러오는 동안에는 앞의 값을 계속 보여 준다(화면이 비지 않게).
    placeholderData: keepPreviousData,
  });
  return {
    data: query.data ?? null,
    error: query.error ? errorMessage(query.error) : null,
    reload: () => {
      void query.refetch();
    },
  };
}
