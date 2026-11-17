import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { errorMessage, useApiData } from "../api/useApiData";
import type { User } from "../api/types";
import type { AdminData } from "./types";

export { now, today } from "../api/time";

/** 관리자 화면의 등록·수정 요청에 붙이는 이름. 처리 중인 요청을 셀 때 쓴다. */
const ADMIN_MUTATION = ["admin"];

/**
 * 관리자 화면의 데이터와 변경 함수. 조회와 변경 모두 React Query를 거친다.
 * 변경이 성공하면 받아 둔 데이터를 모두 낡은 것으로 표시해 다시 불러온다.
 */
export function useAdminData() {
  const { data, error: loadError } = useApiData(
    ["admin", "snapshot"],
    api.admin.snapshot,
  );
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // 등록·수정·삭제 요청. 실패해도 자동으로 다시 보내지 않는다(queryClient.ts 기본 설정).
  const mutation = useMutation({
    mutationKey: ADMIN_MUTATION,
    mutationFn: (request: () => Promise<unknown>) => request(),
    // 계정·정원·장비는 서로 물려 있어(정원 수, 장비 주인) 하나가 바뀌면 전부 다시 불러온다.
    // 운영 화면이 받아 둔 정원·장비도 함께 낡은 것으로 표시된다.
    onSuccess: () => queryClient.invalidateQueries(),
  });
  // 처리 중인 요청 수. 0보다 크면 등록 버튼을 잠가 같은 요청이 두 번 가지 않게 한다.
  const pending = useIsMutating({ mutationKey: ADMIN_MUTATION });

  // 성공하면 목록을 다시 불러오고 null, 실패하면 안내 문장을 돌려준다.
  // 버튼 하나로 끝나는 동작은 실패를 화면 위쪽 알림으로 보여 준다.
  // 입력 폼(inForm)은 알림 대신 돌려받은 문장을 폼 안에 보여 주고, 성공했을 때만 닫는다.
  const call =
    <A extends unknown[]>(
      fn: (...args: A) => Promise<unknown>,
      inForm = false,
    ) =>
    (...args: A): Promise<string | null> => {
      if (!inForm) setError(null);
      return mutation
        .mutateAsync(() => fn(...args))
        .then(
          () => null,
          (e) => {
            const message = errorMessage(e);
            if (!inForm) setError(message);
            return message;
          },
        );
    };

  const actions = {
    addCustomer: call(api.admin.addCustomer),
    addGarden: call(api.admin.addGarden),
    updateCustomer: call(api.admin.updateCustomer),
    deleteCustomer: call(
      (id: string) =>
        api.admin.deleteCustomer?.(id) ??
        Promise.reject(
          new Error("가상 데이터에서는 계정을 삭제할 수 없습니다."),
        ),
    ),
    updateGarden: call(api.admin.updateGarden),
    deleteGarden: call(
      (id: string) =>
        api.admin.deleteGarden?.(id) ??
        Promise.reject(
          new Error("가상 데이터에서는 정원을 삭제할 수 없습니다."),
        ),
    ),
    registerDevice: call(api.admin.registerDevice),
    updateDevice: call(api.admin.updateDevice),
    releaseDevice: call(api.admin.releaseDevice),
    reset: call(api.admin.resetDemo),
  };
  // 입력 폼에서 부르는 것. 실패 문장을 폼이 직접 보여 준다.
  const forms = {
    addCustomer: call(api.admin.addCustomer, true),
    addGarden: call(api.admin.addGarden, true),
    updateGarden: call(api.admin.updateGarden, true),
    updateCustomer: call(api.admin.updateCustomer, true),
    registerDevice: call(api.admin.registerDevice, true),
  };

  return {
    data,
    loadError,
    error,
    busy: pending > 0,
    clearError: () => setError(null),
    actions,
    forms,
  };
}

export type AdminStore = ReturnType<typeof useAdminData>["actions"] & {
  data: AdminData;
  /** 입력 폼용 동작. 실패하면 안내 문장을, 성공하면 null 을 돌려준다. */
  forms: ReturnType<typeof useAdminData>["forms"];
  /** 등록·수정 요청을 처리하는 중 */
  busy: boolean;
  /** 지금 로그인한 관리자 */
  me: User;
};
