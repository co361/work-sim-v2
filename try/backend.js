/* Public practice only. No network API, credentials, production codes or participant records. */
(function(global){
 'use strict';
 const key='practice.sessions.v1';let selected='',bank;
 const clone=value=>JSON.parse(JSON.stringify(value));
 const fail=reason=>({ok:false,reason});
 const read=()=>{try{return JSON.parse(localStorage.getItem(key)||'{}');}catch(_){return {};}};
 const write=value=>{localStorage.setItem(key,JSON.stringify(value));};
 const find=code=>/^PRACTICE-[A-F0-9]{32}$/.test(String(code||''))?read()[code]:null;
 const data=()=>bank||(bank=fetch('try/practice-data.json?v=20261020senders1').then(r=>{if(!r.ok)throw new Error('체험 과제를 불러오지 못했습니다.');return r.json();}).catch(e=>{bank=null;throw e;}));
 const Backend={
  configure(){return 'browser-practice';},isOn(){return true;},
  async createSession(team){
   const d=await data();if(!Object.hasOwn(d.teams,team))return fail('직무를 선택해 주세요.');
   const bytes=crypto.getRandomValues(new Uint8Array(16));const code='PRACTICE-'+Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
   const all=read();all[code]={team,created:Date.now(),progress:null};write(all);return {ok:true,code,team};
  },
  async check(code){const s=find(code);if(!s)return fail('체험 시작 화면에서 다시 시작해 주세요.');selected=code;return {ok:true,code,team:s.team,name:'체험 사원',day:s.progress?.done?.['1']?2:1,hasProgress:!!s.progress};},
  async load(code){const s=find(code||selected);return s?{ok:true,progress:clone(s.progress),updatedAt:s.updatedAt||null}:fail('저장된 체험이 없습니다.');},
  async save(code,progress){
   if(progress===undefined){progress=code;code=selected;}
   const all=read(),s=all[code];if(!s||!progress||typeof progress!=='object')return fail('체험 저장 정보를 확인해 주세요.');
   if(progress.team&&progress.team!==s.team)return fail('다른 직무의 체험은 저장할 수 없습니다.');
   try{const copy=clone(progress);if(JSON.stringify(copy).length>500000)return fail('체험 기록이 저장 한도를 넘었습니다.');s.progress=copy;s.updatedAt=new Date().toISOString();write(all);return {ok:true,updatedAt:s.updatedAt};}catch(_){return fail('브라우저 저장 공간을 사용할 수 없습니다. 기록을 지우지 않고 다시 시도해 주세요.');}
  },
  async story({code,team,ep}){const s=find(code||selected);if(!s||team!==s.team||Number(ep)!==1)return fail('체험판은 선택한 직무의 첫날만 제공합니다.');const d=await data();return {ok:true,...clone(d.teams[team])};},
  async flush(){return {ok:true};},
  async grade(){return fail('체험 과제는 공개된 규칙으로 평가합니다.');},
  async score(){return fail('정식 채점 서버를 사용하지 않는 체험판입니다.');},
  async issue(){return fail('체험판에는 관리자 기능이 없습니다.');}
 };
 Object.defineProperty(global,'Backend',{value:Object.freeze(Backend),writable:false,configurable:false});
 global.__backendReady=Promise.resolve(true);
 global.StudentAIReview={mount(){},unmount(){}};
})(window);
