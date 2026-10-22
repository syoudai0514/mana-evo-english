# 現在の依頼（2026-10-22追記）

ユーザーが全Issueの実装を依頼。最新の進捗は [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) を参照。
前回の「最初の小バッチのみ」は今回の依頼で拡張済み。段階的に検証しながら最終目標数まで進める。
PR #12はmainへマージ済み。現在の作業ブランチは `feat/complete-learning-backlog`。


今回の実装は **758教材＋TOEIC600問**。 [英語PR #13](https://github.com/syoudai0514/mana-evo-english/pull/13) にpush済み。完成扱いにする前の確認待ちは進捗表の右列を参照。
- `src/content/`: 固定ID/version/権利/draft付き。`scripts/content-report.mjs` で数える。
- `src/screens/learning/`: 本棚/教材/全Part練習。`src/lib/learning.js` は別キーで既存保存を維持。
- `src/lib/cloudSave.js` / `CloudSettings.jsx`: 英語専用CAS/保全/復元、親PIN、JSON入出力。
- `src/lib/englishRewards.js`: 一方向outbox。受取側は [mana-evo PR #276](https://github.com/syoudai0514/mana-evo/pull/276) に仕様と実装（Draft）。
- `src/hooks/talk/` / `src/components/talk/`: 会話の責務分割。`routes.js` と履歴hookで再開。
- Backendは新しい `english-talk-v2` とguard migrationを適用済み。旧関数は維持。
- 受入完了まではIssueを自動closeしない。録音/教材の独立レビュー/実機/実ログインをmock成功で代用しない。

以下は前回PRの履歴。新しいスコープと進捗は上記を優先する。

---

# 次のモデルへ：体験刷新の引き継ぎ

## 依頼と範囲
子供は親しみのある相棒と毎日楽しむ。大人は会話・TOEIC・聞く学習を楽しむ。
今回は構成・見た目・動く導線を優先。コンテンツ量産は GitHub Issue に必要数・形式・受入条件を残す。
main への push は自動公開されるため、作業ブランチ `feat/learning-experience-refresh` と PR で渡す。

## 再開手順
1. このファイル、`docs/review/2026-10-21.md`、`docs/CONTENT_BACKLOG.md` を読む。
2. `git status` と直近のコミットを確認。未コミット変更を破棄しない。
3. `npm ci && npm test && npm run build`。
4. `npm run dev -- --host 0.0.0.0`、`/?mock=1` で画面確認。`?mock=0` で解除。
5. GitHub Issue の1項目ずつ実装・検証・コミット。大量の教材を一度に生成しない。

## チェックポイント
- [x] リポジトリ特定・既存 Issue #1 確認
- [x] 初期検証：33テストと production build 成功
- [x] コードレビュー：入口、学習メニュー、記録、音声、認証、PWA、CI
- [x] 入口・子供ホーム・大人ホーム刷新
- [x] 重要な導線不具合の修正
- [x] スマホ・デスクトップでブラウザ検証（320/390/768/1280px）
- [x] 定量的な教材 Issue・残課題 Issue 作成（#2〜#11）
- [x] 証跡と引き継ぎ更新。PR/CIの最新状態はGitHubの `feat/learning-experience-refresh` ブランチで確認。

## 制約
本番のログイン資格情報・実機マイクは未提供。mock での動作と本番 AI の検証を混同しない。
Supabase の公開 anon key はクライアント用。秘密キーを要求・記録しない。
ローカル保存の PIN は画面の誤操作防止であり、アカウント認証・暗号化ではない。
TOEIC 換算は未校正。公式スコア達成を断言しない。


## 直近の状態

- 実装コミット：`9636c35`。ブランチはGitHubへpush済み。
- ロジック40件、Chromium E2E9件、production build成功。E2Eはmockで実施。
- 既存mee-state-v1 / mee-adult-v1キーを維持。focus/studyDaysを追加、古い保存をデフォルト補完。
- 単独プラン開始時もcount/minutesを渡す。子供だけ/大人だけ/両方の登録に対応。
- スクリーンショット：`docs/review/images/`。実装の検証境界：`docs/review/VERIFICATION.md`。
- 次の作業：#10の実環境接続検証、#2の3アクティビティ、#4の12レッスン。TOEIC教材#6は基盤#5に依存。
- CSSはlegacy `styles.css`と新しい`experience.css`を併用。旧画面全体のコンポーネント整理は#11。
- 本番のmainには未反映。PRのチェックを確認してからマージする。mainへマージすると既存Vercel設定で自動公開。

## 次のモデルへそのまま渡す文

「mana-evo-english の docs/HANDOFF.md、docs/CONTENT_BACKLOG.md と対象Issueを読み、最初の小バッチだけ実装してください。確認済みの画面・保存形式を維持し、変更範囲を検証してコミット、完了数と次の一手をHANDOFFへ追記してください。」

- 最後の見た目調整：週カレンダーを7列固定、タブレットの飾りを整理。4幅のレイアウトE2Eを再実行して成功。
