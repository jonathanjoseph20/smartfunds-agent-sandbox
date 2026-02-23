import { describe, expect, test } from "vitest";
import { calculateChecksum } from "./checksum.js";

describe("checksum", () => {
  test("T-M1 checksum empty string", () => {
    expect(calculateChecksum("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  test("T-M1 checksum known input abc", () => {
    expect(calculateChecksum("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  test("T-M1 checksum unicode input", () => {
    const input = "\u2713 \u00e0 la mode";
    expect(calculateChecksum(input)).toBe(
      "7df11e628347633af3d92d3f1c704d09998b876421df4772847f5b02081f7cd0"
    );
  });

  test("T-M1 checksum is stable across calls", () => {
    const input = "repeatable";
    const first = calculateChecksum(input);
    const second = calculateChecksum(input);
    expect(first).toBe(second);
  });
});
