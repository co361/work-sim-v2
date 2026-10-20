/* User-selected employee faces. Authored scenario names/choices remain unchanged. */
(function(global){
 'use strict';
 const base=global.WorkSimRoster, selection=global.WorkSimEmployeeFaces;
 if(!base||!selection)return;
 const seats=['lead','senior','chief','staff_m','staff_f'];
 const roles={lead:'팀장',senior:'선임',chief:'주임',staff_m:'사원',staff_f:'사원'};
 const canonical={cs:['김민아 팀장','박선임','이주임'],logi:['강태호 팀장','오대리','장주임'],acct:['서지현 팀장','한주임','문주임'],ga:['이재훈 팀장','최주임','권주임'],rec:['노윤아 팀장','김선임','홍주임'],plan:['조성민 팀장','류선임','신주임'],qc:['배정훈 팀장','남선임','도주임'],pr:['황서연 팀장','진선임','표주임'],edu:['문경수 팀장','손선임','반주임'],buy:['양지훈 팀장','구선임','엄주임']};
 const legacy={cs:[30,31,21,34],logi:[45,23,18],acct:[19,37,20],ga:[24,22,27],rec:[32,17,43],plan:[41,40,38],qc:[26,28,35],pr:[42,44,33],edu:[29,46,36],buy:[39,47,48]};
 const assetOrigin=global.WorkSimNativeAssetOrigin||'https://co361.github.io/work-sim-demo/';
 const rows=[], teams={}, legacyRoles=new Map();
 for(const team of Object.keys(base.data.teams)){
  const original=base.team(team), assigned=original.slice();
  for(const [gender,seat] of [['male','staff_m'],['female','staff_f']]){
   const id=selection[team]?.[gender], from=assigned.findIndex(c=>c.character_id===id), to=seats.indexOf(seat);
   if(from<0||assigned[from].gender!==gender)throw new Error('Invalid employee selection '+team);
   [assigned[from],assigned[to]]=[assigned[to],assigned[from]];
  }
  teams[team]=assigned.map(c=>Number(c.character_id.slice(5)));
  assigned.forEach((c,index)=>{
   const seat=seats[index], title=roles[seat], player=index>=3;
   rows.push({...c,seat_id:seat,title,player_selectable:player,display_name:player?c.full_name+' '+title:canonical[team][index],model_url:new URL(c.model_url,assetOrigin).href,portrait_url:new URL('assets/native_staff50/portraits/'+c.character_id+'.png'+new URL(c.model_url,assetOrigin).search,assetOrigin).href});
  });
  legacy[team].slice(0,3).forEach((id,index)=>legacyRoles.set('acnh_'+id,{team,seat:seats[index]}));
 }
 const ids=new Map(rows.map(c=>[c.character_id,c]));
 const team=t=>rows.filter(c=>c.team_code===t), at=(t,seat)=>team(t).find(c=>c.seat_id===seat);
 const player=(t,g)=>at(t,g==='female'||g==='f'?'staff_f':'staff_m');
 const data=Object.freeze({...base.data,status:'user_selected_employee_faces',teams,characters:rows});
 global.WorkSimRoster=Object.freeze({data,byId:id=>ids.get(id),team,player,residents:t=>team(t).map(c=>c.character_id),display:id=>ids.get(id)?.display_name||id});
 global.bindStoryFaces=function(story,ownTeam,gender){
  const self=player(ownTeam,gender), peer=team(ownTeam).find(c=>c.player_selectable&&c.character_id!==self.character_id);
  for(const [name,info] of Object.entries(story.npcs||{})){
   let row;
   if(info.binding==='player'||info.seat==='me')row=self;
   else if(info.binding==='peer'||info.role==='동기'||info.seat==='staff'||['윤하린','정수빈','임도윤','백하은','송민재','안예린','유하늘','곽민서','차은우','하지원'].includes(name)){
    const department=Object.keys(base.data.teams).find(t=>t!==ownTeam&&String(info.persona?.note||'').includes(base.team(t)[0].team_name));
    const friendGender={윤하린:'f',정수빈:'f',임도윤:'m',백하은:'f',차은우:'m',하지원:'f'};
    row=department?player(department,friendGender[name]||'f'):peer;
    if(row===peer&&!info.seat)info.seat='staff';
   }
   else if(['lead','senior','chief'].includes(info.seat))row=at(ownTeam,info.seat);
   else {const original=legacyRoles.get(info.ch);if(original)row=at(info.teamKey||original.team,original.seat);}
   // ch is only a portrait/model binding. Never rename an NPC or mutate card keys.
   if(row)info.ch=row.model_id;
  }
  return story;
 };
})(typeof window!=='undefined'?window:globalThis);
