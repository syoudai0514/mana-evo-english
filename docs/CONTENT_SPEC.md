# 教材の制作・受入仕様 v1（後続実装用）

これは次フェーズで採用するデータ契約の設計であり、現行アプリがすべての形式を読み込めるという意味ではない。まず各Issueの初回バッチでloader/validator/画面接続を作る。既存データを一括置換しない。

## 共通メタデータ

| フィールド | 内容 |
|---|---|
| id | `kids.home.001` / `adult.travel.a1.001` など安定したID。公開後に使い回さない |
| version | 教材の整数版。正解や意味が変わるときに更新 |
| kind | kids-activity / phonics / conversation / toeic / listening / phrase / shadow / story |
| title | ja / en。子供の表示は年齢に合った表記 |
| level | Pre-A1 / A1 / A2 / B1、TOEICは編集上の難度タグ。資格認定ではない |
| goals | 1〜3個の観察可能な目標。「理解する」より「注文を1つ伝える」 |
| estimatedMinutes | 正の数。所要時間の保証ではない |
| prerequisites | 必要な教材ID。未実装の教材を参照しない |
| phrases | phrase ID の参照。会話由来カードとはsourceを分離 |
| assets | 下記の画像/音声情報への参照 |
| rights | original/licensed、作者、必要ならライセンスURL・帰属表示 |
| review | draft / language-reviewed / learning-reviewed / published、確認者・日付・未確認事項 |

`published` は件数を満たしただけでは付けない。まず生成者とは別の観点で英語の自然さ、和訳、対象年齢、正解、音声を確認する。確認者がいない場合は draft のまま。

## 種類ごとの差分

- **子供**：world、mode（free/play/guess）、導入、やりとり3つ、2段階ヒント、日本語救済、成功の言葉、相棒別の短い反応。発話しない選択も用意。
- **会話**：situation、roles、6〜10発話のモデル、個人化質問、repair phrases（聞き返し）、recasts、明示的な終了目標。
- **TOEIC**：stimulus（音声/写真/文書群）と questions を分離。各問はpart、skill、prompt、choices、answerIndex、evidence、全選択肢の解説、和訳。模試用セットは通常練習の抽選から除外。
- **聞く教材**：script（speaker/en/ja）、再生順、時間区間、重要表現、確認問題、事前取得の可否。
- **復習**：en/ja、使用場面、同義表現、音声、sourceLessonId。登録時から全量をdueにしない。
- **シャドーイング**：区切り/強勢/連結の注釈、基準音声。ASR文字列比較は「単語の一致率」と呼ぶ。
- **分岐物語**：scene ID、選択肢の移動先、終端。全ノード到達可能、すべての開始点から終端に到達できること。

## 素材の契約

asset ID、version、URL、MIME、bytes、checksum、rights、alt/transcriptを保持。音声はspeaker、accent、duration、タイミング、収録/合成の区別を持つ。実ファイルがないものを完成扱いにしない。画像の代替テキストが設問の答えを漏らす場合は練習補助と模試の扱いを分ける。

## バッチを出す前の確認

1. 件数・一意なID・参照先・空フィールド・長さ上限を機械検証。
2. 正解番号の範囲、各partの選択肢数、共有素材と質問数、日付/金額の整合を検証。
3. 英文/訳/音声が一致。問題は一意に解ける。重複文・似すぎる誤答を検出。
4. 320px/390pxで長い文章・空状態・読込失敗を確認。本文の200%拡大とキーボード操作も確認。
5. 音声は生成しただけで済ませず再生して確認。録音・APIコストの実測値と確認条件を残す。
6. 子供向けは秘密・所在地・連絡先・課金を要求しない。誤答・休んだ日を責めない。
7. 生成数、reviewed数、公開数を分けてIssueに記載。既存教材との重複は総数に足さない。

## 省トークンでの進め方

全ファイルの読み直しは避け、この仕様→対象Issue→変更するデータ/loaderの順に読む。3〜12教材程度を1バッチとして、対応する検証だけを実行する。共通仕様はIssueに再生成せずこのファイルを参照する。作業停止前はHANDOFFの「直近の状態」を更新する。
