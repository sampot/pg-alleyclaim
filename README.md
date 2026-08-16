# 巷弄地盤（pg-alleyclaim）

三方在 5×5 台灣夜巷中暗中投入影響力、同時揭曉的八回合策略遊戲。

## 遊玩

直接以靜態伺服器開啟，無需建置：

```sh
python3 -m http.server
```

開啟 `http://localhost:8000/`。在 Playgrounds 中，最高分與靜音設定會透過
`/api/kv/alleyclaim:best`、`/api/kv/alleyclaim:settings` 保存；沒有 KV 或離線時仍可完整遊玩。

## 規則

- 每回合暗中選擇一枚 1～6 影響力與一格，三方同時揭曉。
- 衝突強度＝投入＋上下左右自家地盤數。每人每局可用一次「里民大會」，令支援加倍。
- 最高者佔領；最高分並列時全數撤回，棋子不淘汰。
- 市場、廟口每回 2 分；公園、派出所每回 1 分；至少三格相連路線再加 2 分。
- 八回合後依累積分排名。

## 測試

```sh
npx vitest run
```

專案不含 `package.json`、建置步驟或已提交的依賴。程式採 MIT；第三方素材見
[`ATTRIBUTION.md`](./ATTRIBUTION.md) 及 `assets/licenses/`。
