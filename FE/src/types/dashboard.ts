import type { GardenStatus } from "../api/types";

export type Tab = "info" | "work" | "mission" | "device" | "history";
export type Mode = "running" | "paused" | "ready" | "done";
export type RecordItem = {
  id: number;
  gardenId: string;
  deviceId: string;
  zone: string;
  date: string;
  time: string;
  minutes: number;
  water: number;
  complete: boolean;
};

/** 고객 화면에서 쓰는 정원. API의 Garden 에서 화면에 필요한 값만 옮긴다. */
export type Zone = {
  id: string;
  /** 정원 목록·지도 이름표의 순서 글자 (A, B, C …) */
  letter: string;
  name: string;
  area: number;
  flower: string;
  address: string;
  color: string;
  status: GardenStatus;
  deviceId: string | null;
  /** 지도 위 구역 경계(SVG path)와 이름표 위치, 예시 관수 경로. */
  shape: string;
  label: number[];
  route: number[][];
};

export type GardenInput = Pick<Zone, "name" | "address" | "flower" | "area">;
