import {useEffect,useRef,useState} from 'react'
import {learnerProgress,saveLessonDraft} from '../lib/learning.js'
export function useLessonSession({item,learning,learnerId,updateLearning}){
 const initial={phase:'learn',index:0,answers:{},notes:{},node:item.start||'start',path:[],help:false,mode:'guided'}
 const [draft,setDraft]=useState(()=>({...initial,...learnerProgress(learning,learnerId).drafts[item.id]}))
 const updateRef=useRef(updateLearning);updateRef.current=updateLearning
 useEffect(()=>{updateRef.current(prev=>saveLessonDraft(prev,learnerId,item.id,draft))},[draft,item.id,learnerId])
 const patch=value=>setDraft(prev=>({...prev,...(typeof value==='function'?value(prev):value)}))
 return {draft,patch,restart:()=>setDraft(initial)}
}
