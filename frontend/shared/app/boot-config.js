import {API} from '../core/api.js';
import {CFG,setConfig} from '../core/state.js';

// Branding and role labels from the API, fetched before the first screen. A slow or
// unreachable API must not block sign-in, so this gives up after four seconds and the
// built-in defaults stay.
export async function loadConfig(){
 try{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),4000);
  const r=await fetch(API()+'/config/public',{signal:ctl.signal});clearTimeout(t);
  if(r.ok)setConfig(await r.json())}catch{}
 document.title=CFG.app_name}
