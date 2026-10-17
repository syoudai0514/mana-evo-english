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

- 子どもの声は WAV で `english-talk` に送り、Gemini が聞き取りと返事を1回で返す
- `english-talk` はログイン中（mana-evo と同じ app-save-hub アカウント）のユーザーだけが使える
- モデルは `GEMINI_MODELS`（既定 `gemini-3.1-flash-lite,gemini-3.5-flash`）の順に使い、上限（429）なら次へ。全部上限なら「きょうは おしまい」
- 記録は端末内（localStorage）に保存

## Supabase の設定（初回だけ）

Supabase ダッシュボード → app-save-hub → Edge Functions → Secrets で次を登録する。

| 名前 | 値 |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio の API キー |
| `GEMINI_MODELS`（任意） | 使うモデルをカンマ区切りで。例 `gemini-3.1-flash-lite,gemini-3.5-flash` |

## 開発

```bash
npm ci
npm test
npm run dev        # http://localhost:5173/?mock=1 でAIなしのダミー相手と会話できる
npm run build
```

`?mock=1` は端末に記憶される。`?mock=0` で解除。
