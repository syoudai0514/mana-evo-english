import { CONVERSATION_SCENES, CONVERSATION_CATEGORIES } from './conversations.js'
import { metadata, line } from './shared.js'
const EXTRAS = [line('Could you speak a little more slowly?','もう少しゆっくり話してもらえますか？'),line('Let me say that another way.','別の言い方をさせてください。'),line('Do you mean this one?','こちらのことですか？'),line('I need a moment to think.','少し考える時間が必要です。')]
export const PHRASE_PACK = CONVERSATION_CATEGORIES.flatMap(category=>{
 const sceneRows=CONVERSATION_SCENES.filter(item=>item.category===category.id)
 const rows=[...sceneRows.flatMap(scene=>scene.phrases.map((p,i)=>({...p,sourceLessonId:`${scene.id}.a2`,phraseId:`${scene.id}.phrase.${i+1}`}))),...EXTRAS.map((p,i)=>({...p,sourceLessonId:`${sceneRows[i].id}.a2`,phraseId:`phrase.repair.${category.id}.${i+1}`}))]
 return rows.map((row,i)=>({...metadata(`phrase.${category.id}.${i+1}`,'phrase',row.en,i<14?'A1':i<28?'A2':'B1',2),...row,category:category.id,categoryLabel:category.label,usage:category.label,alternative:EXTRAS[i%4],translationNote:'日本語の語順をそのまま移さず、まとまりで覚えましょう。',goals:['場面に合う一文を思い出して言う'],phrases:[line(row.en,row.ja)]}))
})
const SHADOW_SEEDS = PHRASE_PACK.filter(item=>{const n=item.en.split(/\s+/).length;return n>=5&&n<=14})
export const SHADOW_PACK = Array.from({length:60},(_,i)=>{
 const p=SHADOW_SEEDS[i]; const words=p.en.split(' ')
 return {...metadata(`shadow.${i+1}`,'shadow',p.en,['A1','A2','B1'][Math.floor(i/20)],3),en:p.en,ja:p.ja,sourceLessonId:p.sourceLessonId,category:p.category,phrases:[line(p.en,p.ja)],goals:['意味のまとまりごとにお手本をまねる'],chunks:[words.slice(0,Math.ceil(words.length/2)).join(' '),words.slice(Math.ceil(words.length/2)).join(' ')],stressNote:'内容を伝える語を少しはっきり、機能語は軽く。',linkingNote:'単語の終わりの子音と次の母音を滑らかにつなげて聞いてみましょう。'}
})
