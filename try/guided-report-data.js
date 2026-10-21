/* Demo-only, in-memory inputs for the existing student report. Never saved as
   formal evidence, never sent to a participant grading or storage service. */
(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 function evidence(id,ov,el,s){const meta=NCS.ov[ov];return {id,ov,el:el||meta.el,s,m:meta.m,cx:1,wv:meta.w};}
 function actual(cards,story,at){
  const R=GuidedDemoRules,result=R.result(cards),{visit:V,mail:M,phone:F}=R.ids,records={};
  for(const id of [V,M,F]){
   const c=cards[id]||{};if(c.status!=='done')continue;
   const ev=[];
   // Guided navigation is not independent route-finding evidence. The question
   // and telephone answer are selections, not observed speech or direct work.
   if(id===V&&(c.guidedMaterialReceived||c.ask?.cap>=100))ev.push(evidence('demo-question','askq',null,3));
   if(id===M&&!result.draftUsed)ev.push(evidence('demo-mail','need','1-1.2',Math.floor(result.email.points/35*3)));
   if(id===F)ev.push(evidence('demo-phone','key','5-3.2',c.choice==='verify'?3:c.choice==='refuse'?1:0));
   records[id]={act:id===V?'ask':id===M?'reply':c.choice,choice:c.choice||'',score:id===V?result.parts[0].points*4:id===M?Math.round(result.email.points/35*100):c.choice==='verify'?100:c.choice==='refuse'?30:0,text:c.text||'',ev:NcsEval.format(ev)};
  }
  const progress={team:'cs',name:'내 체험',done:{'1':{at:at||new Date().toISOString(),level:result.score>=80?'hi':result.score>=50?'mid':'low',cards:records,ncs2:{v:1,day:''}}}};
  return {kind:'actual-demo-actions',officialAssessment:false,synthetic:false,progress,stories:{'cs-ep1':clone(story)},result};
 }
 function example(){
  // Entirely fictional demonstration fixture; no student record or answer bank.
  const stories={},progress={team:'cs',name:'가상 학생 · 결과 구성 예시',done:{}};
  const skills=[['1-1.2',[3,3,3,2,3,3,3]],['6-1.2',[2,2,1,2,2,3,2]],['2-1.2',[1,2,1,1,2,1,2]],['3-1.2',[2,3,2,3,2,3,3]],['4-3.3',[2,2,2,3,2,3,3]],['5-1.3',[3,3,2,3,3,3,3]],['7-1.2',[2,3,3,3,2,3,3]]];
  const groups=[{title:'출고 문의 확인 후 회신',type:'email',act:'reply',who:'한도윤',skills:[0,1],text:'가상 예시: 확인된 출고 수량과 추가 확인할 사항을 구분해 안내했습니다.'},{title:'출고 수량 집계와 우선순위 정리',type:'report',act:'work',who:'김민아 팀장',skills:[2,3,4],text:'가상 예시: 부서별 수량을 집계하고 급한 요청의 처리 순서를 정했습니다.'},{title:'물류팀과 후속 대응 협의',type:'visit',act:'ask',who:'오대리',skills:[5,6],text:'가상 예시: 담당 부서와 잔여 수량을 확인하고 후속 안내 역할을 나눴습니다.'}];
  for(let day=1;day<=7;day++){
   const story={team:'cs',teamName:'고객상담팀',title:'가상 예시 · '+['첫 출근','사규 확인','수량 검토','부서 협업','요청 조율','긴급 대응','최종 보고'][day-1],cards:[],dests:[],dialog:{debrief:{lead:{hi:'가상 예시 기록입니다.',mid:'가상 예시 기록입니다.'}}}};
   const rec={at:'2026-10-'+String(day).padStart(2,'0')+'T09:00:00Z',level:'hi',cards:{},ncs2:{v:1,day:''}};
   groups.forEach((g,i)=>{const id='example_d'+day+'_'+i,ev=g.skills.map(k=>evidence('example-'+k,'need',skills[k][0],skills[k][1][day-1]));story.cards.push({id,type:g.type,from:g.who,subj:g.title});rec.cards[id]={act:g.act,score:Math.round(ev.reduce((s,e)=>s+e.s,0)/ev.length/3*100),text:g.text,ev:NcsEval.format(ev)};});
   if(day===7){
    const labels=['상황과 목표','자료와 계산','원인과 기준','결정과 대안','실행과 후속 확인'];
    story.ep7={endings:{B:{name:'가상 예시 · 근거를 갖춘 제안'}},report:labels.map((title,i)=>({key:'p'+(i+1),title})),decisionFields:['최종 결정','선택 근거'],questions:[{q:'잔여 수량은 어떻게 안내하겠습니까?',choices:[{label:'확인된 수량부터 안내하고 잔여분은 담당자 확인 후 약속한 시각에 다시 연락하겠습니다.'}]}],table:[{key:'a'},{key:'b'},{key:'c'}],criteria:[{key:'a'},{key:'b'}]};
    Object.assign(rec,{ending:'B',total:8,rubric:{p1:2,p2:1,p3:2,p4:1,p5:2},report:Object.fromEntries(labels.map((t,i)=>['p'+(i+1),'가상 예시: '+t+'을 출고 자료와 부서 확인 기록에 따라 정리했습니다.'])),decision:{'최종 결정':'확인된 수량 우선 출고','선택 근거':'미확인 수량의 확답을 피하고 후속 안내 시점을 정함'},dropped:'가상 예시: 전량 즉시 출고 확답은 확인 근거가 없어 제외했습니다.',idea:'가상 예시: 출고 확인 양식에 다음 안내 시각을 함께 기록합니다.',reflection:'가상 예시: 수량 집계에서 단위를 다시 확인할 필요가 있었습니다.',questions:[{i:0,j:0,score:2}],tableOk:2,calcOk:1,violations:[]});
   }
   stories['cs-ep'+day]=story;progress.done[String(day)]=rec;
  }
  return {kind:'fictional-seven-day-example',officialAssessment:false,synthetic:true,progress,stories};
 }
 function model(snapshot){return ResultPdf.model(snapshot.progress,snapshot.stories,{team:'cs',name:snapshot.progress.name});}
 root.GuidedReportData=Object.freeze({actual,example,model});
})(typeof window!=='undefined'?window:globalThis);
