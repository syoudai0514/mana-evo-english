// Three different sentence contexts per grammar target. Order: sentence / Japanese meaning.
export const GRAMMAR_ITEMS = [
  [
    [
      'The seminar was highly ___ among new employees.',
      'そのセミナーは新入社員の間でとても人気でした。'
    ],
    [
      'The new cafe has become ___ with local residents.',
      '新しいカフェは近隣の住民に人気が出ています。'
    ],
    [
      'Online booking is increasingly ___ with our guests.',
      'オンライン予約は宿泊客の間でますます人気です。'
    ],
    'popular',
    ['popularity', 'popularly', 'popularize'],
    '形容詞',
    'be動詞の後で主語の性質を表す形容詞 popular が必要です。'
  ],
  [
    [
      'Please send us your ___ by Friday.',
      '金曜日までに確認をお送りください。'
    ],
    [
      'We have received written ___ of the order.',
      '注文の書面による確認を受け取りました。'
    ],
    ['You will receive a ___ after registering.', '登録すると確認が届きます。'],
    'confirmation',
    ['confirm', 'confirmed', 'confirming'],
    '品詞',
    '所有格や冠詞の後で、確認という名詞 confirmation を使います。'
  ],
  [
    [
      'The manager ___ the report every Monday.',
      '責任者は毎週月曜日に報告書を確認します。'
    ],
    [
      'Our receptionist ___ each appointment in advance.',
      '受付係は各予約を事前に確認します。'
    ],
    [
      'The supervisor ___ the schedule before each shift.',
      '監督者は勤務の前に日程を確認します。'
    ],
    'checks',
    ['check', 'checking', 'have checked'],
    '主語と動詞',
    '主語が単数で、習慣を表す現在形なので checks を使います。'
  ],
  [
    [
      'The technicians have ___ the new software.',
      '技術者たちは新しいソフトをインストールしました。'
    ],
    [
      'Our staff have ___ the security update.',
      '職員たちはセキュリティ更新をインストールしました。'
    ],
    [
      'The engineers have ___ a new monitoring system.',
      '技師たちは新しい監視システムを設置しました。'
    ],
    'installed',
    ['install', 'installing', 'installs'],
    '現在完了',
    'haveの後は過去分詞 installed です。'
  ],
  [
    [
      'Please remain seated ___ the presentation.',
      '発表中は着席したままでいてください。'
    ],
    [
      'The office will be closed ___ the holidays.',
      '休暇期間中、事務所は閉まっています。'
    ],
    [
      'No deliveries will be made ___ the renovation.',
      '改装期間中、配達は行われません。'
    ],
    'during',
    ['while', 'because', 'although'],
    '前置詞',
    '後ろに名詞句が続き、期間中を表すので during です。whileには通常節が続きます。'
  ],
  [
    [
      '___ the rain, the outdoor event continued.',
      '雨にもかかわらず、屋外の催しは続きました。'
    ],
    [
      '___ the high cost, the board approved the plan.',
      '高い費用にもかかわらず、理事会は計画を承認しました。'
    ],
    [
      '___ the delay, all orders arrived before noon.',
      '遅延にもかかわらず、すべての注文品は正午前に到着しました。'
    ],
    'Despite',
    ['Although', 'Because', 'Unless'],
    '譲歩',
    '名詞句の前で「〜にもかかわらず」を表す前置詞 Despite が適切です。'
  ],
  [
    [
      'All visitors must wear ___ identification badges.',
      '来客は全員、自分の身分証を着用しなければなりません。'
    ],
    [
      'Employees should check ___ schedules before leaving.',
      '従業員は帰る前に自分の予定を確認すべきです。'
    ],
    [
      'Participants will receive ___ certificates by email.',
      '参加者は自分の修了証をメールで受け取ります。'
    ],
    'their',
    ['they', 'them', 'theirs'],
    '代名詞',
    '名詞を修飾する所有格 their を使います。'
  ],
  [
    [
      '___ applicant is required to provide two references.',
      '各応募者は推薦者を2名提示する必要があります。'
    ],
    [
      '___ ticket includes a complimentary drink.',
      '各チケットには無料の飲み物が含まれています。'
    ],
    [
      '___ participant receives a workbook.',
      '各参加者にはワークブックが配られます。'
    ],
    'Each',
    ['All', 'Both', 'Many'],
    '限定詞',
    '単数名詞と単数動詞に合う Each です。'
  ],
  [
    [
      'The express service is ___ than the standard option.',
      '速達サービスは通常の選択肢より速いです。'
    ],
    [
      'The new system is ___ than the one we used before.',
      '新しいシステムは以前のものより速いです。'
    ],
    [
      'Traveling by train is ___ than taking the local bus.',
      '電車での移動は各駅停車のバスより速いです。'
    ],
    'faster',
    ['fast', 'fastest', 'fastly'],
    '比較級',
    'thanに対応する比較級 faster を使います。'
  ],
  [
    [
      'This is the ___ conference room in the building.',
      'これは建物で最も大きい会議室です。'
    ],
    [
      'Our new branch is the ___ store in the region.',
      '新しい支店はこの地域で最も大きい店です。'
    ],
    [
      'This model has the ___ screen in the series.',
      'この機種にはシリーズで最も大きい画面があります。'
    ],
    'largest',
    ['larger', 'large', 'largely'],
    '最上級',
    'theと範囲を表す句があり、最上級 largest が適切です。'
  ],
  [
    ['We plan ___ the new branch in June.', '6月に新支店を開く予定です。'],
    [
      'The company intends ___ a second office.',
      '会社は2つ目の事務所を開くつもりです。'
    ],
    [
      'The owners hope ___ the cafe next month.',
      '経営者たちは来月カフェを開きたいと考えています。'
    ],
    'to open',
    ['opening', 'open', 'opened'],
    '不定詞',
    'plan/intend/hopeの目的語にはto不定詞を使います。'
  ],
  [
    [
      'Please avoid ___ the elevator during the inspection.',
      '点検中はエレベーターの使用を避けてください。'
    ],
    [
      'The company recommends ___ public transport.',
      '会社は公共交通機関の利用を勧めています。'
    ],
    [
      'Would you consider ___ our online booking system?',
      '当社のオンライン予約システムの利用をご検討いただけますか。'
    ],
    'using',
    ['use', 'to use', 'used'],
    '動名詞',
    'avoid/recommend/considerの後の目的語は動名詞 using が適切です。'
  ],
  [
    [
      'The documents were ___ to all departments.',
      '書類はすべての部門に配布されました。'
    ],
    [
      'The safety instructions were ___ before the tour.',
      '安全に関する説明書は見学の前に配布されました。'
    ],
    [
      'The brochures were ___ at the entrance.',
      'パンフレットは入口で配布されました。'
    ],
    'distributed',
    ['distribute', 'distributing', 'distribution'],
    '受動態',
    'wereと過去分詞で受動態を作ります。'
  ],
  [
    [
      'The person ___ answered the phone was very helpful.',
      '電話に出た人はとても親切でした。'
    ],
    [
      'The consultant ___ prepared this report will visit tomorrow.',
      'この報告書を作成したコンサルタントは明日訪れます。'
    ],
    [
      'The employee ___ designed the poster received an award.',
      'そのポスターをデザインした従業員は賞を受け取りました。'
    ],
    'who',
    ['which', 'where', 'whose'],
    '関係代名詞',
    '人を先行詞とし、後ろの節の主語になるwhoです。'
  ],
  [
    [
      'This is the building ___ our first office was located.',
      'ここは最初の事務所があった建物です。'
    ],
    [
      'The restaurant ___ we held the meeting has closed.',
      '私たちが会合を開いたレストランは閉店しました。'
    ],
    [
      'The hotel ___ the delegates stayed is near the station.',
      '代表者たちが泊まったホテルは駅の近くです。'
    ],
    'where',
    ['which', 'who', 'whose'],
    '関係副詞',
    '後ろの節が完全文で、場所を示すwhereが適切です。'
  ],
  [
    [
      'If the supplier ___ today, we will confirm the order.',
      '供給業者が今日返答すれば、注文を確定します。'
    ],
    [
      'If the client ___ by noon, we can start production.',
      '顧客が正午までに返答すれば、製造を始められます。'
    ],
    [
      'If the director ___ this afternoon, we will update the team.',
      '部長が今日の午後に返答すれば、チームに知らせます。'
    ],
    'responds',
    ['respond', 'will respond', 'responding'],
    '条件節',
    '未来の条件を表すif節では現在形を使い、単数主語にrespondsを合わせます。'
  ],
  [
    [
      'The manager requested that the report ___ revised.',
      '責任者は報告書を修正するよう求めました。'
    ],
    [
      'The committee recommended that the venue ___ changed.',
      '委員会は会場を変更するよう勧めました。'
    ],
    [
      'The director insisted that the documents ___ checked.',
      '部長は書類を確認するよう強く求めました。'
    ],
    'be',
    ['is', 'was', 'being'],
    '要求・提案',
    '要求や提案のthat節で、動詞の原形beを使います。'
  ],
  [
    [
      'Please submit the form ___ five o’clock on Friday.',
      '金曜日の5時までに用紙を提出してください。'
    ],
    [
      'All payments must be received ___ the end of the month.',
      'すべての支払いは月末までに受領される必要があります。'
    ],
    [
      'We need your decision ___ noon tomorrow.',
      '明日の正午までに決定が必要です。'
    ],
    'by',
    ['until', 'during', 'since'],
    '期限',
    '完了の期限「〜までに」はbyです。untilは継続を表します。'
  ],
  [
    [
      'The reception desk is open ___ nine in the evening.',
      '受付は夜9時まで開いています。'
    ],
    [
      'The exhibition will remain on display ___ Sunday.',
      '展示は日曜日まで公開されます。'
    ],
    [
      'You may keep the equipment ___ the end of the week.',
      '週末まで機器を持っていてかまいません。'
    ],
    'until',
    ['by', 'since', 'during'],
    '継続',
    '状態や行為が続く終点を表すuntilです。'
  ],
  [
    [
      'The agreement is ___ the supplier and the retailer.',
      'その合意は供給業者と小売業者の間のものです。'
    ],
    [
      'There is a walkway ___ the office and the warehouse.',
      '事務所と倉庫の間には通路があります。'
    ],
    [
      'The meeting is scheduled ___ ten and eleven.',
      '会議は10時から11時の間に予定されています。'
    ],
    'between',
    ['among', 'through', 'along'],
    '前置詞',
    'A and Bの2つの間を表すbetweenです。'
  ],
  [
    ['We will look ___ the cause of the delay.', '遅延の原因を調査します。'],
    [
      'The technician is looking ___ the connection problem.',
      '技術者は接続の問題を調査しています。'
    ],
    [
      'The team has agreed to look ___ the complaint.',
      'チームは苦情を調査することに同意しました。'
    ],
    'into',
    ['up', 'after', 'out'],
    '句動詞',
    'look intoは「調査する」という意味です。'
  ],
  [
    [
      'We need to ___ a decision before the meeting.',
      '会議の前に決定する必要があります。'
    ],
    [
      'Please ___ a reservation at least two days ahead.',
      '少なくとも2日前に予約してください。'
    ],
    [
      'The designer will ___ a few changes to the layout.',
      'デザイナーは配置をいくつか変更します。'
    ],
    'make',
    ['do', 'take', 'give'],
    '語彙の結びつき',
    'make a decision/reservation/changeという結びつきを使います。'
  ],
  [
    [
      'The new team handles customer requests ___.',
      '新しいチームは顧客の要望を効率的に処理します。'
    ],
    [
      'This software allows us to work more ___.',
      'このソフトで、より効率的に働けます。'
    ],
    [
      'The redesigned warehouse operates more ___.',
      '再設計した倉庫はより効率的に稼働します。'
    ],
    'efficiently',
    ['efficient', 'efficiency', 'efficiencies'],
    '副詞',
    '動詞work/operate/handleを修飾する副詞efficientlyです。'
  ],
  [
    [
      'The road was closed, ___ we took a different route.',
      '道が閉鎖されていたので、別の道を通りました。'
    ],
    [
      'The room was full, ___ we moved upstairs.',
      '部屋が満員だったので、上の階へ移りました。'
    ],
    [
      'The printer stopped working, ___ I called support.',
      'プリンターが動かなくなったので、サポートへ電話しました。'
    ],
    'so',
    ['but', 'although', 'unless'],
    '接続詞',
    '原因から結果へつなぐ等位接続詞soです。'
  ],
  [
    [
      'Several ___ have asked for a later appointment.',
      '数人の顧客が、より遅い時間の予約を求めています。'
    ],
    [
      'Many ___ are interested in the new product.',
      '多くの顧客が新製品に関心を持っています。'
    ],
    [
      'Our regular ___ receive a monthly newsletter.',
      '常連の顧客は毎月ニュースレターを受け取ります。'
    ],
    'customers',
    ['customer', 'custom', 'customize'],
    '複数名詞',
    'several/many/our regularに合う人を表す複数名詞customersです。'
  ],
  [
    [
      'The company ___ products we use is based in Oslo.',
      '私たちが製品を使っている会社はオスロにあります。'
    ],
    [
      'The applicant ___ references were excellent was hired.',
      '推薦がすばらしかった応募者が採用されました。'
    ],
    [
      'The architect ___ design won the prize will speak today.',
      '設計が受賞した建築家は今日講演します。'
    ],
    'whose',
    ['who', 'which', 'where'],
    '所有の関係詞',
    '後ろの名詞の所有者を示すwhoseです。'
  ],
  [
    [
      'We received ___ complaints this month than last month.',
      '今月の苦情は先月より少なかったです。'
    ],
    [
      'The new process requires ___ steps than the old one.',
      '新しい工程では古い工程より手順が少なくて済みます。'
    ],
    [
      'There were ___ visitors on Tuesday than on Monday.',
      '火曜日の来場者は月曜日より少なかったです。'
    ],
    'fewer',
    ['less', 'little', 'least'],
    '可算名詞の比較',
    '数えられる複数名詞の数の比較はfewerです。'
  ],
  [
    [
      'Your refund will be processed ___ ten working days.',
      '返金は10営業日以内に処理されます。'
    ],
    [
      'We will reply to your inquiry ___ forty-eight hours.',
      'お問い合わせには48時間以内に返信します。'
    ],
    [
      'The replacement should arrive ___ a week.',
      '交換品は1週間以内に届くはずです。'
    ],
    'within',
    ['during', 'since', 'between'],
    '期間の範囲',
    '「〜以内に」はwithinです。'
  ],
  [
    ['The old entrance is no ___ in use.', '古い入口はもう使われていません。'],
    [
      'This service is no ___ available on weekends.',
      'このサービスは週末にはもう利用できません。'
    ],
    [
      'The company no ___ produces that model.',
      'その会社はもうその機種を製造していません。'
    ],
    'longer',
    ['long', 'longest', 'length'],
    '定型表現',
    'no longerは「もはや〜ない」という意味です。'
  ],
  [
    [
      '___ you need assistance, please contact reception.',
      'もし手助けが必要なら、受付へご連絡ください。'
    ],
    [
      '___ you wish to cancel, notify us by email.',
      'もし取消しを希望するなら、メールで知らせてください。'
    ],
    [
      '___ you have any questions, speak to a member of staff.',
      'もし質問があれば、職員にお話しください。'
    ],
    'Should',
    ['Would', 'Could', 'Had'],
    '条件の倒置',
    'Should + 主語 + 動詞原形で「もし〜なら」を表します。'
  ]
]
