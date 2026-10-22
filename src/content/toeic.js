import p2Sets from './toeic-p2.json' with { type: 'json' }
import { TOEIC_CONTEXTS as contexts } from './toeic-contexts.js'
import { GRAMMAR_ITEMS } from './toeic-grammar.js'
import { metadata,stableShuffle } from './shared.js'
export const TOEIC_PART_INFO={p1:{label:'Part 1 写真描写',section:'listening',count:6},p2:{label:'Part 2 応答',section:'listening',count:25},p3:{label:'Part 3 会話',section:'listening',count:39},p4:{label:'Part 4 説明文',section:'listening',count:30},p5:{label:'Part 5 短文穴埋め',section:'reading',count:30},p6:{label:'Part 6 長文穴埋め',section:'reading',count:16},p7:{label:'Part 7 読解',section:'reading',count:54}}
export const PHOTO_DESCRIPTIONS=[
 ['A woman is typing on a laptop.','女性がノートパソコンで入力しています。'],['A man is watering a plant.','男性が植物に水をやっています。'],['Chairs are arranged around an outdoor table.','屋外のテーブルの周りに椅子が置かれています。'],['A woman is putting books on a shelf.','女性が本を棚に置いています。'],['A man is pushing a shopping cart.','男性が買い物カートを押しています。'],['A bicycle is parked against a wall.','自転車が壁に立てかけられています。'],['A woman is looking at a map.','女性が地図を見ています。'],['A man is wiping a table.','男性がテーブルを拭いています。'],['Suitcases are lined up near a bench.','ベンチの近くにスーツケースが並んでいます。'],['A woman is taking a photograph of flowers.','女性が花の写真を撮っています。'],['A man is carrying a cardboard box.','男性が段ボール箱を運んでいます。'],['Umbrellas are open above some outdoor tables.','屋外のテーブルの上でパラソルが開いています。'],['A woman is writing notes at a table.','女性がテーブルでメモを書いています。'],['A man is arranging vegetables at a market.','男性が市場で野菜を並べています。'],['Boats are tied to a dock.','ボートが桟橋につながれています。'],['A woman is hanging up a coat.','女性がコートを掛けています。'],['A man is painting a wall with a roller.','男性がローラーで壁を塗っています。'],['Two people are talking over coffee.','2人がコーヒーを飲みながら話しています。']
]
const SET_SEEDS=[{id:'toeic.practice.1',label:'練習セット 1',purpose:'practice',company:'Alder Services',name:'Maya Chen',day:'Tuesday',dayJa:'火曜日',time:'10:00 a.m.',timeJa:'午前10時',date:'November 10',dateJa:'11月10日',price:24},{id:'toeic.mock.1',label:'模試セット 1',purpose:'mock',company:'Birch Group',name:'Daniel Rivera',day:'Wednesday',dayJa:'水曜日',time:'2:00 p.m.',timeJa:'午後2時',date:'November 18',dateJa:'11月18日',price:32},{id:'toeic.mock.2',label:'模試セット 2',purpose:'mock',company:'Cedar Partners',name:'Aisha Patel',day:'Thursday',dayJa:'木曜日',time:'11:30 a.m.',timeJa:'午前11時30分',date:'November 26',dateJa:'11月26日',price:40}]
const stimuli=[];const questions=[]
function stimulus(set,part,index,patch){const id=`${set.id}.${part}.stimulus.${index+1}`;const item={id,version:1,setId:set.id,part,...patch};stimuli.push(item);return item}
function question(set,part,source,index,prompt,options,evidence,ja,skill='detail'){
 const entries=options.map((value,i)=>({value,correct:i===0}));const shuffled=stableShuffle(entries,`${set.id}.${part}.${index}`)
 const q={...metadata(`${set.id}.${part}.question.${index+1}`,'toeic',prompt,'A2',1),setId:set.id,purpose:set.purpose,part,section:TOEIC_PART_INFO[part].section,stimulusId:source.id,prompt,choices:shuffled.map(e=>e.value),answerIndex:shuffled.findIndex(e=>e.correct),evidence,explainJa:ja,choiceExplanations:shuffled.map(e=>e.correct?`正解。${ja}`:`「${e.value}」は本文・音声の根拠「${evidence}」と一致しません。`),skill,estimatedSeconds:part==='p5'?30:55,goals:['根拠に基づいて選択肢を選ぶ'],phrases:[{en:evidence,ja}]}
 questions.push(q);return q
}
function contextFor(index,setIndex){return contexts[(index+setIndex*4)%contexts.length]}
function facts(c,set,index){const hour=9+(index%3);return {when:`${set.day} at ${hour}:00 a.m.`,whenJa:`${set.dayJa}の午前${hour}時`,deadline:`${set.day} at 5:00 p.m.`,price:set.price+index*3}}
function factQuestions(set,part,source,base,c,f,count=3,offset=0){
 const pool=[
  ['What is the main purpose of the event?',[`To ${c.reason}`,'To announce a company merger','To recruit a new director','To close a local branch'],c.reason,`目的は「${c.reasonJa}」と明記されています。`,'mainIdea'],
  ['Where will the event take place?',[c.place,'the airport lounge','the city hospital','the parking garage'],c.place,`場所は「${c.placeJa}」です。`,'location'],
  ['When will the event begin?',[f.when,'Monday at 8:00 a.m.','Friday at 6:00 p.m.','Sunday at 4:00 p.m.'],f.when,`開始は${f.whenJa}とあります。`,'time'],
  ['What are participants asked to do?',[`They should ${c.action}.`,'They should cancel their membership.','They should contact a travel agency.','They should bring a printed newspaper.'],c.action,`参加者は「${c.actionJa}」よう求められています。`,'nextAction'],
  ['Who is the event intended for?',[c.role,'international journalists','retired professional athletes','primary school teachers'],c.role,`対象者は「${c.roleJa}」です。`,'audience'],
  ['What additional information is provided?',[c.change,'All participants must bring their own gloves.','The event has been canceled permanently.','Every visitor must stay overnight.'],c.change,c.changeJa,'detail']
 ]
 return Array.from({length:count},(_,i)=>{const [prompt,options,evidence,ja,skill]=pool[(i+offset)%pool.length];return question(set,part,source,base+i,prompt,options,evidence,ja,skill)})
}
for(const [setIndex,set] of SET_SEEDS.entries()){
 // Part 1: original generated photo cells. Exact crop coordinates are shared by UI and asset manifest.
 for(let i=0;i<6;i++){
  const photoIndex=setIndex*6+i;const source=stimulus(set,'p1',i,{type:'photo',photo:{url:'/learning/toeic/photo-sheet-v1.png',index:photoIndex,columns:6,rows:3,alt:'学習用に生成した写真。文字による補助は練習モードで利用できます。'},transcript:PHOTO_DESCRIPTIONS[photoIndex][0],translation:PHOTO_DESCRIPTIONS[photoIndex][1]})
  const wrong=PHOTO_DESCRIPTIONS.filter((_,j)=>j!==photoIndex).filter(([en])=>!en.includes(photoIndex===0?'typing':'xxxxxxxx')).slice((i*2)%11,(i*2)%11+3).map(p=>p[0])
  question(set,'p1',source,i,'Which statement best describes the photograph?',[PHOTO_DESCRIPTIONS[photoIndex][0],...wrong],PHOTO_DESCRIPTIONS[photoIndex][0],PHOTO_DESCRIPTIONS[photoIndex][1],'photoDescription')
 }
 // Part 2: three spoken choices; no question or choice text in timed mode.
 p2Sets[setIndex].forEach((row,i)=>{
  const wrong=p2Sets[(setIndex+1)%3].filter(other=>other.skill!==row.skill).slice((i*3)%20,(i*3)%20+2).map(other=>other.answer)
  const source=stimulus(set,'p2',i,{type:'response',transcript:row.prompt,translation:row.promptJa})
  question(set,'p2',source,i,'Choose the best response.',[row.answer,...wrong],`${row.prompt} — ${row.answer}`,`${row.promptJa} → ${row.answerJa}。問いの種類と文脈に合う応答です。`,row.skill)
 })
 // Part 3: thirteen conversations, three linked questions each.
 for(let i=0;i<13;i++){
  const c=contextFor(i,setIndex),f=facts(c,set,i)
  const transcript=`W: Have you heard about ${c.event} at ${set.company}?\nM: Yes. It is for ${c.role}. We are going to ${c.reason}.\nW: Where and when will it be held?\nM: At ${c.place}, on ${f.when}. Please ${c.action}.\nW: Is there anything else we should know?\nM: ${c.change}`
  const source=stimulus(set,'p3',i,{type:'conversation',transcript,translation:`${set.company}の${c.eventJa}についての会話。対象は${c.roleJa}、目的は${c.reasonJa}。場所は${c.placeJa}、${f.whenJa}からです。${c.actionJa}よう求めています。${c.changeJa}`,speakers:['W','M']})
  factQuestions(set,'p3',source,i*3,c,f,3,i%4)
 }
 // Part 4: ten independent announcements, three linked questions each.
 for(let i=0;i<10;i++){
  const c=contextFor(i+3,setIndex),f=facts(c,set,i+2)
  const transcript=`Good morning. This is ${set.name} speaking for ${set.company}. We would like to invite ${c.role} to ${c.event}. The purpose is to ${c.reason}. The event will be held at ${c.place} on ${f.when}. Before arriving, please ${c.action}. ${c.change} If you have any questions, please contact our reception desk. Thank you.`
  const source=stimulus(set,'p4',i,{type:'announcement',transcript,translation:`${set.company}の${set.name}による案内です。${c.roleJa}が対象の${c.eventJa}です。目的は${c.reasonJa}。${c.placeJa}で${f.whenJa}に始まります。来場前に${c.actionJa}よう案内しています。${c.changeJa}質問は受付へどうぞ。`})
  factQuestions(set,'p4',source,i*3,c,f,3,(i+2)%4)
 }
 // Part 5: thirty grammatical and lexical decisions, one independent sentence each.
 GRAMMAR_ITEMS.forEach((row,i)=>{const [stem,meaning]=row[setIndex];const [correct,wrong,skill,reason]=row.slice(3);const source=stimulus(set,'p5',i,{type:'sentence',documents:[{title:'Sentence completion',body:stem,translation:meaning}]});question(set,'p5',source,i,'Choose the word or phrase that best completes the sentence.',[correct,...wrong],stem.replace('___',correct),`${reason} 全文の意味：${meaning}`,skill)})
 // Part 6: four documents, four linked gaps each, including sentence insertion.
 for(let i=0;i<4;i++){
  const c=contextFor(i+setIndex,setIndex),f=facts(c,set,i)
  const body=`To: ${c.role}\nFrom: ${set.name}, ${set.company}\nSubject: ${c.event}\n\nWe are pleased to [1] you to ${c.event}. It will take place at ${c.place} on ${f.when}. All participants are [2] to ${c.action}. [3] you have any questions, please contact the reception desk. [4] We look forward to seeing you.`
  const source=stimulus(set,'p6',i,{type:'gapDocument',documents:[{title:`Notice: ${c.event}`,body,translation:`${c.roleJa}へ、${set.company}の${set.name}からの案内。${c.eventJa}にご招待します。${c.placeJa}で${f.whenJa}に開催します。参加者全員に${c.actionJa}ことをお願いしています。質問があれば受付に連絡してください。${c.changeJa}ご参加をお待ちしています。`} ]})
  const gapRows=[['invite',['invitation','inviting','invited'],'toの後は動詞の原形inviteです。'],['asked',['asking','ask','asks'],'areと過去分詞askedで「求められている」を表します。'],['If',['Despite','During','Unless'],'質問がある場合を示すIfが適切です。'],[c.change,['The entire event has been canceled.','Only airline pilots are permitted to attend.','Please ignore all of the information above.'],`補足情報として前後と矛盾しない「${c.changeJa}」が適切です。`]]
  gapRows.forEach(([correct,wrong,reason],j)=>question(set,'p6',source,i*4+j,`Choose the best option for gap [${j+1}].`,[correct,...wrong],j===3?c.change:body.split('\n').find(line=>line.includes(`[${j+1}]`)).replace(`[${j+1}]`,correct),reason,j===3?'sentenceInsertion':'textCompletion'))
 }
 // Part 7: ten single documents (29 questions), two double and three triple-document groups (25 questions).
 const singleCounts=[2,3,3,2,3,4,3,3,3,3];let qIndex=0
 for(let i=0;i<10;i++){
  const c=contextFor(i+1,setIndex),f=facts(c,set,i+1);const format=['Email','Notice','Advertisement','Newsletter','Memo'][i%5]
  const body=`${format}\n${set.company}\n${set.date}\n\n${c.event[0].toUpperCase()+c.event.slice(1)}\n\nWe invite ${c.role} to an event designed to ${c.reason}. Join us at ${c.place} on ${f.when}. Participants should ${c.action}. ${c.change}\n\nFor more information, contact ${set.name} at the reception desk.`
  const source=stimulus(set,'p7',i,{type:'singleDocument',documents:[{title:`${format}: ${c.event}`,body,translation:`${set.dateJa}付、${set.company}の${format}。${c.roleJa}を対象に${c.reasonJa}ための${c.eventJa}を開きます。${c.placeJa}で${f.whenJa}に始まります。参加者は${c.actionJa}よう求められています。${c.changeJa}問い合わせ先は受付の${set.name}です。`}]})
  factQuestions(set,'p7',source,qIndex,c,f,singleCounts[i],i%3);qIndex+=singleCounts[i]
 }
 for(let i=0;i<5;i++){
  const c=contextFor(i+7,setIndex),f=facts(c,set,i+7);const quantity=6+i;const total=f.price*quantity;const discount=10+i*5
  const documents=[
   {title:`Event listing: ${c.event}`,body:`${set.company} invites ${c.role} to ${c.event}.\nPurpose: to ${c.reason}.\nVenue: ${c.place}.\nStart: ${f.when}.\nStandard fee: $${f.price} per person. Groups of six or more receive a total discount of $${discount} per booking. Please ${c.action}.`,translation:`${set.company}の${c.eventJa}。対象は${c.roleJa}、目的は${c.reasonJa}。場所は${c.placeJa}、開始は${f.whenJa}。1人${f.price}ドル、6人以上のグループは予約全体から${discount}ドル引きです。${c.actionJa}よう案内しています。`},
   {title:`Booking email from ${set.name}`,body:`Hello, I would like to book ${quantity} places for your event. All of us meet the eligibility requirements. Could you apply the advertised group discount? We will ${c.action}. Please confirm the total amount due. Regards, ${set.name}`,translation:`${set.name}が${quantity}人分を予約し、参加条件を全員満たすことを伝えています。広告の団体割引を適用し、支払総額を確認してほしいと依頼しています。`}
  ]
  if(i>=2)documents.push({title:'Confirmation from the organizer',body:`Thank you for your booking. We have applied the group discount. Please pay the full amount by ${f.deadline}. ${c.change} Your reservation will be held until payment is received.`,translation:`予約へのお礼と団体割引の適用を伝えています。${set.dayJa}午後5時までに全額を支払うよう求めています。${c.changeJa}支払いを受けるまで予約を取り置きします。`})
  const source=stimulus(set,'p7',10+i,{type:i<2?'doubleDocument':'tripleDocument',documents})
  const qs=[['Why did the writer send the email?',['To reserve places for a group','To complain about a canceled event','To request a job interview','To advertise a new venue'],`I would like to book ${quantity} places`,'グループの参加枠を予約するためです。','purpose'],['Who is eligible for the event?',[c.role,'Only the company directors','Only professional athletes','Only international reporters'],c.role,`対象は${c.roleJa}です。`,'crossDocument'],['How much should the group pay?',[`$${total-discount}`,`$${total}`,`$${total+discount}`,`$${f.price}`],`$${f.price} × ${quantity} − $${discount} = $${total-discount}`,'1人分の料金に人数を掛け、予約全体の団体割引を1回引きます。','calculation'],['What will the group do before attending?',[`They will ${c.action}.`,'They will move to a different city.','They will change the venue.','They will send a newspaper article.'],c.action,`予約メールにも${c.actionJa}と書かれています。`,'crossDocument'],i<2?['Where will the event be held?',[c.place,'the international airport','a local hospital','the company parking lot'],c.place,`会場は${c.placeJa}です。`,'location']:['By when must payment be made?',[f.deadline,'Sunday at midnight','Friday at 8:00 a.m.','Monday at 10:00 p.m.'],f.deadline,'確認書で指定された支払期限を選びます。','crossDocument']]
  qs.forEach(([prompt,options,evidence,ja,skill],j)=>question(set,'p7',source,qIndex+j,prompt,options,evidence,ja,skill));qIndex+=5
 }
 if(qIndex!==54)throw new Error('Part 7 must contain 54 questions')
}
export const TOEIC_STIMULI=stimuli
export const TOEIC_QUESTIONS=questions
export const TOEIC_SETS=SET_SEEDS.map(set=>({...set,questionIds:questions.filter(q=>q.setId===set.id).map(q=>q.id),listeningMinutes:45,readingMinutes:75}))
const byQuestion=new Map(questions.map(q=>[q.id,q])),byStimulus=new Map(stimuli.map(s=>[s.id,s]))
export const toeicQuestion=id=>byQuestion.get(id)||null
export const toeicStimulus=id=>byStimulus.get(id)||null
export function practiceQuestions(part='all',count=10){return questions.filter(q=>q.purpose==='practice'&&(part==='all'||q.part===part)).slice(0,count)}
export function validateToeic(){
 const errors=[];const ids=new Set();for(const q of questions){if(ids.has(q.id))errors.push(`duplicate ${q.id}`);ids.add(q.id);if(!byStimulus.has(q.stimulusId))errors.push(`${q.id}: missing stimulus`);if(q.choices.length!==(q.part==='p2'?3:4)||new Set(q.choices).size!==q.choices.length)errors.push(`${q.id}: invalid choices`);if(q.answerIndex<0||q.answerIndex>=q.choices.length||!q.evidence||!q.explainJa||q.choiceExplanations.length!==q.choices.length)errors.push(`${q.id}: incomplete answer`)}
 for(const set of TOEIC_SETS){for(const [part,info]of Object.entries(TOEIC_PART_INFO)){if(questions.filter(q=>q.setId===set.id&&q.part===part).length!==info.count)errors.push(`${set.id}: invalid ${part} count`)}}
 return errors
}
