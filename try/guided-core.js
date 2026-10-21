/* Public demonstration rubric. This is not the formal participant assessment. */
(function(root){
 'use strict';
 const ids={visit:'demo3_material',mail:'demo3_reply',phone:'demo3_call'};
 const draft='한도윤 님, 안녕하세요. 요청하신 교구 15개 출고 건을 확인했습니다.\n\n물류팀 자료에 따르면 오늘 출고 가능한 수량은 12개입니다. 잔여 3개는 추가 출고 가능 여부를 확인한 뒤 오늘 15시에 다시 안내드리겠습니다. 확인 전에는 전량 출고를 확정하기 어렵습니다.\n\n감사합니다.';
 function mail(text){
  const t=String(text||'').replace(/\s+/g,'');
  const overpromise=/(?:15개|전량)(?:를|을|모두)?(?:오늘|금일|당일)?(?:출고|발송|배송)(?:를|을)?(?:확정합니다|확정했습니다|보장합니다|하겠습니다|해드리겠습니다)/.test(t);
  const checks=[
   {label:'확인된 오늘 출고 수량 12개',max:10,ok:/(오늘|금일|당일)/.test(t)&&/12개/.test(t)&&/(출고|발송)/.test(t)&&!overpromise},
   {label:'잔여 3개는 추가 확인',max:10,ok:/3개/.test(t)&&/(잔여|나머지|남은)/.test(t)&&/(확인|확정후|알아보)/.test(t)&&!overpromise},
   {label:'15시 후속 안내 약속',max:10,ok:/(15시|오후3시)/.test(t)&&/(안내|회신|연락)/.test(t)},
   {label:'요청자를 부르고 정중하게 회신',max:5,ok:/한도윤/.test(t)&&/(안녕|감사|부탁)/.test(t)}
  ];
  return {points:checks.reduce((n,c)=>n+(c.ok?c.max:0),0),max:35,checks,overpromise};
 }
 function evidence(st){return !!(st?.rb?.includes('DEMO-OPS-01')||st?.ask?.cap>=100);}
 function result(cards){
  const v=cards[ids.visit]||{},m=cards[ids.mail]||{},p=cards[ids.phone]||{};
  const email=mail(m.text),parts=[
   {label:'부서 간 협업',points:v.status==='done'&&(v.guidedMaterialReceived===true||v.ask?.cap>=100)?25:0,max:25,detail:'물류팀 오대리에게 출고 자료를 직접 받았는가'},
   {label:'근거 확인',points:(m.status==='done'?m.guidedEvidenceAtSend:evidence(m))?20:0,max:20,detail:'발송 전에 체험 사규 조항을 열거나 물류팀에 처리 기준을 확인했는가'},
   {label:'메일 판단과 전달',points:m.status==='done'?email.points:0,max:35,detail:email.checks.map(c=>(c.ok?'✓ ':'보완: ')+c.label).join(' · ')},
   {label:'돌발 전화 대응',points:p.status==='done'?(p.choice==='verify'?20:p.choice==='refuse'?6:0):0,max:20,detail:'확인된 수량과 다음 안내 시점을 말하고 무리한 확답을 피했는가'}
  ];
  return {version:'demo3-20261021',officialAssessment:false,score:parts.reduce((s,p)=>s+p.points,0),parts,draftUsed:!!m.guidedDraftUsed,complete:Object.values(ids).every(id=>cards[id]?.status==='done'),email};
 }
 root.GuidedDemoRules=Object.freeze({ids,draft,mail,evidence,result});
})(typeof window!=='undefined'?window:globalThis);
