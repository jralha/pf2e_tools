import { describe, expect, it } from "vitest";
import {
  decodeEnemies,
  decodeWalls,
  encodeEnemies,
  encodeWalls,
  parseSteppedInt,
  parseTokenSize,
} from "./urlState";

describe("urlState serialization", () => {
  it("round-trips enemy tokens cleanly", () => {
    const encoded = encodeEnemies([
      {
        id: 1,
        label: "E1",
        sizeName: "Medium",
        size: 1,
        i: 2,
        j: -1,
        elevationFt: 0,
      },
      {
        id: 2,
        label: "E2",
        sizeName: "Large",
        size: 2,
        i: -3,
        j: 4,
        elevationFt: 15,
      },
    ]);
    expect(encoded).toBe("2,-1,Medium,0;-3,4,Large,15");

    const decoded = decodeEnemies(encoded);
    expect(decoded).toHaveLength(2);
    expect(decoded[0]).toMatchObject({
      label: "E1",
      sizeName: "Medium",
      size: 1,
      i: 2,
      j: -1,
      elevationFt: 0,
    });
    expect(decoded[1]).toMatchObject({
      label: "E2",
      sizeName: "Large",
      size: 2,
      i: -3,
      j: 4,
      elevationFt: 15,
    });
  });

  it("round-trips wall sets and ignores malformed input", () => {
    const encoded = encodeWalls(new Set(["2,1", "-1,0"]));
    const decoded = decodeWalls(encoded);
    expect(decoded.has("2,1")).toBe(true);
    expect(decoded.has("-1,0")).toBe(true);
    expect(decodeWalls("bad;1,2;x,y")).toEqual(new Set(["1,2"]));
  });

  it("validates token sizes and stepped integers", () => {
    expect(parseTokenSize("Huge", "Medium")).toBe("Huge");
    expect(parseTokenSize("Invalid", "Medium")).toBe("Medium");
    expect(parseSteppedInt("17", 5, 120, 5, 10)).toBe(15);
    expect(parseSteppedInt("999", 5, 120, 5, 10)).toBe(120);
    expect(parseSteppedInt("abc", 5, 120, 5, 10)).toBe(10);
  });
});
