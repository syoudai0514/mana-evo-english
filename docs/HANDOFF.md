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
- [ ] PR 作成、証跡と引き継ぎ更新

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
