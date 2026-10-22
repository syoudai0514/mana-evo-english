import { KID_ACTIVITIES, KID_WORLDS } from './kids.js'
import { CONVERSATION_LESSONS, CONVERSATION_CATEGORIES } from './conversations.js'
import { PHONICS_ITEMS } from './phonics.js'
import { PHRASE_PACK, SHADOW_PACK } from './review.js'
import { STORIES, WORLD_FRIENDS } from './stories.js'
import { LISTENING_LESSONS } from './listening.js'
export { KID_ACTIVITIES,KID_WORLDS,CONVERSATION_LESSONS,CONVERSATION_CATEGORIES,PHONICS_ITEMS,PHRASE_PACK,SHADOW_PACK,STORIES,WORLD_FRIENDS,LISTENING_LESSONS }
export const CONTENT = [...KID_ACTIVITIES,...CONVERSATION_LESSONS,...PHONICS_ITEMS,...PHRASE_PACK,...SHADOW_PACK,...STORIES,...WORLD_FRIENDS,...LISTENING_LESSONS]
const byId=new Map(CONTENT.map(item=>[item.id,item]))
export function lessonById(id) { return byId.get(id)||null }
export const KID_TABS = [{id:'kids-activity',label:'ぼうけん',emoji:'🌈'},{id:'phonics',label:'もじと おと',emoji:'🔤'},{id:'story',label:'おはなし',emoji:'📖'},{id:'world-friend',label:'せかいの ともだち',emoji:'🌏'}]
export const ADULT_TABS = [{id:'conversation',label:'場面で話す',emoji:'💬'},{id:'listening',label:'耳から学ぶ',emoji:'🎧'},{id:'phrase',label:'フレーズ',emoji:'🗂️'},{id:'shadow',label:'声に出す',emoji:'🎤'}]
export function validateContent(items=CONTENT) {
 const issues=[];const ids=new Set()
 for(const item of items){
  if(!item.id||ids.has(item.id))issues.push(`${item.id}: duplicate/missing id`);ids.add(item.id)
  if(!item.title?.ja||!item.goals?.length||!item.level||!item.rights||!item.review)issues.push(`${item.id}: missing metadata`)
  if(!item.phrases?.length||item.phrases.some(p=>!p.en||!p.ja))issues.push(`${item.id}: invalid phrases`)
  for(const step of [...(item.steps||[]),...(item.checks||[])])if(step.answer!=null&&(!Number.isInteger(step.answer)||step.answer<0||step.answer>=step.choices.length))issues.push(`${item.id}: invalid answer`)
  if(item.nodes){const seen=new Set();const walk=(id,path=new Set())=>{const node=item.nodes[id];if(!node){issues.push(`${item.id}: unknown node ${id}`);return false}if(path.has(id)){issues.push(`${item.id}: story cycle`);return false}seen.add(id);return node.end||node.choices?.every(c=>walk(c.next,new Set([...path,id])))};if(!walk(item.start))issues.push(`${item.id}: no ending`);if(seen.size!==Object.keys(item.nodes).length)issues.push(`${item.id}: unreachable node`)}
 }
 return issues
}
