import {h,toast,go} from '../../core/dom.js';
import {api} from '../../core/api.js';
import {me} from '../../core/state.js';
import {fmt,dayWhen} from '../../core/format.js';
import {pill,card,heading,btn,tbl} from '../../components/ui.js';
import {frm} from '../../components/forms.js';
import {sessionTag} from '../../components/clipboard.js';
import {hashParams,homeButton} from '../../navigation/router.js';

// ---------- Check-in: scan or type the code and see saved attendance (students) ----------
const place=()=>new Promise(r=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>r({lat:p.coords.latitude,lng:p.coords.longitude}),()=>r({}),{timeout:2500}):r({}));
const SCANNER_SRC='https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
const SCANNER_SRI='sha512-r6rDA7W6ZeQhvl8S7yRVQUKVHdexq+GAlNkNNqVC7YyIV+NwqCTJe2hDWCiffTyRNOeGEzRRJ9ifvRm/HCzGYg==';
let scannerPending=null;
function loadHtml5Qrcode(){if(window.Html5Qrcode)return Promise.resolve(window.Html5Qrcode);
 return scannerPending??=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=SCANNER_SRC;s.integrity=SCANNER_SRI;s.crossOrigin='anonymous';s.referrerPolicy='no-referrer';
  s.onload=()=>window.Html5Qrcode?resolve(window.Html5Qrcode):reject(new Error('Scanner library did not load.'));
  s.onerror=()=>{scannerPending=null;s.remove();reject(new Error('Could not load camera scanner. Type the session ID and code instead.'))};
  document.head.append(s)})}

