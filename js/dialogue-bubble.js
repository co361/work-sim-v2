/* 대화 카메라의 실제 화자 위치를 말풍선 꼬리에 반영한다. 채점·입력은 바꾸지 않는다. */
(function(){
  'use strict';
  const talk=document.getElementById('talk');
  const bubble=talk&&talk.querySelector('.tkBox');
  if(!bubble)return;
  let frame=0;
  function point(){
    frame=0;
    if(!talk.classList.contains('open'))return;
    let x=64;
    try{
      const stage=document.getElementById('stage');
      const office=stage&&stage.contentWindow&&stage.contentWindow.__office;
      const shot=office&&office.talkShotInfo&&office.talkShotInfo();
      const own=talk.classList.contains('me');
      const face=shot&&(own?shot.myFace:talk.classList.contains('cam')?shot.npcFace:null);
      if(face&&Number.isFinite(face.x)&&face.x>=-1&&face.x<=1){
        const area=stage.getBoundingClientRect(),box=bubble.getBoundingClientRect();
        x=Math.min(box.width-32,Math.max(32,area.left+(face.x+1)*area.width/2-box.left));
      }
    }catch(_){/* 전화·다른 방 화자는 이름과 사진 쪽 꼬리를 사용한다. */}
    bubble.style.setProperty('--speech-x',Math.round(x)+'px');
    frame=requestAnimationFrame(point);
  }
  function sync(){
    if(talk.classList.contains('open')){if(!frame)frame=requestAnimationFrame(point);}
    else if(frame){cancelAnimationFrame(frame);frame=0;}
  }
  new MutationObserver(sync).observe(talk,{attributes:true,attributeFilter:['class']});
  addEventListener('pagehide',()=>{if(frame)cancelAnimationFrame(frame);frame=0;});
  addEventListener('pageshow',sync);
  sync();
})();
