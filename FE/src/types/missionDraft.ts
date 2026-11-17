import type { EndPolicy, MissionPoint } from "./control";

/** 편집 중인 미션. 시간은 잘못 입력한 값도 그대로 보여 주려고 문자열로 둔다. */
export type MissionDraft = {
  gardenId: string;
  name: string;
  endPolicy: EndPolicy;
  points: (Omit<MissionPoint, "seconds"> & { seconds: string })[];
  selectedId: string | null;
};
