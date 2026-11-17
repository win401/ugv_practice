import type { Mission } from "../types/control";
import type { MissionDraft } from "../types/missionDraft";

export function draftOf(mission: Mission): MissionDraft {
  return {
    gardenId: mission.gardenId,
    name: mission.name,
    endPolicy: mission.endPolicy,
    points: mission.points.map((p) => ({ ...p, seconds: String(p.seconds) })),
    selectedId: mission.points[0]?.id ?? null,
  };
}

export function isDirty(draft: MissionDraft, mission: Mission) {
  const a = JSON.stringify([draft.name, draft.endPolicy, draft.points]);
  const b = JSON.stringify([
    mission.name,
    mission.endPolicy,
    mission.points.map((p) => ({ ...p, seconds: String(p.seconds) })),
  ]);
  return a !== b;
}
