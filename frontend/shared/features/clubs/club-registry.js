import {h,toast} from '../../core/dom.js';
import {api} from '../../core/api.js';
import {me,can,roleLabel} from '../../core/state.js';
import {fmt,STATUS,formatClubLabel,formatPersonLabel} from '../../core/format.js';
import {pill,card,heading,empty,btn,tbl,statGrid,clean,picker} from '../../components/ui.js';
import {frm} from '../../components/forms.js';
import {modal,ask} from '../../components/dialogs.js';
import {nav,render} from '../../navigation/router.js';
import {showQuickClub} from './quick-club.js';

// ---------- Coordinator / User Profile Modal ----------
export async function showUserProfile(userId){
 try{
  const list=await api('GET',`/users?q=${encodeURIComponent(userId)}`);
  const u=list.find(x=>x.id===userId)||list[0];
  if(!u){toast('Profile not found');return}
  const content=h('div',{},
   h('p',{},h('strong',{},u.name),h('span',{class:'mut'},` (${roleLabel(u.role)})`)),
   statGrid([
    ['Account ID',u.id],
    ['Email',u.email||'—'],
    ['Campus',u.campus_name||'—'],
    ['Identifier / Code',u.student_code||'—'],
    ['Created',fmt.date(u.created_at)]
   ]),
   h('div',{class:'pill-row',style:'margin-top:16px;'},
    btn('Open in Administration',()=>{close();nav('Administration')},'s')
   )
  );
  const close=modal(`${u.name} · Profile`,content);
 }catch(e){
  toast('Could not load profile: '+e.message);
 }
}

