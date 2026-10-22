# コンテンツ・基盤バックログ

新規教材の量産は未実施。以下は制作目標で、アプリの提供済み件数ではありません。各Issueに最初の小バッチ・担当範囲・受入条件があります。

| Issue | 作業 |
|---|---|
| [#2](https://github.com/syoudai0514/mana-evo-english/issues/2) | [教材 P1] 子供の5つの冒険ワールド：60アクティビティ・300フレーズ |
| [#3](https://github.com/syoudai0514/mana-evo-english/issues/3) | [教材 P1] フォニックス：26文字見直し＋CVC60語＋聞き分け24組 |
| [#4](https://github.com/syoudai0514/mana-evo-english/issues/4) | [教材 P1] 大人の会話72場面×3難度：話して使える216レッスン |
| [#5](https://github.com/syoudai0514/mana-evo-english/issues/5) | [基盤 P1] TOEIC 全7パートの出題形式・共有素材・計時を実装 |
| [#6](https://github.com/syoudai0514/mana-evo-english/issues/6) | [教材 P1] TOEIC オリジナル600問：全7パート3セットと日本語解説 |
| [#7](https://github.com/syoudai0514/mana-evo-english/issues/7) | [教材 P2] 聞く学習36エピソード：会話・仕事・旅の各12本 |
| [#8](https://github.com/syoudai0514/mana-evo-english/issues/8) | [教材 P2] 復習240フレーズ・シャドーイング60文の基礎パック |
| [#9](https://github.com/syoudai0514/mana-evo-english/issues/9) | [教材 P3] お話づくり24話・世界の友達12場面を段階的に実装 |
| [#10](https://github.com/syoudai0514/mana-evo-english/issues/10) | [基盤 P1] 本番音声・認証・子供の保護・データ保存を検証/強化 |
| [#11](https://github.com/syoudai0514/mana-evo-english/issues/11) | [基盤 P2] 会話画面の責務分割・アクセシビリティ・PWA回帰検証 |

## 推奨順序

1. #10 の接続・保護を実機で確認。#2 の3アクティビティ、#4 の12レッスンを小さく接続。
2. #3 のフォニックス初回バッチ、#5 の全パート基盤。その後 #6 の30問→200問→600問。
3. #8 の復習、#7 の聞く教材。教材横断のphrase IDを共有し重複を抑える。
4. #9 は再生/分岐の基盤ができてから。#11 は既存の回帰テストを維持し1責務ずつ。

クラウド保存は既存 [#1](https://github.com/syoudai0514/mana-evo-english/issues/1) を継承する。

## 次のモデルへの指示例

> docs/HANDOFF.md と docs/CONTENT_SPEC.md を読み、Issue #2 の最初の3アクティビティだけを実装してください。既存の進捗を保持し、生成→形式検証→学習画面接続→ブラウザ確認→コミットまで進め、完了数と次の作業をHANDOFFへ追記してください。全60回の生成はまだしないでください。

モデル名に依存した仕組みは不要です。6.1sol / opus5.5 / その他でも同じファイルとIssueから再開できます。

