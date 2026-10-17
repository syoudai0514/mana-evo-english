# mana-evo-english（マナエボ英語）

mana-evo の英語に特化した姉妹アプリ。mana-evo のモンスターと毎日英語でおしゃべりする iPhone 向け PWA。

- コンセプト：[`docs/CONCEPT.md`](docs/CONCEPT.md)
- モックアップ：[`design/mockups/`](design/mockups/)
- Supabase 連携（mana-evo とのデータ連携）：issue #1

## しくみ

| 部分 | 場所 |
|---|---|
| 画面（Vite + React） | `src/screens/` |
| 会話のバリエーション（相棒・段階・話題・ごっこ・あてっこ） | `src/data/` |
| 会話指示の組み立て | `src/data/prompt.js` |
| 録音（16kHz WAV）・読み上げ・ログイン・状態 | `src/lib/` |
| Gemini 中継（Supabase Edge Function） | `supabase/functions/english-talk/` |

- 会話は Gemini Live API（リアルタイム音声）。`english-talk` が使い捨て接続キーを発行し、ブラウザが直接つなぐ（`src/lib/live.js`）
- 読み・訳・ヒント・記憶は1往復ごとに `english-talk` のふつうの呼び出し（3.1 Flash-Lite）で作る
- Live につながらないときは、16kHz の WAV を1回ずつ送る方式に自動で切り替える。モデルは `GEMINI_MODELS`（既定 `gemini-3.1-flash-lite,gemini-3.5-flash`）の順に使い、全部上限なら「きょうは おしまい」
- `english-talk` はログイン中（mana-evo と同じ app-save-hub アカウント）のユーザーだけが使える
- 記録は端末内（localStorage）に保存

## Supabase の設定（初回だけ）

Supabase ダッシュボード → app-save-hub → Edge Functions → Secrets で次を登録する。

| 名前 | 値 |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio の API キー |
| `GEMINI_LIVE_MODEL`（任意） | Live のモデルを固定したいとき。未設定なら使えるものから「3 Flash Live」を優先して自動で選ぶ |
| `GEMINI_MODELS`（任意） | 予備の方式と読み付けに使うモデル。例 `gemini-3.1-flash-lite,gemini-3.5-flash` |

## 開発

```bash
npm ci
npm test
npm run dev        # http://localhost:5173/?mock=1 でAIなしのダミー相手と会話できる
npm run build
```

`?mock=1` は端末に記憶される。`?mock=0` で解除。
