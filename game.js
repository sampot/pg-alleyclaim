export const SIZE = 5;
export const MAX_TURNS = 8;
export const LANDMARKS = Object.freeze({
  2: { name: "市場", icon: "市", points: 2 },
  10: { name: "廟口", icon: "廟", points: 2 },
  14: { name: "公園", icon: "園", points: 1 },
  22: { name: "派出所", icon: "警", points: 1 },
});

const PLAYER_IDS = ["player", "red", "blue"];
const PIECES = [1, 2, 3, 4, 5, 6];

function hash(seed, value) {
  let n = (seed ^ Math.imul(value + 1, 0x9e3779b1)) >>> 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x21f0aaad);
  n ^= n >>> 15;
  return (n ^ Math.imul(n, 0x735a2d97)) >>> 0;
}

export function adjacentCells(cell) {
  const row = Math.floor(cell / SIZE);
  const column = cell % SIZE;
  const result = [];
  if (row > 0) result.push(cell - SIZE);
  if (column > 0) result.push(cell - 1);
  if (column < SIZE - 1) result.push(cell + 1);
  if (row < SIZE - 1) result.push(cell + SIZE);
  return result;
}

function supportAt(board, cell, playerId) {
  return adjacentCells(cell).filter((index) => board[index]?.owner === playerId)
    .length;
}

export function resolveConflict(board, cell, moves) {
  const strengths = {};
  for (const move of moves) {
    const support = supportAt(board, cell, move.playerId);
    strengths[move.playerId] = move.piece + support * (move.assembly ? 2 : 1);
  }
  const highest = Math.max(...Object.values(strengths));
  const leaders = moves.filter(
    (move) => strengths[move.playerId] === highest,
  );
  const winner = leaders.length === 1 ? leaders[0] : null;
  return {
    cell,
    winner: winner?.playerId ?? null,
    investment: winner?.piece ?? 0,
    strengths,
    retreats: moves
      .filter((move) => move.playerId !== winner?.playerId)
      .map((move) => move.playerId),
  };
}

