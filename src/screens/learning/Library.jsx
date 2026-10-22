import React,{useMemo,useState} from 'react'
import { CONTENT,KID_TABS,ADULT_TABS,KID_WORLDS,CONVERSATION_CATEGORIES } from '../../content/index.js'
import { learnerProgress } from '../../lib/learning.js'
import { Icon } from '../../components/experience.jsx'
export default function Library({adult,learning,learnerId,onOpen,onBack,initialKind}){
 const tabs=adult?ADULT_TABS:KID_TABS
 const [kind,setKind]=useState(tabs.some(t=>t.id===initialKind)?initialKind:tabs[0].id),[category,setCategory]=useState('all'),[level,setLevel]=useState('all'),[search,setSearch]=useState(''),[limit,setLimit]=useState(24)
 const progress=learnerProgress(learning,learnerId)
 const items=useMemo(()=>CONTENT.filter(item=>item.kind===kind&&(category==='all'||(item.world||item.category||item.theme||item.country||item.mode)==category)&&(level==='all'||item.level===level)&&(!search||`${item.title.ja} ${item.title.en} ${item.phrases.map(p=>`${p.en} ${p.ja}`).join(' ')}`.toLowerCase().includes(search.toLowerCase()))),[kind,category,level,search])
 const categories=useMemo(()=>[...new Set(CONTENT.filter(item=>item.kind===kind).map(item=>item.world||item.category||item.theme||item.country||item.mode).filter(Boolean))].map(id=>({id,label:KID_WORLDS.find(w=>w.id===id)?.label||CONVERSATION_CATEGORIES.find(c=>c.id===id)?.label||({cvc:'3つの おと',pair:'ききくらべ'}[id])||id})),[kind])
 const switchKind=id=>{setKind(id);setCategory('all');setLimit(24)}
 const last=progress.lastLesson&&CONTENT.find(i=>i.id===progress.lastLesson&&tabs.some(t=>t.id===i.kind))
 return <div className={`screen content-library ${adult?'adult-dark':''}`}><header className="top"><button className="icon-btn" aria-label="ホームにもどる" onClick={onBack}>‹</button><h1 className="title-lg">{adult?'あなたの教材ライブラリ':'ぼうけんの ほんだな'}</h1><span className="library-total">{Object.keys(progress.completed).length} {adult?'完了':'できた'}</span></header><div className="scroll lesson-scroll">
 <div className="library-intro"><span className="eyebrow">A LITTLE DISCOVERY EVERY DAY</span><h2>{adult?'使う場面から、ひとつずつ。':'きょうは、どんな ぼうけん？'}</h2><p>{adult?'ガイド会話・聞く練習・フレーズ。自分のペースで選べます。':'えらんで、きいて、ひとこと。ゆっくりで だいじょうぶ。'}</p></div>
 {last&&<button className="resume-lesson" onClick={()=>onOpen(last.id)}><Icon name="book"/><span>{progress.drafts[last.id]?'つづきから':'もういちど'}：{last.title.ja}</span><Icon name="arrow"/></button>}
 <div className="library-tabs" role="group" aria-label="教材の種類">{tabs.map(tab=><button key={tab.id} aria-pressed={kind===tab.id} className={kind===tab.id?'selected':''} onClick={()=>switchKind(tab.id)}>{tab.emoji} {tab.label}</button>)}</div>
 <div className="library-filters"><label><span>さがす</span><input type="search" value={search} placeholder={adult?'場面やフレーズ':'すきな ことば'} onChange={e=>{setSearch(e.target.value);setLimit(24)}}/></label>{categories.length>0&&<label><span>{adult?'分野':'テーマ'}</span><select value={category} onChange={e=>{setCategory(e.target.value);setLimit(24)}}><option value="all">ぜんぶ</option>{categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}{adult&&<label><span>レベルの目安</span><select value={level} onChange={e=>{setLevel(e.target.value);setLimit(24)}}><option value="all">すべて</option>{['A1','A2','B1'].map(l=><option key={l}>{l}</option>)}</select></label>}</div>
 <div className="section-heading"><h2>{tabs.find(t=>t.id===kind).label}</h2><span className="section-note">{items.length} {adult?'件':'こ'}</span></div>
 <div className="lesson-card-grid">{items.slice(0,limit).map(item=><button key={item.id} className={`lesson-card ${progress.completed[item.id]?'is-complete':''}`} onClick={()=>onOpen(item.id)}><span className="lesson-card-art">{item.emoji||({phonics:'🔤',phrase:'🗂️',shadow:'🎤'}[item.kind])||'📖'}</span><span className="lesson-card-copy"><span className="lesson-meta">{item.categoryLabel||item.worldLabel||item.theme||item.countryJa||item.level} · {item.estimatedMinutes}分</span><strong>{item.title.ja}</strong><span className="lesson-goal">{item.goals[0]}</span></span>{progress.completed[item.id]?<span className="lesson-complete-label">✓</span>:<Icon name="arrow" size={18}/>}</button>)}</div>
 {!items.length&&<div className="lesson-empty">みつかりませんでした。ことばやテーマを変えてみてください。</div>}{items.length>limit&&<button className="primary-action library-more" onClick={()=>setLimit(n=>n+24)}>もっと みる（あと {items.length-limit}）</button>}
 <p className="content-note">新しいオリジナル教材を順次確認しています。気になる表現は教材の「内容の報告」から教えてください。</p>
 </div></div>
}
