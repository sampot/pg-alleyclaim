import { AlleyAudio } from "./audio.js";
import { LANDMARKS, createGame, resolveTurn } from "./game.js";
import {
  loadBest,
  loadSettings,
  saveBest,
  saveSettings,
} from "./persist.js";

const $ = (selector) => document.querySelector(selector);
const ownerNames = { player: "你", red: "紅燈阿伯", blue: "藍衫里長" };
const ownerClasses = { player: "owner-player", red: "owner-red", blue: "owner-blue" };

const settings = await loadSettings();
const audio = new AlleyAudio(settings);
let best = await loadBest();
let game = null;
let selectedCell = null;
let selectedPiece = null;

$("#best-score").textContent = String(best);

function updateSoundButton() {
  $("#sound-toggle").textContent = audio.muted ? "♩ 靜音中" : "♪ 音效開";
  $("#sound-toggle").setAttribute("aria-pressed", String(!audio.muted));
}
updateSoundButton();

function cellName(index) {
  const landmark = LANDMARKS[index];
  return landmark ? `${landmark.name}（每回 ${landmark.points} 分）` : `第 ${Math.floor(index / 5) + 1} 街 ${index % 5 + 1} 弄`;
}

function renderBoard() {
  $("#board").innerHTML = game.board
    .map((cell, index) => {
      const landmark = LANDMARKS[index];
      const ownerClass = cell ? ownerClasses[cell.owner] : "";
      const selected = index === selectedCell ? "selected" : "";
      const content = cell
        ? `<span class="token" aria-label="${ownerNames[cell.owner]}影響力 ${cell.investment}">${cell.investment}</span>`
        : "";
      return `
        <button class="cell ${ownerClass} ${selected}" type="button" role="gridcell"
          data-cell="${index}" aria-label="${cellName(index)}${cell ? `，${ownerNames[cell.owner]}佔領，影響力 ${cell.investment}` : "，空地"}"
          aria-selected="${index === selectedCell}">
          ${landmark ? `<span class="landmark" aria-hidden="true">${landmark.icon}${landmark.points}</span>` : ""}
          ${content}
        </button>`;
    })
    .join("");
  document.querySelectorAll("[data-cell]").forEach((button) => {
    button.addEventListener("click", () => selectCell(Number(button.dataset.cell)));
  });
}

function renderPieces() {
  $("#piece-picker").innerHTML = game.players.player.pieces
    .map(
      (piece) => `
        <button class="piece ${selectedPiece === piece ? "selected" : ""}" type="button"
          data-piece="${piece}" aria-pressed="${selectedPiece === piece}" aria-label="影響力 ${piece}">
          ${piece}
        </button>`,
    )
    .join("");
  document.querySelectorAll("[data-piece]").forEach((button) => {
    button.addEventListener("click", () => selectPiece(Number(button.dataset.piece)));
  });
}

function renderHud() {
  $("#turn-value").textContent = `${Math.min(game.turn + 1, 8)} / 8`;
  $("#score-value").textContent = String(game.players.player.score);
  $("#gain-value").textContent = `+${game.lastScores.player}`;
  for (const id of ["player", "red", "blue"]) {
    $(`#${id}-score`).textContent = String(game.players[id].score);
  }
  const available = game.players.player.assemblyAvailable;
  $("#assembly").disabled = !available;
  $("#assembly-label").classList.toggle("used", !available);
  if (!available) {
    $("#assembly").checked = false;
    $("#assembly-label small").textContent = "本局已經召開過";
  } else {
    $("#assembly-label small").textContent = "限一次：本回合相鄰支援加倍";
  }
}

function updateReady() {
  const ready = selectedCell !== null && selectedPiece !== null;
  $("#reveal-button").disabled = !ready;
  $("#message").textContent = ready
    ? `已密封：影響力 ${selectedPiece} → ${cellName(selectedCell)}`
    : selectedCell === null
      ? "先點地圖上的目標巷弄。"
      : "再選一枚影響力。";
}

function selectCell(cell) {
  selectedCell = cell;
  $("#target-label").textContent = cellName(cell);
  audio.play("click");
  renderBoard();
  updateReady();
}

function selectPiece(piece) {
  selectedPiece = piece;
  audio.play("click");
  renderPieces();
  updateReady();
}

