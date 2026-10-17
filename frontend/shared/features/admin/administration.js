import {h,go,toast} from '../../core/dom.js';
import {api} from '../../core/api.js';
import {me,roleLabel} from '../../core/state.js';
import {fmt} from '../../core/format.js';
import {STUDENT_CODE_RE,STUDENT_CODE_HINT} from '../../core/validation.js';
import {card,heading,tbl,picker,clean,multiFilter} from '../../components/ui.js';
import {frm} from '../../components/forms.js';

// ---------- Administration: accounts and campuses. `extraCards` lets a portal add
// its own cards first; the super admin portal adds campus creation. ----------
export const createAdministrationPage=({extraCards=[]}={})=>async b=>{
  const campuses=await api('GET','/campuses'),
        opts=campuses.map(c=>[c.id,c.name]),
        box=h('div'),
        search=h('input',{type:'search',placeholder:'Search name, email, student ID or employee ID','aria-label':'Search accounts'}),
        roleF=multiFilter([['','All roles'],['student','Students'],['coordinator','Coordinators'],['advisor','Advisors'],['campus_admin','Campus managers'],['super_admin','Super admins']],{'aria-label':'Role'});

  for(const extra of extraCards)extra(b);
  const roles=me.role=='super_admin'?['student','coordinator','advisor','campus_admin','super_admin']:['student','coordinator','advisor'];
  const fields=[
    ['name','Full name','text',null,{maxlength:160}],
    ['email','Email','email'],
    ['?phone_e164','Phone number (WhatsApp, international e.g. +14155552671)','tel',null,{pattern:'\\+[1-9][0-9]{7,14}',maxlength:16,hint:'Format: +<country_code><number>, e.g. +14155552671'}],
    ['password','Temporary password (10+ characters)','password',null,{minlength:10,maxlength:128,autocomplete:'new-password'}],
    ['role','Role','select',roles.map(r=>[r,roleLabel(r)])],
    ['?student_code','Student ID (required for students)','text',null,{pattern:STUDENT_CODE_RE,maxlength:40,hint:STUDENT_CODE_HINT}]
  ];
  if(me.role=='super_admin')fields.push(['?campus_id','Campus','select',[['','No campus (super admin only)'],...opts]]);

  const createForm=frm(fields,'Create account',async d=>{
    clean(d);
    if(d.phone_e164){
      d.phone_e164=d.phone_e164.trim();
      if(!/^\+[1-9][0-9]{7,14}$/.test(d.phone_e164))throw new Error('Phone number must be in E.164 format, e.g. +14155552671');
    }
    if(d.role==='student'&&!d.student_code)throw new Error('Students need a student ID');
    if(d.role!=='student'&&!d.student_code)delete d.student_code;
    if(d.campus_id)d.campus_id=+d.campus_id;
    await api('POST','/users',d);
    toast('Account created');
    loadUsers();
  });

  const roleEl=createForm.elements['role'];
  const codeInput=createForm.elements['student_code'];
  const codeLabel=codeInput?.closest('label');
  const codeHint=codeLabel?.querySelector('.field-hint');

  const updateIdField=()=>{
    const isStudent=roleEl?roleEl.value==='student':true;
    if(codeLabel&&codeLabel.firstChild){
      codeLabel.firstChild.nodeValue=isStudent?'Student ID (required for students)':'Employee ID';
    }
    if(codeInput){
      codeInput.required=isStudent;
      codeInput.placeholder=isStudent?'e.g. S001, 2024-CS-17':'e.g. EMP001';
    }
    if(codeHint){
      codeHint.textContent=isStudent?STUDENT_CODE_HINT:'Letters and numbers; single hyphens or underscores allowed between them (e.g. EMP001).';
    }
  };

  if(roleEl){
    roleEl.addEventListener('change',updateIdField);
    roleEl.addEventListener('input',updateIdField);
  }
  createForm.addEventListener('reset',()=>setTimeout(updateIdField,0));
  updateIdField();

  b.append(
    card(heading('Accounts','Create account'),createForm),
    card(heading(`${campuses.length}`,'Campuses'),tbl(campuses,[['ID','id'],['Campus','name']])),
    card(heading('Directory','Accounts'),h('div',{class:'filters'},h('label',{},'Search',search),h('label',{},'Role',roleF)),box)
  );

  async function loadUsers(){
    const q=new URLSearchParams();
    if(search.value.trim())q.set('q',search.value.trim());
    if(roleF.value)q.set('role',roleF.value);
    box.replaceChildren(tbl(await api('GET','/users?'+q),[
      ['Name','name'],
      ['Email','email'],
      ['Role',u=>roleLabel(u.role)],
      ['ID / Code',u=>u.student_code||'—'],
      ['Campus',u=>u.campus_name||'—'],
      ['Account ID','id'],
      ['Created',u=>fmt.date(u.created_at)]
    ],'No accounts match'));
  }

  let t;
  search.oninput=()=>{clearTimeout(t);t=setTimeout(()=>go(loadUsers),300)};
  roleF.onchange=()=>go(loadUsers);
  await loadUsers();
};
