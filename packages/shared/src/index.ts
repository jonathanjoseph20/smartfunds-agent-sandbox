export enum ExemptionType {
  C506 = "506C"
}

export enum MissionStatus {
  INTAKE = "INTAKE",
  LEGAL_STRUCTURING = "LEGAL_STRUCTURING",
  COMPOSITION = "COMPOSITION",
  IMPLEMENTATION = "IMPLEMENTATION",
  PR_GATE = "PR_GATE",
  VERIFICATION = "VERIFICATION",
  HUMAN_CHECKPOINT = "HUMAN_CHECKPOINT",
  APPROVED = "APPROVED",
  LAUNCHED = "LAUNCHED",
  ARCHIVED = "ARCHIVED"
}

export interface Mission {
  id: string;
  offering_name: string;
  asset_type: string;
  exemption_type: ExemptionType;
  target_raise: number;
  jurisdiction: string;
  status: MissionStatus;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  mission_id: string;
  from_status: MissionStatus | null;
  to_status: MissionStatus;
  actor: string;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}
