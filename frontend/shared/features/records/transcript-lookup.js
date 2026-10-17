import {h,setChildren} from '../../core/dom.js';
import {api} from '../../core/api.js';
import {STUDENT_CODE_RE,STUDENT_CODE_HINT} from '../../core/validation.js';
import {card,heading,btn} from '../../components/ui.js';
import {frm} from '../../components/forms.js';
import {hashParams,setParams} from '../../navigation/router.js';
import {transcriptView} from './transcript-view.js';
import {downloadTranscriptPdf,downloadTranscriptCsv} from './transcript-export.js';

// ---------- Student transcript lookup (campus managers and super admins) ----------
export const transcriptLookupPage=async b=>{
 const results=h('div');
 let loadedTranscript=null;

 const dlPdfBtn=btn('Download PDF',()=>{
  if(loadedTranscript) downloadTranscriptPdf(loadedTranscript);
 },'s');
 dlPdfBtn.disabled=true;
 dlPdfBtn.id='dl-transcript-pdf';

 const dlCsvBtn=btn('Download CSV',()=>{
  if(loadedTranscript) downloadTranscriptCsv(loadedTranscript);
 },'s');
 dlCsvBtn.disabled=true;
 dlCsvBtn.id='dl-transcript-csv';

 const actionsRow=h('div',{class:'pill-row',style:'margin-top:12px;'},dlPdfBtn,dlCsvBtn);

 const formCard=card(
  heading('Campus scoped access','Student transcript lookup'),
  frm([['ref','Student ID or account ID','text',null,{pattern:STUDENT_CODE_RE,maxlength:40,autocomplete:'off',placeholder:'e.g. S001 or 2024-CS-17',hint:STUDENT_CODE_HINT}]],'Load transcript',async d=>{
   const ref=d.ref.trim();
   if(!new RegExp(STUDENT_CODE_RE).test(ref))throw new Error(STUDENT_CODE_HINT);
   const r=await api('GET',`/transcripts/${encodeURIComponent(ref)}`);
   loadedTranscript=r;
   dlPdfBtn.disabled=false;
   dlCsvBtn.disabled=false;
   setParams({student:ref});
   setChildren(results,h('h3',{},r.student.name),h('p',{class:'mut'},`${r.student.student_code||'No student ID'}${r.student.campus?' · '+r.student.campus:''}`),...transcriptView(r));
  },0,{draft:false}),
  actionsRow
 );

 b.append(formCard,results);
 const want=hashParams().get('student');if(want){const f=b.querySelector('form');f.elements.ref.value=want;f.requestSubmit()}
};
