export class MissingDealInputsError extends Error {
  readonly missing_keys: string[];

  constructor(missingKeys: string[]) {
    const sortedKeys = [...missingKeys].sort();
    super(`Missing required deal inputs: ${sortedKeys.join(", ")}`);
    this.name = "MissingDealInputsError";
    this.missing_keys = sortedKeys;
  }
}
