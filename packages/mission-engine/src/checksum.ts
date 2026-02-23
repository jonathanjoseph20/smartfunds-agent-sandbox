import { createHash } from "node:crypto";

export function calculateChecksum(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
