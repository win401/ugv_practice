/** 고객 화면의 시연 기준일. 이력의 "오늘" 필터가 이 날짜를 쓴다. */
export const DEMO_DATE = "2026.11.04";

const pad = (n: number) => String(n).padStart(2, "0");

/** 2026.11.10 14:32 형식의 현재 시각 */
export function now() {
  const d = new Date();
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function today() {
  return now().slice(0, 10);
}

export function clock() {
  return now().slice(11);
}