function hasRoute(board, owner) {
  const owned = board
    .map((cell, index) => (cell?.owner === owner ? index : -1))
    .filter((index) => index >= 0);
  const visited = new Set();
  for (const start of owned) {
    if (visited.has(start)) continue;
    const queue = [start];
    visited.add(start);
    let size = 0;
    while (queue.length) {
      const current = queue.shift();
      size += 1;
      for (const next of adjacentCells(current)) {
        if (board[next]?.owner === owner && !visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    if (size >= 3) return true;
  }
  return false;
}

export function scoreBoard(board) {
  const scores = Object.fromEntries(PLAYER_IDS.map((id) => [id, 0]));
  for (const [cell, landmark] of Object.entries(LANDMARKS)) {
    const owner = board[Number(cell)]?.owner;
    if (owner) scores[owner] = (scores[owner] ?? 0) + landmark.points;
  }
  for (const owner of PLAYER_IDS) {
    if (hasRoute(board, owner)) scores[owner] += 2;
  }
  return scores;
}

function makePlayer(name) {
  return {
    name,
    pieces: [...PIECES],
    assemblyAvailable: true,
    score: 0,
  };
}

export function createGame({ seed = Date.now() } = {}) {
  return {
    seed: Number(seed) >>> 0,
    turn: 0,
    maxTurns: MAX_TURNS,
    phase: "planning",
    board: Array(25).fill(null),
    players: {
      player: makePlayer("你"),
      red: makePlayer("紅燈阿伯"),
      blue: makePlayer("藍衫里長"),
    },
    lastReveal: [],
    lastScores: { player: 0, red: 0, blue: 0 },
    ranking: null,
  };
}

function chooseAiMove(game, playerId, salt) {
  const player = game.players[playerId];
  const pieces = player.pieces.length ? player.pieces : PIECES;
  const landmarkCells = Object.keys(LANDMARKS).map(Number);
  const candidates = [
    ...landmarkCells.filter((cell) => game.board[cell]?.owner !== playerId),
    ...game.board
      .map((cell, index) => (!cell ? index : -1))
      .filter((index) => index >= 0),
    ...Array.from({ length: 25 }, (_, index) => index),
  ];
  const roll = hash(game.seed + salt, game.turn);
  const cell = candidates[roll % candidates.length];
  const piece = pieces[(roll >>> 5) % pieces.length];
  const assembly =
    player.assemblyAvailable &&
    game.turn >= 3 &&
    (LANDMARKS[cell] || roll % 7 === 0);
  return { playerId, piece, cell, assembly };
}

function ensureSupply(player) {
  if (player.pieces.length === 0) player.pieces = [...PIECES];
}

function returnPiece(player, piece) {
  if (PIECES.includes(piece) && !player.pieces.includes(piece)) {
    player.pieces.push(piece);
    player.pieces.sort((a, b) => a - b);
  }
}

function rankingFor(players) {
  return PLAYER_IDS.map((id) => ({
    id,
    name: players[id].name,
    score: players[id].score,
  })).sort(
    (a, b) =>
      b.score - a.score ||
      (a.id === "player" ? -1 : b.id === "player" ? 1 : a.id.localeCompare(b.id)),
  );
}

export function resolveTurn(game, playerMove, suppliedAiMoves) {
  if (game.phase === "ended") throw new Error("地盤戰已經結束");
  if (!Number.isInteger(playerMove?.cell) || playerMove.cell < 0 || playerMove.cell > 24) {
    throw new Error("請選擇一條巷弄");
  }
  const players = Object.fromEntries(
    PLAYER_IDS.map((id) => [
      id,
      { ...game.players[id], pieces: [...game.players[id].pieces] },
    ]),
  );
  for (const player of Object.values(players)) ensureSupply(player);

  const aiMoves =
    suppliedAiMoves ??
    [chooseAiMove(game, "red", 71), chooseAiMove(game, "blue", 193)];
  const moves = [
    { ...playerMove, playerId: "player" },
    ...aiMoves.map((move, index) => ({
      ...move,
      playerId: move.playerId ?? (index === 0 ? "red" : "blue"),
    })),
  ];
  for (const move of moves) {
    if (!players[move.playerId].pieces.includes(move.piece)) {
      throw new Error(`${players[move.playerId].name} 沒有這枚影響力`);
    }
    players[move.playerId].pieces = players[move.playerId].pieces.filter(
      (piece) => piece !== move.piece,
    );
    if (move.assembly) players[move.playerId].assemblyAvailable = false;
  }

  const board = game.board.map((cell) => (cell ? { ...cell } : null));
  const grouped = new Map();
  for (const move of moves) {
    const group = grouped.get(move.cell) ?? [];
    group.push(move);
    grouped.set(move.cell, group);
  }
  const reveals = [];
  for (const [cell, challengers] of grouped) {
    const incumbent = game.board[cell];
    const incumbentMoved = challengers.some(
      (move) => move.playerId === incumbent?.owner,
    );
    const contenders =
      incumbent && !incumbentMoved
        ? [
            ...challengers,
            {
              playerId: incumbent.owner,
              piece: incumbent.investment,
              cell,
              assembly: false,
              incumbent: true,
            },
          ]
        : challengers;
    const result = resolveConflict(game.board, cell, contenders);
    const winnerMove = contenders.find(
      (move) => move.playerId === result.winner,
    );
    for (const move of contenders) {
      if (move.playerId !== result.winner) {
        returnPiece(players[move.playerId], move.piece);
      }
    }
    if (!winnerMove) {
      board[cell] = null;
    } else if (winnerMove.incumbent) {
      board[cell] = incumbent;
    } else {
      if (incumbent && incumbent.owner === winnerMove.playerId) {
        returnPiece(players[incumbent.owner], incumbent.investment);
      }
      board[cell] = {
        owner: winnerMove.playerId,
        investment: winnerMove.piece,
      };
    }
    reveals.push({ ...result, moves: challengers });
  }

  const lastScores = scoreBoard(board);
  for (const id of PLAYER_IDS) players[id].score += lastScores[id];
  const turn = game.turn + 1;
  const ended = turn >= MAX_TURNS;
  if (!ended) {
    for (const player of Object.values(players)) ensureSupply(player);
  }
  return {
    ...game,
    turn,
    phase: ended ? "ended" : "planning",
    board,
    players,
    lastReveal: reveals,
    lastScores,
    ranking: ended ? rankingFor(players) : null,
  };
}
