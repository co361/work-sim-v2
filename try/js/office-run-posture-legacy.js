/* Existing Meshy runtime only: straighten excess waist fold during Shift walk.
   No clip, mesh, hip, leg, speed, or saved-state edits. Native staff50 is separate. */
export function createLegacyRunPosture(THREE,{model,bones,mixer,actions,isFast}) {
 const hips=bones.Hips,lower=bones.Spine02,middle=bones.Spine01,upper=bones.Spine,head=bones.Head;
 if(!hips||!lower||!middle||!upper||!head||!actions.walk)return null;
 const saved=new Map(Object.values(bones).map(b=>[b,b.quaternion.clone()])),refs={},undo=new Map();
 const q=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),worldQ=new THREE.Quaternion(),turn=new THREE.Quaternion(),headQ=new THREE.Quaternion();
 const v=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3();
 const idle=actions.idle?.getClip();
 if(idle)for(const tr of idle.tracks){const match=/^(.+)\.quaternion$/.exec(tr.name),bone=match&&bones[match[1]];if(bone&&tr.values.length>=4)bone.quaternion.fromArray(tr.values,0);}
 model.updateMatrixWorld(true);
 for(const[name,bone]of [['hips',hips],['upper',upper]]){bone.getWorldQuaternion(q);refs[name]=new THREE.Vector3(0,1,0).applyQuaternion(q.invert());}
 for(const[bone,original]of saved)bone.quaternion.copy(original);
 model.updateMatrixWorld(true);
 const info={active:false,weight:0,pelvisPitch:0,chestPitch:0,afterChestPitch:0,correction:0};
 const remember=bone=>{if(!undo.has(bone))undo.set(bone,{pre:bone.quaternion.clone(),post:null});};
 const rotate=(bone,angle)=>{remember(bone);bone.parent.getWorldQuaternion(parentQ);bone.getWorldQuaternion(worldQ);turn.setFromAxisAngle(right,angle);bone.quaternion.copy(parentQ.invert().multiply(worldQ.premultiply(turn)));bone.updateMatrixWorld(true);};
 const pitch=(bone,reference)=>{bone.getWorldQuaternion(q);v.copy(reference).applyQuaternion(q);return Math.atan2(v.dot(forward),v.y);};
 return {
  restore(){for(const[bone,snapshot]of undo){const p=snapshot.post;if(p&&Math.max(Math.abs(bone.quaternion.x-p.x),Math.abs(bone.quaternion.y-p.y),Math.abs(bone.quaternion.z-p.z),Math.abs(bone.quaternion.w-p.w))<1e-7)bone.quaternion.copy(snapshot.pre);}undo.clear();},
  update(){
   const walk=actions.walk;info.active=!!(isFast()&&walk.enabled&&walk.isRunning());info.weight=info.active?Math.max(0,Math.min(1,walk.getEffectiveWeight())):0;info.correction=0;
   if(!info.active)return info;
   model.updateMatrixWorld(true);model.getWorldQuaternion(q);forward.set(0,0,1).applyQuaternion(q);forward.y=0;forward.normalize();right.set(forward.z,0,-forward.x);
   info.pelvisPitch=pitch(hips,refs.hips);info.chestPitch=pitch(upper,refs.upper);
   const maximum=10*Math.PI/180,delta=Math.max(0,info.chestPitch-Math.min(maximum,info.pelvisPitch+maximum));
   info.correction=delta;info.afterChestPitch=info.chestPitch;if(delta<1e-6)return info;
   head.getWorldQuaternion(headQ);rotate(lower,-delta*.4);rotate(middle,-delta*.6);
   remember(head);head.parent.getWorldQuaternion(parentQ);head.quaternion.copy(parentQ.invert().multiply(headQ));head.updateMatrixWorld(true);
   for(const[bone,snapshot]of undo)snapshot.post=bone.quaternion.clone();
   info.afterChestPitch=pitch(upper,refs.upper);return info;
  },
  get state(){return {...info};}
 };
}
