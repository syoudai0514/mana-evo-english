# mana-evo-english（マナエボ英語）

mana-evo の英語に特化した姉妹アプリ。mana-evo のモンスターと毎日英語でおしゃべりする iPhone 向け PWA。
起動時の「だれが はなす？」から、パパ・ママ向けの大人モード（Alex との雑談・復習カード・シャドーイング・TOEIC 診断）にも入れる。

公開先：https://mana-evo-english.vercel.app/（main に入ると Vercel が自動で公開）

- 再開・引き継ぎ：[`docs/HANDOFF.md`](docs/HANDOFF.md)
- 横断レビュー：[`docs/review/2026-10-21.md`](docs/review/2026-10-21.md)
- 定量的な制作計画：[`docs/CONTENT_BACKLOG.md`](docs/CONTENT_BACKLOG.md) / [`docs/CONTENT_SPEC.md`](docs/CONTENT_SPEC.md)
- コンセプト：[`docs/CONCEPT.md`](docs/CONCEPT.md)
- モックアップ：[`design/mockups/`](design/mockups/)
- Supabase 連携（mana-evo とのデータ連携）：issue #1

## しくみ

| 部分 | 場所 |
|---|---|
| 画面（Vite + React） | `src/screens/` |
| 会話のバリエーション（相棒・段階・話題・ごっこ・あてっこ） | `src/data/` |
| 会話指示の組み立て | `src/data/prompt.js`（大人は `src/data/adult.js`） |
| 大人モードの記録（記憶・復習カード・TOEIC・予想スコア） | `src/lib/adult.js` |
| 録音（16kHz WAV）・読み上げ・ログイン・状態 | `src/lib/` |
| Gemini 中継（Supabase Edge Function） | `supabase/functions/english-talk/` |

- 会話は Gemini Live API（リアルタイム音声）。`english-talk` が使い捨て接続キーを発行し、ブラウザが直接つなぐ（`src/lib/live.js`）
- 読み・ひらがなの意味・ヒント・記憶は、音を鳴らさない裏方の Live が関数 `show_card` で渡す（`src/lib/annotator.js`。大人の TOEIC 問題 `make_questions`・発音のコツ `pron_tips` も同じしくみ）。子どもの声は Gemini 3.5 Transcribe Live で文字にして相棒に渡す（`src/lib/transcriber.js`）。モデルの利用可否・料金・上限は接続先の契約と現行仕様を確認してください
- Live が切れたらつなぎなおし、だめなら「つながらなかったよ」を出す。1回ずつ送る方式（`sendTurn`）は確認用の `?mock=1` だけで使う
- `english-talk` はログイン中（mana-evo と同じ app-save-hub アカウント）のユーザーだけが使える
- 記録は端末内（localStorage）に保存

## Supabase の設定（初回だけ）

Supabase ダッシュボード → app-save-hub → Edge Functions → Secrets で次を登録する。

| 名前 | 値 |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio の API キー |
| `GEMINI_LIVE_MODEL`（任意） | Live のモデルを固定したいとき。未設定なら「3 Flash Live」→「3.8 Live」の順で自動で選ぶ（保護者画面の設定が最優先） |
| `GEMINI_MODELS`（任意） | 予備の方式と読み付けに使うモデル。例 `gemini-3.1-flash-lite,gemini-3.5-flash` |

## 開発

```bash
npm ci
npm test
npm run dev        # http://localhost:5173/?mock=1 でAIなしのダミー相手と会話できる
npm run build
npx playwright install chromium
npm run test:e2e    # AIを使わない登録・学習・保存・レスポンシブ検証
```

`?mock=1` は端末に記憶される。`?mock=0` で解除。


## 体験刷新（2026-10）

- 初回から子供/大人を選択できます。大人だけでも登録でき、設定からAI会話にログインできます。
- 子供：相棒の庭、今日の文字、おしゃべり、ごっこ、あてっこ。未実装の story/world は主導線に出しません。
- 大人：会話/TOEIC/聞く学習を切替。短め/じっくりの実際のプラン時間・枚数を表示します。
- 子供の文字学習・大人の復習だけの日も週の記録に残します。既存の保存キーは維持しています。
- TOEICは現状全7パート対応ではなく、換算値は未校正です。発音の表示は文字起こしとの単語一致率です。
- 教材の制作目標はIssue #2〜#9、基盤強化は #10〜#11。今回量産していません。

ブラウザ検証で既存Chromiumを使う場合：
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`

`mee-keys=1` をlocalStorageに設定すると、確認用に子供の会話でも文字入力できます。
本番の音声・iOSマイク・Supabase認証の接続確認は、mock検証とは別途必要です。
