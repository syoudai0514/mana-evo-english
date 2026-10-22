import { useEffect,useRef,useState } from 'react'
import { speak,stopSpeech,unlockSpeech } from '../lib/tts.js'
export function useLessonAudio(){
 const [playing,setPlaying]=useState(false),[active,setActive]=useState(-1)
 const sequence=useRef(0)
 const stop=()=>{sequence.current++;stopSpeech();setPlaying(false);setActive(-1)}
 useEffect(()=>()=>{sequence.current++;stopSpeech()},[])
 const play=async(lines,{slow=false,start=0}={})=>{stop();unlockSpeech();const id=++sequence.current;setPlaying(true);for(let i=start;i<lines.length;i++){if(id!==sequence.current)break;setActive(i);const row=typeof lines[i]==='string'?{en:lines[i]}:lines[i];await speak(row.en,{rate:slow?.68:.94,gender:row.speaker==='Sam'?'female':'male'});if(id!==sequence.current)break}if(id===sequence.current){setPlaying(false);setActive(-1)}}
 return {play,stop,playing,active,available:typeof window!=='undefined'&&Boolean(window.speechSynthesis)}
}
