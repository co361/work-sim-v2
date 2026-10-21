/* Both practice frames use their own storage keys on the shared GitHub Pages origin. */
(function(){
 const original={get:Storage.prototype.getItem,set:Storage.prototype.setItem,remove:Storage.prototype.removeItem};
 const prefix='ws7-guided-demo3-v1:';
 Storage.prototype.getItem=function(k){return original.get.call(this,prefix+k);};
 Storage.prototype.setItem=function(k,v){return original.set.call(this,prefix+k,v);};
 Storage.prototype.removeItem=function(k){return original.remove.call(this,prefix+k);};
 const u=new URL(location.href);for(const k of ['api','code','ep','fresh'])u.searchParams.delete(k);
 history.replaceState(null,'',u.pathname+u.search+u.hash);
 window.WS7_VERIFICATION_DEMO=true;window.WS7_PUBLIC_PRACTICE=true;window.BACKEND_URL='';
})();