function renderGame() {
  renderHud();
  renderBoard();
  renderPieces();
  updateReady();
}

function revealSummary(reveal) {
  const moveText = reveal.moves
    .map((move) => `${ownerNames[move.playerId]} ${move.piece}${move.assembly ? "＋大會" : ""}`)
    .join("　");
  const winner = reveal.winner ? `${ownerNames[reveal.winner]}守住` : "同票，全撤";
  return `
    <div class="reveal-item">
      <span>${cellName(reveal.cell)}</span><strong>${winner}</strong>
      <small>${moveText} · 戰力 ${Object.entries(reveal.strengths).map(([id, value]) => `${ownerNames[id]} ${value}`).join("／")}</small>
    </div>`;
}

async function showTurnResult() {
  const playerReveal = game.lastReveal.find((reveal) =>
    reveal.moves.some((move) => move.playerId === "player"),
  );
  $("#result-kicker").textContent = game.phase === "ended" ? "八回合總清算" : `第 ${game.turn} 回合揭曉`;
  if (game.phase === "ended") {
    const rank = game.ranking.findIndex((entry) => entry.id === "player") + 1;
    best = await saveBest(game.players.player.score, best);
    $("#best-score").textContent = String(best);
    $("#result-title").textContent = rank === 1 ? "整條巷子都聽你的！" : `這局拿下第 ${rank} 名`;
    $("#result-content").innerHTML = `
      <p>地盤不是佔越多越好，能守住地標、串成路線才有分。</p>
      <ol class="ranking">${game.ranking
        .map(
          (entry, index) =>
            `<li class="${entry.id === "player" ? "is-player" : ""}"><span>${["🥇", "🥈", "🥉"][index]} ${entry.name}</span><strong>${entry.score} 分</strong></li>`,
        )
        .join("")}</ol>`;
    $("#continue-button").textContent = "再喬一局";
    audio.play(rank === 1 ? "win" : "reveal");
  } else {
    const won = playerReveal?.winner === "player";
    $("#result-title").textContent = won ? "這條巷子，有人挺你！" : playerReveal?.winner ? "對面人脈比較厚…" : "三方互看，全部撤回！";
    $("#result-content").innerHTML = `
      <div class="reveal-list">${game.lastReveal.map(revealSummary).join("")}</div>
      <p>本回合：你 +${game.lastScores.player}、紅 +${game.lastScores.red}、藍 +${game.lastScores.blue}</p>`;
    $("#continue-button").textContent = "摸黑布局下一回";
    audio.play(won ? "win" : "reveal");
  }
  $("#result-sheet").hidden = false;
  $("#continue-button").focus();
}

$("#start-button").addEventListener("click", async () => {
  await audio.start();
  audio.play("click");
  game = createGame({ seed: Date.now() });
  globalThis.__alleyclaim = { getGame: () => game };
  selectedCell = null;
  selectedPiece = null;
  $("#lobby").hidden = true;
  $("#game").hidden = false;
  renderGame();
  $("#board .cell").focus();
});

$("#reveal-button").addEventListener("click", () => {
  if (selectedCell === null || selectedPiece === null) return;
  try {
    game = resolveTurn(game, {
      cell: selectedCell,
      piece: selectedPiece,
      assembly: $("#assembly").checked,
    });
    selectedCell = null;
    selectedPiece = null;
    $("#assembly").checked = false;
    renderGame();
    void showTurnResult();
  } catch (error) {
    $("#message").textContent = error.message;
  }
});

$("#continue-button").addEventListener("click", () => {
  audio.play("click");
  $("#result-sheet").hidden = true;
  if (game.phase === "ended") {
    game = null;
    $("#game").hidden = true;
    $("#lobby").hidden = false;
    $("#start-button").focus();
  } else {
    $("#board .cell").focus();
  }
});

$("#sound-toggle").addEventListener("click", () => {
  audio.setMuted(!audio.muted);
  updateSoundButton();
  void saveSettings({ muted: audio.muted });
  if (!audio.muted) audio.play("click");
});

$("#how-button").addEventListener("click", () => {
  $("#about-sheet").hidden = false;
  $("#about-close").focus();
  audio.play("click");
});

$("#about-close").addEventListener("click", () => {
  $("#about-sheet").hidden = true;
  $("#how-button").focus();
  audio.play("click");
});
