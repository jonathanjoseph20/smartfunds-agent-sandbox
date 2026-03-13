import {
  RUNTIME_FEEDBACK_INGESTION_CLASSES,
  type RuntimeFeedbackIngestionClass,
} from './activation-runtime-integration-types.ts';

export function normalizeRuntimeFeedbackClass(value: string): RuntimeFeedbackIngestionClass {
  return RUNTIME_FEEDBACK_INGESTION_CLASSES.includes(value as RuntimeFeedbackIngestionClass)
    ? (value as RuntimeFeedbackIngestionClass)
    : 'runtime_execution_inconclusive';
}
