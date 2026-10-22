import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {CONTENT,validateContent,KID_ACTIVITIES} from '../src/content/index.js'
import {TOEIC_QUESTIONS,TOEIC_STIMULI,validateToeic} from '../src/content/toeic.js'
const errors=[...validateContent(),...validateToeic()];if(errors.length){console.error(errors);process.exit(1)}
const counts=Object.fromEntries([...new Set(CONTENT.map(i=>i.kind))].map(kind=>[kind,CONTENT.filter(i=>i.kind===kind).length]));counts.toeic=TOEIC_QUESTIONS.length
const report={schemaVersion:1,counts,kidPhraseSlots:KID_ACTIVITIES.flatMap(i=>i.phrases).length,kidUniqueEnglishPhrases:new Set(KID_ACTIVITIES.flatMap(i=>i.phrases.map(p=>p.en))).size,toeicStimuli:TOEIC_STIMULI.length,independentlyReviewed:0,audioFilesPreRecorded:0,photo:{path:'/learning/toeic/photo-sheet-v1.png',sha256:createHash('sha256').update(readFileSync('public/learning/toeic/photo-sheet-v1.png')).digest('hex'),bytes:readFileSync('public/learning/toeic/photo-sheet-v1.png').length,source:'Generated original montage, 18 cells',rights:'Project original generated image',review:'visually inspected against 18 scene descriptions'},pending:['Independent English/Japanese review','Phoneme reference recordings','iOS physical-device audio validation']}
writeFileSync('docs/CONTENT_REPORT.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
