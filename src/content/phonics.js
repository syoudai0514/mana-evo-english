import { LETTERS } from '../data/letters.js'
import { line, metadata } from './shared.js'
const SOUNDS = [
 ['æ','口を横と縦に開き、短く声を出す。','a'],['b','唇を閉じてから開く。後ろに余分な母音をつけない。','b'],['k','舌の奥を上げて短く息を出す。この例では硬いc。','k'],['d','舌先を上の歯ぐきにつけて離す。','d'],['ɛ','口を軽く開き、短く声を出す。','e'],['f','上の歯を下唇に軽く当てて息を出す。','f'],['ɡ','舌の奥を上げて声を出す。この例では硬いg。','g'],['h','のどをしめず、息をやさしく出す。','h'],['ɪ','口を少し開き、力を抜いて短く。','i'],['dʒ','舌を近づけてから声と息を出す。','j'],['k','舌の奥を上げて短く息を出す。','k'],['l','舌先を上の歯ぐきにつけて声を出す。','l'],['m','唇を閉じ、鼻へ声を通す。','m'],['n','舌先を上の歯ぐきにつけ、鼻へ声を通す。','n'],['ɒ / ɑ','短いo。英米で音が異なる。','o'],['p','唇を閉じ、息でぱっと開く。','p'],['kw','qは多くの場合uと一緒に使う。例語の先頭を聞こう。','qu'],['r / ɹ','舌先を上につけずに声を出す。舌の形には個人差がある。','r'],['s','歯を近づけ、細い息を出す。','s'],['t','舌先を上の歯ぐきにつけ、息で離す。','t'],['ʌ','力を抜いて口を開き、短く声を出す。','u'],['v','上の歯を下唇に軽く当て、声を出す。','v'],['w','唇を丸めてからすぐに開く。','w'],['ks','xの音をfoxの終わりで聞こう。','x'],['j','舌を上あごに近づけ、すぐに母音へつなぐ。','y'],['z','歯を近づけ、のどをふるわせて声を出す。','z']
]
export const PHONICS_LETTERS = LETTERS.map((item,i)=>({...metadata(`phonics.letter.${item.letter.toLowerCase()}`,'phonics',{ja:`${item.letter}の なまえと おと`,en:`Letter ${item.letter}`},'Pre-A1',2),...item,letterName:item.letter==='Z'?'zee / zed':item.letter,phoneme:SOUNDS[i][0],mouth:SOUNDS[i][1],grapheme:SOUNDS[i][2],goals:['文字の名前と例語の音を聞き分ける'],phrases:[line(item.word,item.ja)],audio:{name:{text:item.letter,status:'device-voice'},sound:{status:'unrecorded',note:'単独音は録音のお手本が必要。文字名を音として読み上げない。'},word:{text:item.word,status:'device-voice'}}}))
const RAW = {
 a:'cat:ねこ:🐱 bat:こうもり:🦇 hat:ぼうし:🎩 mat:マット:🟫 rat:ねずみ:🐀 sat:すわった:🪑 pat:やさしくたたく:✋ tap:かるくたたく:👆 cap:ぼうし:🧢 map:ちず:🗺️ bag:かばん:👜 jam:ジャム:🍓',
 e:'bed:ベッド:🛏️ red:あか:🔴 hen:めんどり:🐔 pen:ペン:🖊️ ten:じゅう:🔟 net:あみ:🥅 pet:ペット:🐕 wet:ぬれた:💧 jet:ジェットき:✈️ leg:あし:🦵 beg:おねがいする:🙏 fed:たべものをあげた:🥣',
 i:'pig:ぶた:🐷 big:おおきい:🐘 dig:ほる:⛏️ wig:かつら:💇 pin:ピン:📌 tin:かん:🥫 fin:ひれ:🐟 bin:ごみばこ:🗑️ sit:すわる:🪑 hit:あてる:⚾ lip:くちびる:👄 zip:ファスナー:🤐',
 o:'dog:いぬ:🐶 log:まるた:🪵 fog:きり:🌫️ hot:あつい:🔥 pot:なべ:🍲 cot:こどもようベッド:🛏️ dot:てん:⚫ top:いちばんうえ:🔝 hop:ぴょんととぶ:🐰 mop:モップ:🧹 pop:ぽんとはじける:🎈 nod:うなずく:🙂',
 u:'sun:たいよう:☀️ run:はしる:🏃 fun:たのしい:🎉 bun:まるいパン:🥯 cup:コップ:☕ pup:こいぬ:🐕 bus:バス:🚌 bug:むし:🐞 hug:だきしめる:🤗 mud:どろ:🟤 tub:おふろ:🛁 cut:きる:✂️'
}
export const CVC_WORDS = Object.entries(RAW).flatMap(([vowel,raw])=>raw.split(' ').map((chunk,i)=>{const [word,ja,emoji]=chunk.split(':');return {...metadata(`phonics.cvc.${vowel}.${i+1}`,'phonics',word,'Pre-A1',2),mode:'cvc',vowel,word,ja,emoji,segments:word.split(''),goals:['3つの音をつないで単語を聞く'],phrases:[line(word,ja)]}}))
const PAIRS = [
 ['ship','sheep','ふね','ひつじ','ɪ / iː'],['sit','seat','すわる','ざせき','ɪ / iː'],['bit','beat','かけら','たたく','ɪ / iː'],['fill','feel','いっぱいにする','かんじる','ɪ / iː'],
 ['cap','cup','ぼうし','コップ','æ / ʌ'],['cat','cut','ねこ','きる','æ / ʌ'],['hat','hut','ぼうし','こや','æ / ʌ'],['bag','bug','かばん','むし','æ / ʌ'],
 ['bed','bad','ベッド','よくない','ɛ / æ'],['pen','pan','ペン','フライパン','ɛ / æ'],['men','man','おとこのひとたち','おとこのひと','ɛ / æ'],['ten','tan','じゅう','うすいちゃいろ','ɛ / æ'],
 ['rice','lice','ごはん','しらみ','r / l'],['right','light','みぎ','ひかり','r / l'],['rock','lock','いわ','かぎ','r / l'],['road','load','みち','にもつ','r / l'],
 ['fan','van','せんぷうき','バン','f / v'],['fine','vine','げんき','つるしょくぶつ','f / v'],['safe','save','あんぜん','たすける','f / v'],['leaf','leave','はっぱ','さる','f / v'],
 ['thin','sin','うすい','つみ','θ / s'],['think','sink','かんがえる','しずむ','θ / s'],['three','tree','さん','き','θr / tr'],['mouth','mouse','くち','ねずみ','θ / s']
]
export const SOUND_PAIRS = PAIRS.map(([left,right,leftJa,rightJa,contrast],i)=>({...metadata(`phonics.pair.${i+1}`,'phonics',`${left} / ${right}`,'A1',2),mode:'pair',left,right,leftJa,rightJa,contrast,goals:['ちがう音をゆっくり聞き分ける'],phrases:[line(left,leftJa),line(right,rightJa)]}))
export const PHONICS_ITEMS = [...PHONICS_LETTERS,...CVC_WORDS,...SOUND_PAIRS]
