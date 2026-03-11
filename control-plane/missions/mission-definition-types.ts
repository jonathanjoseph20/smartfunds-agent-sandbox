import type {
  DeliverableDescriptor,
  MissionLifecycleState,
  SourceReference,
} from './mission-types.ts';

export interface MissionDefinition {
  missionType: string;
  displayName: string;
  enabled: boolean;
  description: string;
  defaultObjective: string;
  defaultDeliverables: DeliverableDescriptor[];
  allowedSourceKinds: string[];
  defaultPriority: string;
  defaultLifecycleState: MissionLifecycleState;
  tags: string[];
}

export type MissionDefinitionLike = Omit<MissionDefinition, 'defaultDeliverables'> & {
  defaultDeliverables: Array<DeliverableDescriptor | string>;
};

export type MissionSourceKindMap = Record<string, SourceReference[]>;
