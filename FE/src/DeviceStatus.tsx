import { useEffect, useState } from "react";

type Status = "loading" | "online" | "offline" | "unknown" | "error";

const labels = {
  loading: { icon: "◷", text: "조회 중" },
  online: { icon: "●", text: "연결됨" },
  offline: { icon: "○", text: "연결 끊김" },
  unknown: { icon: "?", text: "상태 확인 불가" },
  error: { icon: "!", text: "API 조회 실패" },
} satisfies Record<Status, { icon: string; text: string }>;

type DeviceState = { status: Status; checkedAt?: Date };

function readDeviceState(payload: unknown): DeviceState {
  if (typeof payload !== "object" || payload === null) {
    return { status: "unknown" };
  }

  const { status, checked_at } = payload as Record<string, unknown>;
  const checkedAt =
    typeof checked_at === "string" ? new Date(checked_at) : undefined;

  return {
    status: status === "online" || status === "offline" ? status : "unknown",
    checkedAt:
      checkedAt && Number.isFinite(checkedAt.getTime()) ? checkedAt : undefined,
  };
}

export default function DeviceStatus({ apiUrl }: { apiUrl: string }) {
  const [device, setDevice] = useState<DeviceState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    // Provisional path and payload until the UGV-01 API contract is confirmed.
    fetch(`${apiUrl}/devices/UGV-01/status`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload: unknown) => {
        if (!controller.signal.aborted) setDevice(readDeviceState(payload));
      })
      .catch(() => {
        if (!controller.signal.aborted) setDevice({ status: "error" });
      });

    return () => controller.abort();
  }, [apiUrl]);

  const { icon, text } = labels[device.status];

  return (
    <section aria-labelledby="ugv-status-heading">
      <h2 id="ugv-status-heading">UGV-01 장비 연결 상태</h2>
      <div role="status">
        <p><span aria-hidden="true">{icon}</span> {text}</p>
        {device.checkedAt && (
          <p>
            마지막 확인{" "}
            <time dateTime={device.checkedAt.toISOString()}>
              {device.checkedAt.toLocaleString("ko-KR")}
            </time>
          </p>
        )}
      </div>
    </section>
  );
}
