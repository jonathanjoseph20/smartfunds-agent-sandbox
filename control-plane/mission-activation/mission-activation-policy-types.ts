export interface MissionActivationPolicy {
  activationPolicyId: string;
  displayName: string;
  description: string;
  requiresConfirmedAssignment: boolean;
  requiresMissionReady: boolean;
  requiresDagDependenciesSatisfied: boolean;
  requiresTeamReady: boolean;
  requiresTeamAvailable: boolean;
  requiresFounderActivationConfirmation: boolean;
  enabled: boolean;
}
