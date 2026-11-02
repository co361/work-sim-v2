/* Keep this local demo separate from classroom and previous verification saves. */
(function(){
  const base={get:Storage.prototype.getItem,set:Storage.prototype.setItem,remove:Storage.prototype.removeItem},prefix='ws7-day1-demo:';
  Storage.prototype.getItem=function(k){return base.get.call(this,prefix+k);};
  Storage.prototype.setItem=function(k,v){return base.set.call(this,prefix+k,v);};
  Storage.prototype.removeItem=function(k){return base.remove.call(this,prefix+k);};
  const url=new URL(location.href);
  for(const k of ['code','api','fresh','speed'])url.searchParams.delete(k);
  if(url.searchParams.has('ep')){
    let code=null;try{code=JSON.parse(base.get.call(localStorage,prefix+'demo.guests.v1')||'{}').cs;}catch(_){}
    if(/^DEMO-[A-F0-9]{32}$/.test(code||'')){url.searchParams.set('team','cs');url.searchParams.set('ep','1');url.searchParams.set('code',code);}
    else{url.searchParams.delete('ep');url.searchParams.delete('team');}
  }
  history.replaceState(null,'',url.pathname+url.search+url.hash);
})();
