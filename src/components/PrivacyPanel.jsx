import React,{useState} from 'react'
import {aiConsent,setAiConsent} from '../lib/privacy.js'
export default function PrivacyPanel({showToast}){
 const [consented,setConsented]=useState(()=>aiConsent())
 return <section className="card privacy-panel"><h3>AI会話と記録について</h3><p>AI会話では、話した音声・文字と、選んだプロフィールの会話の記憶を、Supabaseの中継を通じてGoogle Geminiへ送ります。名前はニックネームにして、住所・学校名・電話番号・秘密は話さないでください。</p><p>会話の記録・復習カード・教材の進み具合はこの端末に保存します。クラウド保存は「保存・連携」で操作したときに行います。取得済みの聞く番組は端末に音声ファイルとして保存します。</p><p>会話の記憶は各画面から確認・削除できます。PINは端末での誤操作防止です。共用端末では学習後にログアウトしてください。</p><p><a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Geminiの利用条件・データの取り扱い</a>。利用料金と上限は接続先の契約によります。</p><label className="consent-row"><input type="checkbox" checked={consented} onChange={e=>{try{setAiConsent(e.target.checked);setConsented(e.target.checked)}catch{showToast?.('設定を保存できませんでした')}}}/><span>送信先と保存について確認し、AI会話を利用します（子供が使う場合は保護者が確認）</span></label><p className="content-note">AI会話を使わない場合も、教材の文字・端末の読み上げで練習できます。</p></section>
}
