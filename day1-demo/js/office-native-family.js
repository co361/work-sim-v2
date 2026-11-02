const ASSET_BASE="https://raw.githubusercontent.com/co361/work-sim-demo/60effcc69664964f06672acbeb4148c711b77451/day1-native/";
const ASSET_ORIGIN=new URL(ASSET_BASE).origin;
// The accepted catalog is the only model selection source. No mesh or clip edits.
const BASELINE_SHA='cbfcd6b2cf95f5b5713d9b9127315812361750deb8695c5768ac39f1ad7dc029';
const CATALOG_SHA='a6dab2a77c0193e39c1ac5e35bac3b25e0d0c53ca3b203d9123b447f799ae392';
const manifest=new Map();
export const nativePolicy=Object.freeze({family:'source50-native36',legacyWalk:false,runPosture:false,armPosture:false,cpuGarment:false,seatedProportions:false,feetIK:false,lean:false,manualBoneCrossfade:false,perFrameVertexScan:false});
export async function installNativeRoster(){
 const response=await fetch(new URL('new-staff50/model-catalog.json',ASSET_BASE).href,{cache:'no-store'});if(!response.ok)throw Error('Native catalog HTTP '+response.status);
 const bytes=await response.arrayBuffer();if(await digest(bytes)!==CATALOG_SHA)throw Error('Frozen native catalog hash mismatch');const catalog=JSON.parse(new TextDecoder().decode(bytes));
 for(const row of catalog.models){if(!/^models\/[\w.-]+\.gltf$/.test(row.model)||!/^[a-f0-9]{64}$/.test(row.jsonSHA256))throw Error('Invalid accepted model '+row.id);manifest.set('acnh_'+row.id,{id:row.id,url:new URL('new-staff50/'+row.model,ASSET_BASE).href,sha256:row.jsonSHA256});}
 manifest.set('acnh_41',{id:41,url:new URL('new-joseongmin41/build/v6/joseongmin41-body-run-hands.glb',ASSET_BASE).href,sha256:BASELINE_SHA});
 const base=window.WorkSimRoster,rows=base.data.characters.map(row=>{const m=manifest.get(row.character_id);if(!m)throw Error('Missing accepted actor '+row.character_id);return Object.freeze({...row,model_url:m.url+'?sha256='+m.sha256,native_model_sha256:m.sha256,native_family:nativePolicy.family});});
 if(rows.length!==50||new Set(rows.map(r=>r.character_id)).size!==50)throw Error('Expected original50 identities');
 const ids=new Map(rows.map(r=>[r.character_id,r])),team=t=>rows.filter(r=>r.team_code===t),player=(t,g)=>team(t).find(r=>r.seat_id===(g==='female'||g==='f'?'staff_f':'staff_m'));
 window.WorkSimRoster=Object.freeze({...base,data:Object.freeze({...base.data,characters:rows}),byId:id=>ids.get(id),team,player,residents:t=>team(t).map(r=>r.character_id),display:id=>ids.get(id)?.display_name||id});
 window.WorkSimNativeImmutable=Object.freeze({stats:immutableNativeStats,verify:verifyImmutableNativeArrays,morphTextures:nativeMorphTextureStats,verifyMorphTextures:verifyNativeMorphTexturePacking});
 window.WorkSimNativeCatalog=Object.freeze({count:rows.length,catalogSHA256:await digest(bytes),policy:nativePolicy,models:()=>rows.map(r=>({id:r.character_id,url:r.model_url,sha256:r.native_model_sha256}))});
}
async function digest(buffer){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function isBakedFamily(json){return Number.isInteger(json?.asset?.extras?.newStaff50Id)||!!json?.asset?.extras?.workSimNew41Retarget;}
// Only this frozen shared resource may enter the immutable decoded-array pool.
const SHARED_URI=new URL('new-staff50/shared/body-connections-dfc0250e2255b993.bin',ASSET_BASE).pathname;
const SHARED_SHA='dfc0250e2255b993e89d12dfe8ce480a65de19e3db33e63e070f9ad4878def0b';
const rawShared=new Map(),decodedShared=new Map();
const immutableStats={hits:0,misses:0,bytes:0,skinAttributesShared:0,modelOwnedAccessorsShared:0,rawHashVerified:false};
function sharedBufferSpec(parser,index){const b=parser.json.buffers[index];if(!b?.uri)return null;const u=new URL(b.uri,parser.options.path);return u.origin===ASSET_ORIGIN&&u.pathname===SHARED_URI?{uri:u.href,sha256:SHARED_SHA,byteLength:b.byteLength}:null;}
function installImmutableAccessors(T,parser){
 parser.worksimNativeSharedKeys=new Set();parser.worksimNativeRawKeys=new Set();
 const ownSkin=new Set();for(const m of parser.json.meshes||[])for(const p of m.primitives||[])for(const k of ['JOINTS_0','JOINTS_1','WEIGHTS_0','WEIGHTS_1'])if(p.attributes[k]!==undefined)ownSkin.add(p.attributes[k]);
 const loadBuffer=parser.loadBuffer.bind(parser),loadAccessor=parser.loadAccessor.bind(parser);
 parser.loadBuffer=index=>{const spec=sharedBufferSpec(parser,index);if(!spec)return loadBuffer(index);const key=JSON.stringify(spec);if(!rawShared.has(key))rawShared.set(key,{users:0,promise:loadBuffer(index).then(async bytes=>{if(bytes.byteLength!==spec.byteLength||await digest(bytes)!==SHARED_SHA)throw Error('Immutable shared buffer hash mismatch');immutableStats.rawHashVerified=true;return bytes;})});const entry=rawShared.get(key);if(!parser.worksimNativeRawKeys.has(key)){parser.worksimNativeRawKeys.add(key);entry.users++;}return entry.promise;};
 const describeView=index=>{const v=parser.json.bufferViews[index],e=v.extensions?.EXT_meshopt_compression,b=sharedBufferSpec(parser,v.buffer),compressed=e&&sharedBufferSpec(parser,e.buffer);if(!b&&!compressed)return null;if(e&&!compressed)return null;const d={...v,buffer:b||{decodedFallbackByteLength:parser.json.buffers[v.buffer].byteLength}};if(e){
  d.extensions={...v.extensions,EXT_meshopt_compression:{...e,buffer:compressed}};
  // A supported decoder reads the compressed range, not the fallback allocation.
  // Keep its exact URI/SHA/spec; fallback placement does not identify decoded data.
  if(parser.options.meshoptDecoder?.supported){d.buffer=compressed;delete d.byteOffset;}
 }return d;};
 const describeAccessor=index=>{const a=parser.json.accessors[index],d={...a},views=[];if(a.bufferView===undefined&&!a.sparse&&a.type==='VEC3')return{implicitZero:true,type:a.type,count:a.count,componentType:a.componentType,normalized:!!a.normalized};if(a.bufferView!==undefined){d.bufferView=describeView(a.bufferView);if(!d.bufferView)return null;views.push(d.bufferView);}if(a.sparse){const indices=describeView(a.sparse.indices.bufferView),values=describeView(a.sparse.values.bufferView);if(!indices||!values)return null;d.sparse={...a.sparse,indices:{...a.sparse.indices,bufferView:indices},values:{...a.sparse.values,bufferView:values}};views.push(indices,values);}return views.length?d:null;};
 const wrapper=a=>{let b;if(a.isInterleavedBufferAttribute){const data=new T.InterleavedBuffer(a.data.array,a.data.stride);b=new T.InterleavedBufferAttribute(data,a.itemSize,a.offset,a.normalized);}else b=new T.BufferAttribute(a.array,a.itemSize,a.normalized);b.name=a.name;b.gpuType=a.gpuType;return b;};
 parser.loadAccessor=index=>{
  // GLTFLoader normalizes skin weights in-place: give every skin its own arrays.
  if(ownSkin.has(index))return loadAccessor(index).then(a=>a.clone());
  const spec=describeAccessor(index);if(!spec)return loadAccessor(index);const key=JSON.stringify(spec);let entry=decodedShared.get(key);
  if(entry)immutableStats.hits++;else{immutableStats.misses++;entry={spec,users:0};entry.promise=loadAccessor(index).then(async attribute=>{const array=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array;entry.attribute=attribute;entry.sha256=await digest(array);entry.bytes=array.byteLength;immutableStats.bytes+=entry.bytes;return attribute;});decodedShared.set(key,entry);}
  if(!parser.worksimNativeSharedKeys.has(key)){parser.worksimNativeSharedKeys.add(key);entry.users++;}
  return entry.promise.then(wrapper);
 };
}
export async function verifyImmutableNativeArrays(){const mismatches=[];for(const[key,entry]of rawShared){if(await digest(await entry.promise)!==SHARED_SHA)mismatches.push('raw:'+key);}for(const[key,entry]of decodedShared){const a=await entry.promise,array=a.isInterleavedBufferAttribute?a.data.array:a.array;if(await digest(array)!==entry.sha256)mismatches.push(key);}return{...immutableStats,entries:decodedShared.size,checkedArrays:decodedShared.size,mismatches,pass:!mismatches.length&&immutableStats.rawHashVerified};}
export const immutableNativeStats=()=>({...immutableStats,entries:decodedShared.size});

export function registerFamilyGarmentGuard(THREE,loader,legacyRegister){
 legacyRegister(THREE,{register(factory){loader.register(parser=>{if(isBakedFamily(parser.json)){installImmutableAccessors(THREE,parser);return{name:'WORKSIM_native36_preserve_all_morphs'};}return factory(parser);});}});return loader;
}
export async function loadVerifiedNative(loader,CH){
 const m=manifest.get(CH);if(!m)throw Error('Unregistered native actor '+CH);
 const url=new URL(m.url,location.href),response=await fetch(url.href+'?sha256='+m.sha256);if(!response.ok)throw Error(CH+' HTTP '+response.status);
 const bytes=await response.arrayBuffer(),sha256=await digest(bytes);if(sha256!==m.sha256)throw Error(CH+' model hash mismatch');
 const gltf=await loader.parseAsync(bytes,new URL('./',url).href),extras=gltf.asset?.extras||{};
 if(m.id===41?!extras.workSimNew41Retarget:extras.newStaff50Id!==m.id)throw Error(CH+' native identity mismatch');
 if(gltf.animations.length!==36)throw Error(CH+' expected36 own clips');
 await tagNativeMorphPayloads(gltf);
 gltf.nativeOwned={geometries:new Set(),materials:new Set(),textures:new Set(),skeletons:new Set()};gltf.scene.traverse(n=>{if(n.geometry)gltf.nativeOwned.geometries.add(n.geometry);if(n.skeleton)gltf.nativeOwned.skeletons.add(n.skeleton);for(const m of [].concat(n.material||[])){gltf.nativeOwned.materials.add(m);for(const v of Object.values(m))if(v?.isTexture)gltf.nativeOwned.textures.add(v);}});
 gltf.nativeRest=[];gltf.scene.traverse(n=>gltf.nativeRest.push({name:n.name,type:n.type,position:n.position.toArray(),quaternion:n.quaternion.toArray(),scale:n.scale.toArray(),morph:n.morphTargetInfluences?.slice()}));
 gltf.nativeProof=Object.freeze({id:m.id,sha256,url:url.href,clips:gltf.animations.map(c=>c.name),policy:nativePolicy});return gltf;
}
export const noNativeCorrection=Object.freeze({restore(){},update(){},setEnabled(){},seatAdvance(){return 0;},state:Object.freeze({enabled:false,source:'native36'}),report:Object.freeze({cpu:false,nativeMorphTracks:true})});

// Reuse preview's interval sphere union. All vertex/morph scans happen once here.
export function cacheNativeBounds(T,root){
 const cached=[];root.traverse(m=>{if(!m.isSkinnedMesh)return;const a=m.geometry.attributes,base=new T.Box3().setFromBufferAttribute(a.position),morph=(m.geometry.morphAttributes.position||[]).map(t=>{const b=new T.Box3();if(m.geometry.morphTargetsRelative)return b.setFromBufferAttribute(t);const v=new T.Vector3();for(let i=0;i<t.count;i++)b.expandByPoint(v.set(t.getX(i)-a.position.getX(i),t.getY(i)-a.position.getY(i),t.getZ(i)-a.position.getZ(i)));return b;});const used=new Set();for(let i=0;i<a.skinIndex.count;i++){const j=[a.skinIndex.getX(i),a.skinIndex.getY(i),a.skinIndex.getZ(i),a.skinIndex.getW(i)],w=[a.skinWeight.getX(i),a.skinWeight.getY(i),a.skinWeight.getZ(i),a.skinWeight.getW(i)];for(let k=0;k<4;k++)if(w[k]>0)used.add(j[k]);}cached.push({m,base,morph,joints:[...used],box:new T.Box3(),sphere:new T.Sphere(),part:new T.Sphere(),posed:new T.Sphere(),matrix:new T.Matrix4()});});
 const stats={method:'cached per-bone active-morph interval spheres',meshes:cached.length,morphBoxes:cached.reduce((n,c)=>n+c.morph.length,0),perFrameVertexScan:false,lastUpdateMS:0};
 const update=()=>{const start=performance.now();root.updateMatrixWorld(true);for(const c of cached){const m=c.m;m.skeleton.update();c.box.copy(c.base);for(let i=0;i<c.morph.length;i++){const w=m.morphTargetInfluences?.[i]||0;if(!w)continue;const d=c.morph[i];c.box.min.addScaledVector(w>0?d.min:d.max,w);c.box.max.addScaledVector(w>0?d.max:d.min,w);}c.box.getBoundingSphere(c.sphere);c.posed.makeEmpty();for(const j of c.joints){c.matrix.fromArray(m.skeleton.boneMatrices,j*16).multiply(m.bindMatrix).premultiply(m.bindMatrixInverse);c.part.copy(c.sphere).applyMatrix4(c.matrix);c.posed.union(c.part);}c.posed.radius+=.0001;m.boundingSphere=c.posed;m.boundingBox=null;}stats.lastUpdateMS=performance.now()-start;};update();return {update,stats};
}

// World travel metadata is measured from this actor's own embedded foot tracks.
// Sampling bones at initialization never changes geometry, weights or animation.
export function ownLocomotion(T,model,bones,mixer,animations,actions){
 const fps=60,clips={},samples={},rest=[];model.traverse(n=>rest.push([n,n.position.clone(),n.quaternion.clone(),n.scale.clone(),n.morphTargetInfluences?.slice()]));
 const reset=()=>{mixer.stopAllAction();for(const[n,p,q,s,w]of rest){n.position.copy(p);n.quaternion.copy(q);n.scale.copy(s);if(w)n.morphTargetInfluences.splice(0,w.length,...w);}mixer.time=0;};
 const point=new T.Vector3(),foot=(side)=>{const b=bones['Foot_'+side];if(!b)throw Error('Native foot bone missing');b.getWorldPosition(point);return point.toArray();};
 for(const clip of animations){actions[clip.name]??=mixer.clipAction(clip);if(!/^(walk|jog)(_|$)/.test(clip.name)&&!clip.name.startsWith('turn_'))continue;reset();const a=mixer.clipAction(clip);a.reset().setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();const n=Math.max(2,Math.round(clip.duration*fps)),rows=[];for(let f=0;f<=n;f++){mixer.setTime(clip.duration*f/n);model.updateMatrixWorld(true);rows.push({L:foot('L'),R:foot('R')});}samples[clip.name]={rows,duration:clip.duration,n};}
 function speedOf(name){const s=samples[name],v=[];for(const side of ['L','R']){const low=Math.min(...s.rows.map(r=>r[side][1]));for(let f=1;f<s.rows.length;f++){const p=s.rows[f-1][side],q=s.rows[f][side],speed=(p[2]-q[2])*s.n/s.duration;if(Math.min(p[1],q[1])<low+.018&&speed>.05&&speed<3)v.push(speed);}}if(v.length<4)throw Error('Insufficient native stance samples '+name);v.sort((a,b)=>a-b);return v[Math.floor(v.length*.5)];}
 const walk=speedOf('walk'),jog=speedOf('jog');
 for(const[name,s]of Object.entries(samples)){
  const period=s.duration,meta={duration_s:period,frames:s.n};
  if(name==='walk'||name==='jog'){const speed=name==='walk'?walk:jog;Object.assign(meta,{kind:'cycle',loop:true,period_s:period,speed_mps:speed,step_m:speed*period/2,duty:name==='walk'?.57:.43});}
  else if(name.startsWith('turn_')){const match=/turn_(left|right)(\d+)/.exec(name),angle=Number(match[2])*Math.PI/180*(match[1]==='left'?1:-1);Object.assign(meta,{kind:'turn',yaw_curve_rad:Array.from({length:s.n+1},(_,i)=>{const t=i/s.n;return angle*t*t*(3-2*t);})});}
  else {const trans=name.includes('_to_'),start=name.endsWith('_start'),from=name.startsWith('jog')?jog:walk,to=name.includes('_to_jog')?jog:name.includes('_to_walk')?walk:from;let distance=0;const root=[[0,0,0]];for(let f=1;f<=s.n;f++){const t=(f-.5)/s.n,p=s.rows[f-1],q=s.rows[f],side=(p.L[1]+q.L[1])<=(p.R[1]+q.R[1])?'L':'R',measured=Math.max(0,p[side][2]-q[side][2]);const schedule=(trans?from+(to-from)*t:start?from*t:from*(1-t))*period/s.n;distance+=measured>schedule*.15&&measured<schedule*2.5?measured:schedule;root.push([0,-distance,0]);}Object.assign(meta,{kind:trans?'transition':start?'start':'stop',root_xy_yaw:root,distance_m:distance,end_phase:start?.5:trans&&name.endsWith('_R')?.5:0,start_speed_mps:from,end_speed_mps:to,end_clip:name.includes('_to_jog')?'jog':'walk',stopped_at_s:period*.75});}
  clips[name]=meta;
 }
 reset();const A={};for(const clip of animations)A[clip.name]=actions[clip.name];actions.jog=A.jog;
 return {KEY:{meta:{fps,clips},A,fps},walkInfo:{keyed:true,source:'own embedded36 bone samples',vNat:walk,period:clips.walk.period_s,duty:clips.walk.duty,moveMps:walk,jogMps:jog,metadataEstimatedWorldTravel:true},report:{method:'initialization-only own native foot stance measurement; world root/yaw schedule, no bone override',fps,walkMPS:walk,jogMPS:jog,clips:Object.keys(clips),vertexScans:0}};
}

export function releaseVerifiedNative(gltf){
 const parser=gltf.parser,owned=gltf.nativeOwned,counts={geometries:owned.geometries.size,materials:owned.materials.size,textures:owned.textures.size,skeletons:owned.skeletons.size,sharedArraysReleased:0};
 for(const s of owned.skeletons)s.dispose();for(const g of owned.geometries)g.dispose();for(const m of owned.materials)m.dispose();for(const t of owned.textures)t.dispose();
 for(const key of parser.worksimNativeSharedKeys||[]){const entry=decodedShared.get(key);if(entry&&--entry.users===0){immutableStats.bytes-=entry.bytes||0;decodedShared.delete(key);counts.sharedArraysReleased++;}}
 for(const key of parser.worksimNativeRawKeys||[]){const entry=rawShared.get(key);if(entry&&--entry.users===0)rawShared.delete(key);}
 parser.worksimNativeSharedKeys?.clear();parser.worksimNativeRawKeys?.clear();parser.cache.removeAll();return counts;
}

const NATIVE_FACE_KEYS=new Set(['mouth_open','blink_L','blink_R','blink_mid_L','blink_mid_R','blink_near_L','blink_near_R','happy','sad','angry','surprised']);
export function nativeTalkFace(meshes,clips,create,opt){
 const policy={scope:'own face morph indices during dialogue only',keys:[...NATIVE_FACE_KEYS],meshes:[],forbiddenWriteAttempts:0};
 const face=meshes.flatMap(mesh=>{const dictionary=Object.fromEntries(Object.entries(mesh.morphTargetDictionary||{}).filter(([key])=>NATIVE_FACE_KEYS.has(key)));if(!Object.keys(dictionary).length)return[];const allowed=new Set(Object.values(dictionary));policy.meshes.push({name:mesh.name,keys:Object.keys(dictionary),indices:[...allowed]});const values=new Proxy(mesh.morphTargetInfluences,{set(target,key,value){if(/^\d+$/.test(String(key))&&!allowed.has(Number(key))){policy.forbiddenWriteAttempts++;throw Error('Native face attempted a non-face morph write');}target[key]=value;return true;}});return[{name:mesh.name,morphTargetDictionary:dictionary,morphTargetInfluences:values}];});
 const fx=create(face,clips,opt);if(!fx)return null;
 return {say:fx.say,glyph:fx.glyph,stop:fx.stop,setMood:fx.setMood,nativeProof:policy,
  update(dt,ctl,clip){if(ctl||fx.speaking||fx.state.active>0||fx.mouth>0)fx.update(dt,ctl,clip);},
  get speaking(){return fx.speaking;},get mood(){return fx.mood;},get mouth(){return fx.mouth;},get state(){return fx.state;}};
}


// Exact, immutable morph payload identity. Geometry/skin and actor influences are not pooled.
const morphHashCache=new WeakMap(),morphNamespace=crypto.randomUUID();
const morphTagStats={geometries:0,tagged:0,hashMS:0};
async function morphAttributeIdentity(attribute){
 const array=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array;
 let hash=morphHashCache.get(array);if(!hash){hash=digest(array);morphHashCache.set(array,hash);}
 return{sha256:await hash,constructor:array.constructor.name,attributeClass:attribute.constructor.name,float16:!!attribute.isFloat16BufferAttribute,gpuType:attribute.gpuType,length:array.length,count:attribute.count,itemSize:attribute.itemSize,normalized:!!attribute.normalized,stride:attribute.isInterleavedBufferAttribute?attribute.data.stride:attribute.itemSize,offset:attribute.isInterleavedBufferAttribute?attribute.offset:0};
}
async function tagNativeMorphPayloads(gltf){
 const start=performance.now(),geometries=new Set();gltf.scene.traverse(m=>{if(m.isMesh&&m.geometry)geometries.add(m.geometry);});const proof=[];
 for(const geometry of geometries){
  const attrs=geometry.morphAttributes,first=attrs.position||attrs.normal||attrs.color;if(!first?.length)continue;morphTagStats.geometries++;
  if(Object.hasOwn(geometry,'workSimNativeMorphShare'))throw Error('Reserved native morph marker already present');
  const descriptor={relative:!!geometry.morphTargetsRelative,vertices:geometry.attributes.position.count,count:first.length,attributes:{}};
  for(const kind of['position','normal','color'])if(attrs[kind]){if(attrs[kind].length!==first.length)throw Error('Inconsistent native morph target count');descriptor.attributes[kind]=[];for(const attribute of attrs[kind])descriptor.attributes[kind].push(await morphAttributeIdentity(attribute));}
  const fingerprint=await digest(new TextEncoder().encode(JSON.stringify(descriptor)));
  Object.defineProperty(geometry,'workSimNativeMorphShare',{value:{key:morphNamespace+':'+fingerprint,contentSHA256:fingerprint,count:first.length,vertexCount:geometry.attributes.position.count,position:attrs.position,normal:attrs.normal,color:attrs.color},configurable:true});
  proof.push({geometry:geometry.name||'',contentSHA256:fingerprint,count:first.length,vertices:geometry.attributes.position.count});morphTagStats.tagged++;
 }
 morphTagStats.hashMS+=performance.now()-start;gltf.nativeMorphPayloads=proof;
}
export function nativeMorphTextureStats(){const registry=globalThis[Symbol.for('worksim.nativeMorphTexturePools.v1')];return{tagging:{...morphTagStats},contexts:registry?[...registry.pools.values()].map(pool=>pool.snapshot()):[],closedContexts:registry?.closed||0};}

export function verifyNativeMorphTexturePacking(){const registry=globalThis[Symbol.for('worksim.nativeMorphTexturePools.v1')];const contexts=registry?[...registry.pools.values()].map(pool=>pool.verifyPacked()):[];return{contexts,pass:contexts.length>0&&contexts.every(x=>x.pass)};}
