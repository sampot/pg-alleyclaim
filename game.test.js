import { describe, expect, it } from "vitest";
import {
  adjacentCells,
  createGame,
  resolveConflict,
  resolveTurn,
  scoreBoard,
} from "./game.js";

describe("巷弄地盤 rules", () => {
  it("uses orthogonal street adjacency without wrapping", () => {
    expect(adjacentCells(0)).toEqual([1, 5]);
    expect(adjacentCells(12)).toEqual([7, 11, 13, 17]);
    expect(adjacentCells(24)).toEqual([19, 23]);
  });

  it("resolves simultaneous investments instead of move order", () => {
    const board = Array(25).fill(null);
    const result = resolveConflict(board, 6, [
      { playerId: "player", piece: 3 },
      { playerId: "red", piece: 5 },
    ]);
    expect(result.winner).toBe("red");
    expect(result.investment).toBe(5);
    expect(result.retreats).toEqual(["player"]);
  });

  it("makes every contender retreat on a three-way tie", () => {
    const board = Array(25).fill(null);
    const result = resolveConflict(board, 12, [
      { playerId: "player", piece: 4 },
      { playerId: "red", piece: 4 },
      { playerId: "blue", piece: 4 },
    ]);
    expect(result.winner).toBe(null);
    expect(result.retreats).toHaveLength(3);
  });

  it("clears a defended cell when the incumbent ties a challenger", () => {
    const game = createGame({ seed: 3 });
    game.board[6] = { owner: "red", investment: 4 };
    game.players.red.pieces = [1, 2, 3, 5, 6];
    const next = resolveTurn(
      game,
      { piece: 4, cell: 6, assembly: false },
      [
        { playerId: "red", piece: 1, cell: 0, assembly: false },
        { playerId: "blue", piece: 1, cell: 24, assembly: false },
      ],
    );
    expect(next.board[6]).toBe(null);
    expect(next.players.red.pieces).toContain(4);
    expect(next.players.player.pieces).toContain(4);
  });

  it("adds support from adjacent friendly territory", () => {
    const board = Array(25).fill(null);
    board[7] = { owner: "player", investment: 1 };
    board[11] = { owner: "player", investment: 2 };
    const result = resolveConflict(board, 12, [
      { playerId: "player", piece: 2 },
      { playerId: "red", piece: 3 },
    ]);
    expect(result.strengths.player).toBe(4);
    expect(result.winner).toBe("player");
  });

  it("doubles support once with 里民大會", () => {
    const board = Array(25).fill(null);
    board[7] = { owner: "player", investment: 1 };
    board[11] = { owner: "player", investment: 1 };
    const result = resolveConflict(board, 12, [
      { playerId: "player", piece: 1, assembly: true },
      { playerId: "red", piece: 4 },
    ]);
    expect(result.strengths.player).toBe(5);
    expect(result.winner).toBe("player");
  });

  it("scores landmarks at their per-turn values", () => {
    const board = Array(25).fill(null);
    board[2] = { owner: "player", investment: 1 };
    board[10] = { owner: "player", investment: 1 };
    board[14] = { owner: "red", investment: 1 };
    board[22] = { owner: "player", investment: 1 };
    expect(scoreBoard(board)).toMatchObject({ player: 5, red: 1 });
  });

  it("awards +2 for each owner with a connected three-cell route", () => {
    const board = Array(25).fill(null);
    board[5] = { owner: "player", investment: 1 };
    board[6] = { owner: "player", investment: 1 };
    board[7] = { owner: "player", investment: 1 };
    expect(scoreBoard(board).player).toBe(2);
  });

  it("occupies an empty cell and returns losing pieces to supply", () => {
    const game = createGame({ seed: 9 });
    const next = resolveTurn(game, { piece: 2, cell: 0, assembly: false }, [
      { playerId: "red", piece: 1, cell: 0, assembly: false },
      { playerId: "blue", piece: 3, cell: 24, assembly: false },
    ]);
    expect(next.board[0].owner).toBe("player");
    expect(next.board[24].owner).toBe("blue");
    expect(next.players.player.pieces).toContain(1);
    expect(next.players.player.pieces).not.toContain(2);
  });

  it("ends after exactly eight simultaneous turns", () => {
    let game = createGame({ seed: 22 });
    for (let turn = 0; turn < 8; turn += 1) {
      const piece = game.players.player.pieces[0];
      game = resolveTurn(game, { piece, cell: turn, assembly: false });
    }
    expect(game.turn).toBe(8);
    expect(game.phase).toBe("ended");
    expect(game.ranking).toHaveLength(3);
    expect(() => resolveTurn(game, { piece: 1, cell: 0 })).toThrow(/結束/);
  });
});
