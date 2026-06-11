import { describe, it, expect } from "vitest";
import { outcome, scoreMatch, scoreGroupTable } from "./score";

describe("outcome", () => {
  it("H when home wins", () => expect(outcome(2, 1)).toBe("H"));
  it("A when away wins", () => expect(outcome(0, 1)).toBe("A"));
  it("D for draws", () => expect(outcome(2, 2)).toBe("D"));
  it("D for 0-0", () => expect(outcome(0, 0)).toBe("D"));
});

describe("scoreMatch", () => {
  it("5 points for exact score", () => {
    expect(scoreMatch({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(5);
  });

  it("5 points for exact draw", () => {
    expect(scoreMatch({ home: 1, away: 1 }, { home: 1, away: 1 })).toBe(5);
  });

  it("5 points for exact 0-0", () => {
    expect(scoreMatch({ home: 0, away: 0 }, { home: 0, away: 0 })).toBe(5);
  });

  it("2 points for correct home win, wrong score", () => {
    expect(scoreMatch({ home: 2, away: 1 }, { home: 3, away: 0 })).toBe(2);
  });

  it("2 points for correct away win, wrong score", () => {
    expect(scoreMatch({ home: 0, away: 2 }, { home: 1, away: 3 })).toBe(2);
  });

  it("2 points for predicted draw, actual draw, different scores", () => {
    expect(scoreMatch({ home: 1, away: 1 }, { home: 2, away: 2 })).toBe(2);
  });

  it("0 points for predicted home win, actual away win", () => {
    expect(scoreMatch({ home: 2, away: 1 }, { home: 0, away: 1 })).toBe(0);
  });

  it("0 points for predicted draw, actual home win", () => {
    expect(scoreMatch({ home: 1, away: 1 }, { home: 2, away: 1 })).toBe(0);
  });

  it("0 points when prediction missing", () => {
    expect(scoreMatch(null, { home: 1, away: 0 })).toBe(0);
    expect(scoreMatch(undefined, { home: 1, away: 0 })).toBe(0);
  });

  it("0 points when actual missing", () => {
    expect(scoreMatch({ home: 1, away: 0 }, null)).toBe(0);
    expect(scoreMatch({ home: 1, away: 0 }, undefined)).toBe(0);
  });

  it("0 points when both missing", () => {
    expect(scoreMatch(null, null)).toBe(0);
  });

  it("exact is not additive — flat 5, not 5+2", () => {
    // If exact were additive with outcome, this would be 7.
    expect(scoreMatch({ home: 1, away: 0 }, { home: 1, away: 0 })).toBe(5);
  });
});

describe("scoreGroupTable", () => {
  const actual = [
    { teamId: 10, rank: 1 },
    { teamId: 20, rank: 2 },
    { teamId: 30, rank: 3 },
    { teamId: 40, rank: 4 },
  ];

  it("20 points for fully correct ordering", () => {
    expect(
      scoreGroupTable(
        [
          { teamId: 10, rank: 1 },
          { teamId: 20, rank: 2 },
          { teamId: 30, rank: 3 },
          { teamId: 40, rank: 4 },
        ],
        actual,
      ),
    ).toBe(20);
  });

  it("10 points for two correct positions, two wrong", () => {
    expect(
      scoreGroupTable(
        [
          { teamId: 10, rank: 1 }, // ✓
          { teamId: 20, rank: 2 }, // ✓
          { teamId: 40, rank: 3 }, // ✗ (actually 4th)
          { teamId: 30, rank: 4 }, // ✗ (actually 3rd)
        ],
        actual,
      ),
    ).toBe(10);
  });

  it("5 points for one correct position", () => {
    expect(
      scoreGroupTable(
        [
          { teamId: 10, rank: 1 }, // ✓
          { teamId: 30, rank: 2 },
          { teamId: 40, rank: 3 },
          { teamId: 20, rank: 4 },
        ],
        actual,
      ),
    ).toBe(5);
  });

  it("0 points for a fully reversed ranking", () => {
    expect(
      scoreGroupTable(
        [
          { teamId: 40, rank: 1 },
          { teamId: 30, rank: 2 },
          { teamId: 20, rank: 3 },
          { teamId: 10, rank: 4 },
        ],
        actual,
      ),
    ).toBe(0);
  });

  it("0 when actual standings are empty (group not yet finished)", () => {
    expect(
      scoreGroupTable([{ teamId: 10, rank: 1 }], []),
    ).toBe(0);
  });

  it("0 when prediction is empty", () => {
    expect(scoreGroupTable([], actual)).toBe(0);
  });
});