export async function studentCheckinPage(b){const result=h('div',{'aria-live':'polite'}),hist=h('div'),vid=h('div');
 const showStatus=async(sid,just)=>{const s=await api('GET',`/checkin/sessions/${sid}`),m=s.my_checkin;
  result.replaceChildren(h('div',{class:'checkin-result '+(m?'':s.status==='live'?'wait':'neutral')},h('span',{class:'big-mark'},m?'✓':s.status==='live'?'⌖':'·'),h('div',{},h('strong',{},m?(just?'You are checked in':'Already checked in'):s.status==='live'?'Not checked in yet':'Not checked in'),
   h('p',{},`${s.club_name} · ${s.club_day_title||'Club Day'} · ${dayWhen(s)}`),h('p',{class:'mut'},m?`Recorded ${fmt.dt(m.checked_in_at)}${m.is_late?' · marked late':''}${m.geo_flag?' · location flagged for review':''}`:s.status==='live'?`Window closes ${fmt.clock(s.closes_at)}. Enter the code shown on the screen.`:`This window ${s.status==='closed'?'closed '+fmt.dt(s.closes_at):'has not opened yet'}.`),
   h('div',{class:'pill-row'},sessionTag(s.id),pill(s.status),homeButton()))));
  try{sessionStorage.setItem('lastCheckin',String(sid))}catch{};return s};
 const submitScan=async(sid,token)=>{sid=String(sid||'').trim();token=String(token||'').trim();if(!/^\d+$/.test(sid))throw new Error('Enter the numeric session ID shown with the QR code');if(!token)throw new Error('Enter the code shown on the screen');
  try{const r=await api('POST','/checkin/scan',{session_id:+sid,token,...await place()});toast(r.is_late?'Checked in (late)':'Checked in!');await showStatus(sid,true)}
  catch(e){if(e.status===409&&/already/i.test(e.message)){toast('You are already checked in to this session');await showStatus(sid);return}if(e.status===404||e.status===403)await showStatus(sid).catch(()=>{});throw e}
  load()};
 const load=async()=>hist.replaceChildren(tbl(await api('GET','/checkin/attendance/me'),[['Session',x=>sessionTag(x.session_id)],['Club','club_name'],['Club Day',x=>x.title||'Club Day'],['Date',x=>fmt.date(x.day_date)],['Checked in',x=>fmt.dt(x.checked_in_at)],['',x=>h('div',{class:'pill-row'},x.is_late&&pill('late','Late'),x.corrected&&pill('neutral','Added by staff'))]],'No check-ins yet'));
 const f=frm([['sid','Session ID','text',null,{inputmode:'numeric',pattern:'[0-9]+',autocomplete:'off'}],['token','Code from the screen (or paste the full CLUBCHK:… text)','text',null,{autocomplete:'off'}]],'Check in',async d=>{let{sid,token}=d;if(token.trim().startsWith('CLUBCHK:'))[,sid,token]=token.trim().split(':');await submitScan(sid,token);f.elements.token.value=''},0,{draft:false});
 f.elements.token.addEventListener('input',e=>{const v=e.target.value.trim();if(v.startsWith('CLUBCHK:')){const[,sid]=v.split(':');f.elements.sid.value=sid}});
 f.elements.sid.addEventListener('change',e=>{if(/^\d+$/.test(e.target.value.trim()))showStatus(e.target.value.trim()).catch(()=>result.replaceChildren(h('div',{class:'notice alert'},'No session with that ID for your clubs.')))});
 
 const canScan = ('BarcodeDetector' in window) || Boolean(navigator?.mediaDevices?.getUserMedia);
 const startScanning = async () => {
  try {
   if ('BarcodeDetector' in window) {
    const s = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}});
    const v = h('video', {autoplay: true, playsinline: true, width: 280});
    const det = new BarcodeDetector({formats: ['qr_code']});
    v.srcObject = s;
    const stop = () => { s.getTracks().forEach(t => t.stop()); vid.replaceChildren(); };
    vid.replaceChildren(v, btn('Stop camera', stop, 's'));
    const lp = async () => {
     if (!v.isConnected) return stop();
     const r = await det.detect(v).catch(() => []);
     if (r[0] && r[0].rawValue.startsWith('CLUBCHK:')) {
      stop();
      const [, sid, tk] = r[0].rawValue.split(':');
      await go(() => submitScan(sid, tk));
     } else setTimeout(lp, 350);
    };
    v.onplaying = lp;
   } else {
    const Html5Qrcode = await loadHtml5Qrcode();
    const readerId = 'checkin-qr-reader';
    const readerDiv = h('div', {id: readerId, style: 'max-width:280px;margin:8px auto;overflow:hidden;border-radius:8px'});
    let stopped = false;
    let qrInstance = null;
    const stop = async () => {
     if (stopped) return;
     stopped = true;
     if (qrInstance) {
      await qrInstance.stop().catch(() => {});
      qrInstance.clear();
     }
     vid.replaceChildren();
    };
    vid.replaceChildren(readerDiv, btn('Stop camera', stop, 's'));
    qrInstance = new Html5Qrcode(readerId);
    await qrInstance.start(
     {facingMode: 'environment'},
     {fps: 10, qrbox: {width: 220, height: 220}},
     async (decodedText) => {
      if (decodedText.startsWith('CLUBCHK:')) {
       await stop();
       const [, sid, tk] = decodedText.split(':');
       await go(() => submitScan(sid, tk));
      }
     },
     () => {}
    );
   }
  } catch (err) {
   vid.replaceChildren(h('div', {class: 'notice alert'}, `Camera error: ${err.message || 'Permission denied'}. You can type the code below.`));
  }
 };

 b.append(card(h('div',{class:'identity'},h('div',{class:'avatar'},(me.name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()),h('dl',{},h('div',{},h('dt',{},'Checking in as'),h('dd',{},me.name)),h('div',{},h('dt',{},'Student ID'),h('dd',{},me.student_code||'—'))),homeButton())),
  card(heading('Verified attendance','Check in'),f,vid,canScan?btn('Scan QR with camera',startScanning,'s'):h('p',{class:'mut'},'This browser cannot scan with the camera. Type the session ID and code shown on the screen.'),result),
  card(heading('Saved on the server','My attendance'),hist));
 await load();const lastSid=hashParams().get('session')||sessionStorage.getItem('lastCheckin');if(lastSid)await showStatus(lastSid).catch(()=>sessionStorage.removeItem('lastCheckin'))}
