import { MissionStatus } from "@smartfunds/shared";

export const ALLOWED_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  [MissionStatus.INTAKE]: [MissionStatus.LEGAL_STRUCTURING],
  [MissionStatus.LEGAL_STRUCTURING]: [MissionStatus.COMPOSITION],
  [MissionStatus.COMPOSITION]: [MissionStatus.IMPLEMENTATION],
  [MissionStatus.IMPLEMENTATION]: [MissionStatus.PR_GATE],
  [MissionStatus.PR_GATE]: [MissionStatus.VERIFICATION],
  [MissionStatus.VERIFICATION]: [MissionStatus.HUMAN_CHECKPOINT, MissionStatus.IMPLEMENTATION],
  [MissionStatus.HUMAN_CHECKPOINT]: [MissionStatus.APPROVED, MissionStatus.IMPLEMENTATION],
  [MissionStatus.APPROVED]: [MissionStatus.LAUNCHED],
  [MissionStatus.LAUNCHED]: [MissionStatus.ARCHIVED],
  [MissionStatus.ARCHIVED]: []
};

export function isValidTransition(from: MissionStatus, to: MissionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
