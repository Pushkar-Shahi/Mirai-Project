import {h,toast,go,setChildren} from '../../core/dom.js';
import {api} from '../../core/api.js';
import {fmt} from '../../core/format.js';
import {pill,card,heading,empty,btn,tbl,picker} from '../../components/ui.js';
import {ask} from '../../components/dialogs.js';
import {hashParams,setParams} from '../../navigation/router.js';

// ---------- Membership requests (coordinators and campus managers) ----------
export const membershipRequestsPage=async b=>{
 let cl=await api('GET','/clubs');
 if(!cl.length)return b.append(card(empty('No clubs yet','You will see join requests for the clubs you manage.')));
 const s=picker(cl.map(c=>[c.id,`${c.name} (${c.approved_count}/${c.capacity}${c.pending_count?` · ${c.pending_count} pending`:''})`]),{'aria-label':'Club'});
 const countBadge=h('span',{class:'mut',style:'margin-left:12px;font-size:14px'});
 const box=h('div');
 const want=hashParams().get('club');
 if(want&&cl.some(c=>String(c.id)===want))s.value=want;

 const load=async()=>{
  setParams({club:s.value});
  const [clFresh,r]=await Promise.all([api('GET','/clubs'),api('GET',`/clubs/${s.value}/memberships`)]);
  cl=clFresh;
  const currentClub=cl.find(c=>String(c.id)===String(s.value));
  if(currentClub){
   countBadge.textContent=`${currentClub.approved_count}/${currentClub.capacity} members · ${currentClub.pending_count} pending`;
  }
  // Refresh option labels with updated counts
  Array.from(s.options).forEach(opt=>{
   const match=cl.find(c=>String(c.id)===String(opt.value));
   if(match)opt.textContent=`${match.name} (${match.approved_count}/${match.capacity}${match.pending_count?` · ${match.pending_count} pending`:''})`;
  });

  setChildren(box,tbl(r,[
   ['Student',m=>[h('strong',{},m.student_name),h('small',{class:'field-hint'},[m.student_code,m.student_campus].filter(Boolean).join(' · '))]],
   ['Type',m=>pill('neutral',m.type==='primary'?'Primary':'Secondary')],
   ['Requested',m=>fmt.date(m.created_at)],
   ['Status',m=>pill(m.status)],
   ['',m=>m.status==='pending'&&h('div',{class:'pill-row'},
    btn('Approve',async()=>{await api('POST',`/memberships/${m.id}/decision`,{decision:'approve'});toast('Approved');await load()}),
    btn('Reject',async()=>{const reason=await ask('Reject request',`Reject ${m.student_name}'s request?`,{confirm:'Reject',danger:true,reason:true});if(reason==null)return;await api('POST',`/memberships/${m.id}/decision`,{decision:'reject',reason:reason||null});toast('Rejected');await load()},'d')
   )]
  ],'No requests for this club'));
 };

 s.onchange=()=>go(load);
 b.append(card(heading('Choose a club','Join requests'),h('div',{style:'display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px'},h('label',{},'Club',s),countBadge),box));
 await load();
};