// ---------- Clubs: registry, approval and staff (campus managers and super admins) ----------
export const clubRegistryPage=async b=>{
 const cl=await api('GET','/clubs');
 showQuickClub(b,cl);

 const admin=can('club.edit'),
       advisors=admin?await api('GET','/users?role=advisor'):[],
       campuses=me.role==='super_admin'?await api('GET','/campuses'):[];

 const advOpts=[['','No advisor yet'],...advisors.map(a=>[a.id,`${a.name}${me.role==='super_admin'?' · '+(a.campus_name||''):''}`])];

 if(can('club.create')){
  b.append(card(
   heading(me.role==='super_admin'?'Proposals need campus approval':'Approved on creation','Create club'),
   frm([
    ['name','Name','text',null,{maxlength:160}],
    ['?description','Description','area',null,{maxlength:4000}],
    ['capacity','Capacity','number',null,{min:1,max:100000}],
    ['?advisor_id','Faculty advisor','select',advOpts],
    ['?meeting_rules','Meeting rules','area'],
    ...(me.role==='super_admin'?[['campus_id','Campus','select',campuses.map(c=>[c.id,c.name])]]:[])
   ],'Create club',async d=>{
    const rules=d.meeting_rules?.trim()?{meeting_rules:d.meeting_rules.trim()}:{};
    delete d.meeting_rules;
    clean(d);
    d.capacity=+d.capacity;
    if(d.advisor_id)d.advisor_id=+d.advisor_id;
    if(d.campus_id)d.campus_id=+d.campus_id;
    const r=await api('POST','/clubs',{...d,rules});
    toast(r.approval_status==='pending'?'Club proposed; it waits for campus approval':'Club created');
    render('Clubs');
   })
  ));
 }

 const decision=c=>c.approved_by_name?h('small',{},`${STATUS[c.approval_status]?.[0]||c.approval_status} by ${c.approved_by_name}`,h('br'),fmt.dt(c.approved_at),c.approval_reason&&[h('br'),'“'+c.approval_reason+'”']):h('small',{class:'mut'},'—');

 const actions=c=>[
  btn('Details',()=>clubDetails(c.id),'s'),
  admin&&btn('Edit',()=>editClub(c,advOpts),'s'),
  can('club.approve')&&c.approval_status!=='approved'&&btn('Approve',async()=>{
   if(!await ask('Approve club',`Approve “${c.name}”? Students on the campus will be able to join it.`,{confirm:'Approve'}))return;
   await api('POST',`/clubs/${c.id}/decision`,{decision:'approve'});
   toast('Club approved');
   render('Clubs');
  },'s'),
  can('club.approve')&&c.approval_status!=='rejected'&&btn(c.approval_status==='approved'?'Unapprove':'Reject',async()=>{
   const reason=await ask(c.approval_status==='approved'?'Unapprove club':'Reject club',c.approval_status==='approved'?`“${c.name}” will be hidden from students and stop accepting Club Days. Memberships and history are kept.`:`Reject the proposal for “${c.name}”?`,{confirm:c.approval_status==='approved'?'Unapprove':'Reject',danger:true,reason:true,reasonRequired:c.approval_status==='approved'});
   if(reason==null)return;
   await api('POST',`/clubs/${c.id}/decision`,{decision:'reject',reason:reason||null});
   toast(c.approval_status==='approved'?'Club unapproved':'Club rejected');
   render('Clubs');
  },'d'),
  can('club.deactivate')&&(c.is_active?btn('Deactivate',async()=>{
   const reason=await ask('Deactivate club',`“${c.name}” keeps its members and history but stops accepting new members, Club Days and check-ins.`,{confirm:'Deactivate',danger:true,reason:true,reasonRequired:true});
   if(reason==null)return;
   await api('POST',`/clubs/${c.id}/status`,{active:false,reason});
   toast('Club deactivated');
   render('Clubs');
  },'d'):btn('Reactivate',async()=>{
   if(!await ask('Reactivate club',`Reactivate “${c.name}”?`,{confirm:'Reactivate'}))return;
   await api('POST',`/clubs/${c.id}/status`,{active:true});
   toast('Club reactivated');
   render('Clubs');
  },'s')),
  can('club.delete')&&btn('Delete',async()=>{
   if(!await ask('Delete club permanently',`Delete “${c.name}”? This is only possible for a club with no members, Club Days or budget requests, and cannot be undone. Use Deactivate to keep its history.`,{confirm:'Delete permanently',danger:true}))return;
   await api('DELETE',`/clubs/${c.id}`);
   toast('Club deleted');
   render('Clubs');
  },'d')
 ];

 b.append(card(
  heading(`${cl.length} club${cl.length===1?'':'s'}`,'All clubs'),
  tbl(cl,[
   ['Club',c=>[h('strong',{},formatClubLabel(c,{campus:me?.campus_name})),h('small',{class:'field-hint'},[c.advisor_name&&'Advisor: '+c.advisor_name].filter(Boolean).join(' · '))]],
   ['Status',c=>h('div',{class:'pill-row'},pill(c.approval_status),pill(c.is_active?'active':'inactive'))],
   ['Decision',decision],
   ['Members',c=>`${c.approved_count}/${c.capacity}${c.pending_count?` · ${c.pending_count} pending`:''}`],
   ['Coordinators',c=>c.coordinators?.length?h('div',{class:'pill-row'},...c.coordinators.map(x=>h('button',{type:'button',class:'s ghost',title:'View profile',onclick:()=>showUserProfile(x.id)},formatPersonLabel(x,{campus:me?.campus_name})))):'—'],
   ['Actions',c=>h('div',{class:'pill-row'},actions(c))]
  ],'No clubs yet')
 ));

 // ID-driven coordinator assignment with preview, validation, and direct profile link (B4)
 if(can('club.coordinators')&&cl.length){
  const coordForm=h('div',{class:'add-coord-form'});
  const clubSelect=picker(cl.map(c=>[c.id,formatClubLabel(c,{campus:me?.campus_name})]),{'aria-label':'Select club'});
  const identInput=h('input',{type:'text',placeholder:'Enter coordinator account ID or email, e.g. 4 or coord@example.edu','aria-label':'Coordinator identifier'});
  const previewBox=h('div',{class:'coord-preview',style:'margin:12px 0;min-height:24px;'});
  let selectedCoord=null;

  const assignBtn=btn('Assign coordinator',async()=>{
   if(!selectedCoord)return;
   await api('POST',`/clubs/${clubSelect.value}/coordinators`,{user_id:+selectedCoord.id});
   toast('Coordinator assigned');
   render('Clubs');
  },'primary');
  assignBtn.disabled=true;

  const validateCoordinator=async()=>{
   const q=identInput.value.trim();
   previewBox.replaceChildren();
   selectedCoord=null;
   assignBtn.disabled=true;

   if(!q)return;

   const targetClub=cl.find(c=>c.id==clubSelect.value);
   if(!targetClub)return;

   if(targetClub.approval_status!=='approved'){
    previewBox.replaceChildren(h('p',{class:'field-error',style:'color:var(--alert,#ff5555);'},`Club “${targetClub.name}” is not approved yet (status: ${targetClub.approval_status}). Only approved clubs can have coordinators assigned.`));
    return;
   }
   if(!targetClub.is_active){
    previewBox.replaceChildren(h('p',{class:'field-error',style:'color:var(--alert,#ff5555);'},`Club “${targetClub.name}” is inactive. Only active clubs can have coordinators assigned.`));
    return;
   }

   try{
    const found=await api('GET',`/users?q=${encodeURIComponent(q)}`);
    const user=found.find(u=>String(u.id)===q||u.email?.toLowerCase()===q.toLowerCase())||found[0];
    if(!user){
     previewBox.replaceChildren(h('p',{class:'field-error',style:'color:var(--alert,#ff5555);'},`No account found with identifier “${q}”.`));
     return;
    }

    if(user.role!=='coordinator'){
     previewBox.replaceChildren(h('p',{class:'field-error',style:'color:var(--alert,#ff5555);'},`Account “${user.name}” has role “${roleLabel(user.role)}”. Only accounts with the Club coordinator role can be assigned.`));
     return;
    }

    if(user.campus_id!==targetClub.campus_id){
     previewBox.replaceChildren(h('p',{class:'field-error',style:'color:var(--alert,#ff5555);'},`Campus mismatch: “${user.name}” belongs to ${user.campus_name||'another campus'}, but “${targetClub.name}” is at ${targetClub.campus_name||'a different campus'}. Coordinators must belong to the club's campus.`));
     return;
    }

    if((targetClub.coordinators||[]).some(x=>x.id===user.id)){
     previewBox.replaceChildren(h('p',{class:'field-error',style:'color:var(--alert,#ff5555);'},`“${user.name}” is already assigned as a coordinator for “${targetClub.name}”.`));
     return;
    }

    selectedCoord=user;
    assignBtn.disabled=false;
    previewBox.replaceChildren(
     h('div',{class:'pill-row',style:'align-items:center;'},
      h('span',{class:'pill good'},'Valid coordinator'),
      h('strong',{},`${user.name}, ${user.email}, ${user.campus_name||'No campus'}`),
      btn('View profile',()=>showUserProfile(user.id),'s ghost')
     )
    );
   }catch(err){
    previewBox.replaceChildren(h('p',{class:'field-error',style:'color:var(--alert,#ff5555);'},err.message||'Lookup failed'));
   }
  };

  let t;
  identInput.oninput=()=>{clearTimeout(t);t=setTimeout(validateCoordinator,300)};
  clubSelect.onchange=validateCoordinator;
  const lookupBtn=btn('Validate',validateCoordinator,'s');

  coordForm.append(
   h('div',{class:'filters',style:'flex-direction:column;align-items:stretch;gap:12px;'},
    h('label',{},'Select club',clubSelect),
    h('label',{},'Coordinator identifier (account ID or email)',h('div',{class:'pill-row'},identInput,lookupBtn)),
    previewBox,
    h('div',{class:'pill-row'},assignBtn)
   )
  );

  b.append(card(heading('Club staff','Add a coordinator'),coordForm));
 }
};

