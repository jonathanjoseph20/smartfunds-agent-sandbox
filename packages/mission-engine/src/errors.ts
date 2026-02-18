import { MissionStatus } from "@smartfunds/shared";

export class InvalidTransitionError extends Error {
  public readonly from: MissionStatus;
  public readonly to: MissionStatus;

  constructor(from: MissionStatus, to: MissionStatus) {
    super(`Invalid transition from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
  }
}

export class MissionNotFoundError extends Error {
  public readonly mission_id: string;

  constructor(missionId: string) {
    super(`Mission not found: ${missionId}`);
    this.name = "MissionNotFoundError";
    this.mission_id = missionId;
  }
}