async function clubDetails(id){
 const c=await api('GET',`/clubs/${id}`);
 const body=h('div',{},
  h('div',{class:'pill-row'},pill(c.approval_status),pill(c.is_active?'active':'inactive')),
  h('p',{},c.description||h('span',{class:'mut'},'No description.')),
  statGrid([
   ['Members',`${fmt.n(c.approved_count)} / ${fmt.n(c.capacity)}`],
   ['Pending requests',fmt.n(c.pending_count)],
   ['Club Days',fmt.n(c.club_days)],
   ['Created',fmt.date(c.created_at),c.created_by_name?'by '+c.created_by_name:'']
  ]),
  h('h4',{},'Coordinators'),
  c.coordinators?.length?h('div',{class:'list'},c.coordinators.map(x=>h('div',{class:'list-item'},
   h('button',{type:'button',class:'ghost',style:'font-weight:bold;cursor:pointer;',onclick:()=>showUserProfile(x.id)},x.name),
   can('club.coordinators')&&btn('Remove',async()=>{
    if(!await ask('Remove coordinator',`Remove ${x.name} from ${c.name}?`,{confirm:'Remove',danger:true}))return;
    await api('DELETE',`/clubs/${id}/coordinators/${x.id}`);
    toast('Coordinator removed');
    close();
    clubDetails(id);
   },'d')
  ))):h('p',{class:'mut'},'None assigned.'),
  h('h4',{},'Status history'),
  c.history?.length?h('ul',{class:'timeline'},c.history.map(x=>h('li',{},h('strong',{},x.action.replace('club.','').replaceAll('_',' ')),` · ${x.actor_name||'System'} · ${fmt.dt(x.at)}`,x.reason&&` · “${x.reason}”`))):h('p',{class:'mut'},'No changes recorded.')
 );
 const close=modal(c.name,body);
}

function editClub(c,advOpts){
 const close=modal(`Edit ${c.name}`,frm([
  ['name','Name','text',null,{maxlength:160}],
  ['?description','Description','area',null,{maxlength:4000}],
  ['capacity','Capacity','number',null,{min:1}],
  ['?advisor_id','Faculty advisor','select',advOpts],
  ['?meeting_rules','Meeting rules','area']
 ],'Save changes',async d=>{
  const body={
   name:d.name,
   description:d.description||'',
   capacity:+d.capacity,
   advisor_id:d.advisor_id?+d.advisor_id:null,
   rules:{...(c.rules||{}),meeting_rules:d.meeting_rules?.trim()||undefined}
  };
  if(!body.rules.meeting_rules)delete body.rules.meeting_rules;
  await api('PATCH',`/clubs/${c.id}`,body);
  toast('Club updated');
  close();
  render('Clubs');
 },0,{draft:false,init:{name:c.name,description:c.description,capacity:c.capacity,advisor_id:c.advisor_id??'',meeting_rules:c.rules?.meeting_rules||''}}));
}
