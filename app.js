(function(){
const SCHOOLS=["الهير","الرفعة","روضة الهلال","الجوري","البدع","ناهل","الرسالة","الشويب","الفوعة","التفوق","علي بن أبي طالب","المسيرة"];
const PLCS=[["1","الذكاء الاصطناعي في التدريس"],["2","التدريس المتمايز والتعلم النشط"],["3","تحليل نتائج التقويم وخطط الدعم"],["4","التحسين المدرسي والتقييم الذاتي"],["5","السلوك وجودة الحياة والدمج"],["6","المهارات الإدارية والتحول الرقمي"]];
const FORMS=[["01","بطاقة المجتمع"],["02","كشف الحضور"],["03","محضر الجلسة"],["04","الزيارة / المراجعة التبادلية"],["05","القياس القبلي والبعدي"],["06","استبانة مدى الاستفادة"],["07","تقرير نهاية الدورة"],["08","شواهد (صور، أعمال طلبة، خطط)"]];
const plcName=Object.fromEntries(PLCS), formName=Object.fromEntries(FORMS);
const stLabel={pending:"بانتظار المراجعة",approved:"معتمد",needs:"يحتاج استكمال"};
const $=id=>document.getElementById(id);
const fmt=n=>Number(n).toLocaleString("ar-AE",{maximumFractionDigits:1});

if(!window.supabase||!window.SUPABASE_URL||window.SUPABASE_URL.indexOf("http")!==0){
  document.body.innerHTML='<p style="padding:24px;font-family:Tahoma" dir="rtl">ملف config.js ما فيه رابط Supabase والمفتاح العام بعد.</p>';return;
}
const sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
let EV=[], TEAM=[], meEmail="", isAdmin=false, loaded=false;

// ---------- selects ----------
function fill(sel,opts,keepFirst){const s=$(sel);if(!keepFirst)s.innerHTML="";opts.forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;s.appendChild(o);});}
fill("f-school",SCHOOLS.map(s=>[s,s]));fill("f-plc",PLCS.map(([k,v])=>[k,k+". "+v]));fill("f-form",FORMS.map(([k,v])=>[k,k+" "+v]));
fill("l-school",SCHOOLS.map(s=>[s,s]),true);fill("l-plc",PLCS.map(([k,v])=>[k,k+". "+v]),true);
$("f-date").value=new Date().toISOString().slice(0,10);

// ---------- tabs ----------
const VIEWS=["analysis","log","add","team"];
document.querySelectorAll("nav button[data-view]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.view)));
function show(v){document.querySelectorAll("nav button[data-view]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.view===v)));VIEWS.forEach(x=>$("view-"+x).hidden=x!==v);}
function syncExtra(){const f=$("f-form").value;["02","05","06"].forEach(k=>$("x-"+k).hidden=f!==k);}
$("f-form").addEventListener("change",syncExtra);syncExtra();

// ---------- auth ----------
$("login-form").addEventListener("submit",async ev=>{ev.preventDefault();const m=$("l-msg");m.textContent="";m.className="";
  const email=$("l-email").value.trim(),password=$("l-pass").value;
  if(!email||!password){m.textContent="أدخلي الإيميل وكلمة المرور.";m.className="msg err";return;}
  $("l-btn").disabled=true;
  const {error}=await sb.auth.signInWithPassword({email,password});
  $("l-btn").disabled=false;
  if(error){m.textContent="الإيميل أو كلمة المرور غير صحيحة.";m.className="msg err";return;}
  start();
});
$("logout").addEventListener("click",async()=>{await sb.auth.signOut();location.reload();});

async function start(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){$("login").hidden=false;$("app").hidden=true;return;}
  meEmail=(session.user.email||"").toLowerCase();
  const {data:mine}=await sb.from("team_members").select("email,name,role").ilike("email",meEmail).maybeSingle();
  if(!mine){$("login").hidden=false;$("app").hidden=true;const m=$("l-msg");m.textContent="حسابك غير مضاف للفريق. تواصلي مع منسقة النطاق.";m.className="msg err";await sb.auth.signOut();return;}
  isAdmin=mine.role==="admin";
  $("me-name").textContent=mine.name;
  $("tab-team").hidden=!isAdmin;
  $("login").hidden=true;$("app").hidden=false;
  await loadAll();
}
async function loadAll(){
  const [e,t]=await Promise.all([
    sb.from("evidence").select("*").order("created_at",{ascending:false}),
    sb.from("team_members").select("email,name,role").order("name")
  ]);
  if(e.error){$("a-status").textContent="تعذر تحميل الأدلة. حدّثي الصفحة.";return;}
  EV=e.data||[];TEAM=t.data||[];loaded=true;renderAll();
}
function nameOf(email){const t=TEAM.find(x=>x.email.toLowerCase()===(email||"").toLowerCase());return t?t.name:(email||"");}

// ---------- analysis ----------
function cycleFilter(list,c){return c==="all"||!c?list:list.filter(e=>String(e.cycle)===c);}
const improved=e=>e.better==="down"?Number(e.post)<Number(e.pre):Number(e.post)>Number(e.pre);
function renderAnalysis(){
  const c=$("a-cycle").value;const L=cycleFilter(EV,c);
  $("a-status").textContent=!loaded?"يجري تحميل البيانات…":(EV.length?"":"لا توجد أدلة بعد. ابدئي من «إضافة دليل».");
  const st=L.map(e=>e.status);
  $("k-total").textContent=loaded?fmt(L.length):"—";
  $("k-approved").textContent=loaded?fmt(st.filter(s=>s==="approved").length):"—";
  $("k-needs").textContent=loaded?fmt(st.filter(s=>s==="needs").length):"—";
  $("k-pending").textContent=loaded?fmt(st.filter(s=>s==="pending").length):"—";
  const att=L.filter(e=>e.form==="02"&&e.members>0&&e.attended!=null);
  $("k-att").textContent=att.length?fmt(100*att.reduce((a,e)=>a+e.attended/e.members,0)/att.length)+"%":"—";
  const sat=L.filter(e=>e.form==="06"&&e.avg_score>0);
  $("k-sat").textContent=sat.length?fmt(sat.reduce((a,e)=>a+Number(e.avg_score),0)/sat.length):"—";
  const pp=L.filter(e=>e.form==="05"&&e.pre!=null&&e.post!=null);
  $("k-imp").textContent=pp.length?fmt(pp.filter(improved).length)+" من "+fmt(pp.length):"—";

  const g=$("grid");g.innerHTML="";
  const hr=g.createTHead().insertRow();const h0=document.createElement("th");h0.textContent="المدرسة";hr.appendChild(h0);
  PLCS.forEach(([k,v])=>{const th=document.createElement("th");th.textContent=k+". "+v.split(" ").slice(0,2).join(" ");th.title=v;th.style.textAlign="center";hr.appendChild(th);});
  const tb=g.createTBody();
  SCHOOLS.forEach(s=>{const tr=tb.insertRow();tr.insertCell().textContent=s;
    PLCS.forEach(([k])=>{const items=L.filter(e=>e.school===s&&e.plc===k);const n=new Set(items.map(e=>e.form)).size;
      const lvl=n===0?0:n<=2?1:n<=5?2:n<=7?3:4;const cell=tr.insertCell();cell.className="cell";
      const sp=document.createElement("span");sp.className="sq lvl"+lvl;sp.textContent=n+"/8";cell.appendChild(sp);
      if(items.some(e=>e.status==="needs")){const d=document.createElement("span");d.className="dot";d.title="يوجد دليل يحتاج استكمالاً";cell.appendChild(d);}});});

  barChart("ch-sat",PLCS.map(([k,v])=>{const xs=sat.filter(e=>e.plc===k);return{label:k+". "+v,value:xs.length?xs.reduce((a,e)=>a+Number(e.avg_score),0)/xs.length:null,n:xs.length};}),5,[1,2,3,4,5],v=>fmt(v));
  barChart("ch-imp",PLCS.map(([k,v])=>{const xs=pp.filter(e=>e.plc===k);return{label:k+". "+v,value:xs.length?100*xs.filter(improved).length/xs.length:null,n:xs.length};}),100,[0,25,50,75,100],v=>fmt(v)+"%");

  const ul=$("missing");ul.innerHTML="";let any=false;
  SCHOOLS.forEach(s=>["1","2","3"].forEach(k=>{const items=L.filter(e=>e.school===s&&e.plc===k);if(!items.length)return;
    const have=new Set(items.map(e=>e.form));const miss=FORMS.filter(([f])=>!have.has(f));if(!miss.length)return;any=true;
    const li=document.createElement("li");const b=document.createElement("b");b.textContent=s+" · م"+k;li.appendChild(b);
    const sp=document.createElement("span");sp.textContent=miss.map(([f,n])=>f+" "+n).join("، ");li.appendChild(sp);ul.appendChild(li);}));
  if(!any){const li=document.createElement("li");li.className="note";li.textContent=loaded?(L.length?"لا نواقص في المجتمعات التي بدأت رفع أدلتها.":"ستظهر هنا النماذج الناقصة بعد رفع أول دليل."):"…";ul.appendChild(li);}
}
function barChart(id,rows,max,ticks,fv){
  const el=$(id);const W=Math.max(300,el.clientWidth||520),labelW=Math.min(190,W*0.42),rowH=30,top=8,H=top+rows.length*rowH+24;
  const x0=W-labelW-8,x1=36,sx=v=>x0-(x0-x1)*(v/max);
  const ns="http://www.w3.org/2000/svg";const svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox",`0 0 ${W} ${H}`);svg.setAttribute("width","100%");
  const mk=(t,a)=>{const e=document.createElementNS(ns,t);for(const k in a)e.setAttribute(k,a[k]);svg.appendChild(e);return e;};
  ticks.forEach(t=>{mk("line",{x1:sx(t),x2:sx(t),y1:top,y2:top+rows.length*rowH,stroke:"var(--line)"});mk("text",{x:sx(t),y:H-6,"text-anchor":"middle",class:"ax"}).textContent=fv(t);});
  rows.forEach((r,i)=>{const y=top+i*rowH;
    mk("text",{x:W-4,y:y+rowH/2+4,"text-anchor":"start","font-size":"12",direction:"rtl"}).textContent=r.label.length>26?r.label.slice(0,25)+"…":r.label;
    if(r.value==null){mk("text",{x:x0-6,y:y+rowH/2+4,"text-anchor":"start",class:"ax",direction:"rtl"}).textContent="لا بيانات";return;}
    const w=x0-sx(r.value);mk("rect",{x:x0-w,y:y+6,width:Math.max(w,2),height:rowH-12,rx:3,fill:"var(--accent)"});
    mk("text",{x:x0-w-6,y:y+rowH/2+4,"text-anchor":"end","font-size":"12","font-weight":"600"}).textContent=fv(r.value)+" ("+r.n+")";});
  el.innerHTML="";el.appendChild(svg);
}

// ---------- log ----------
function filtered(){const fs=$("l-school").value,fp=$("l-plc").value,fc=$("l-cycle").value,fst=$("l-status").value;
  return EV.filter(e=>(!fs||e.school===fs)&&(!fp||e.plc===fp)&&(!fc||String(e.cycle)===fc)&&(!fst||e.status===fst));}
function renderLog(){
  const L=filtered();const t=$("log");t.innerHTML="";
  if(!L.length){const td=t.insertRow().insertCell();td.colSpan=9;td.className="empty";td.textContent=loaded?(EV.length?"لا أدلة تطابق هذا الفرز.":"لا توجد أدلة بعد. أضيفي أول دليل من «إضافة دليل»."):"يجري التحميل…";return;}
  const hr=t.createTHead().insertRow();["التاريخ","المدرسة","المجتمع","الدورة","النموذج","الملف","رفعه","الحالة",""].forEach(h=>{const th=document.createElement("th");th.textContent=h;hr.appendChild(th);});
  const tb=t.createTBody();
  L.forEach(e=>{const tr=tb.insertRow();
    [e.evidence_date||"",e.school,"م"+e.plc,String(e.cycle)==="2"?"الثانية":"الأولى",e.form+" "+(formName[e.form]||"")].forEach(v=>{tr.insertCell().textContent=v;});
    const fc=tr.insertCell();
    if(e.file_path){const a=document.createElement("button");a.type="button";a.className="btn sm";a.textContent=e.file_name||"فتح الملف";a.onclick=()=>openFile(e.file_path);fc.appendChild(a);}else{fc.textContent="بلا ملف";fc.className="who";}
    if(e.note){const n=document.createElement("div");n.className="who";n.textContent=e.note;fc.appendChild(n);}
    tr.insertCell().textContent=nameOf(e.uploaded_by);
    const sc=tr.insertCell();const chip=document.createElement("span");chip.className="chip st-"+e.status;chip.textContent=stLabel[e.status]||e.status;sc.appendChild(chip);
    if(e.review_note){const n=document.createElement("div");n.className="who";n.textContent=e.review_note;sc.appendChild(n);}
    const ac=tr.insertCell();const box=document.createElement("div");box.className="rev";ac.appendChild(box);
    if(isAdmin){
      const ok=document.createElement("button");ok.className="btn sm";ok.type="button";ok.textContent="اعتماد";ok.onclick=()=>review(e.id,"approved","");
      const nd=document.createElement("button");nd.className="btn sm";nd.type="button";nd.textContent="يحتاج استكمال";
      nd.onclick=()=>{const inp=document.createElement("input");inp.placeholder="ما الناقص؟";inp.setAttribute("aria-label","ما الناقص؟");const sv=document.createElement("button");sv.className="btn sm";sv.type="button";sv.textContent="حفظ";sv.onclick=()=>review(e.id,"needs",inp.value.trim());box.replaceChildren(inp,sv);inp.focus();};
      box.append(ok,nd);}
    if(isAdmin||(e.uploaded_by||"").toLowerCase()===meEmail){const del=document.createElement("button");del.className="btn sm";del.type="button";del.textContent="حذف";
      del.onclick=()=>{const y=document.createElement("button");y.className="btn sm";y.type="button";y.textContent="تأكيد الحذف";y.onclick=()=>removeEv(e);del.replaceWith(y);};box.appendChild(del);}
  });
}
async function openFile(path){const w=window.open("","_blank");const {data,error}=await sb.storage.from("evidence").createSignedUrl(path,3600);
  if(error||!data){if(w)w.close();flash("تعذر فتح الملف.");return;} if(w)w.location=data.signedUrl;else location.href=data.signedUrl;}
async function review(id,status,note){const {error}=await sb.from("evidence").update({status,review_note:note||null,reviewed_by:meEmail,reviewed_at:new Date().toISOString()}).eq("id",id);
  if(error){flash("تعذر حفظ المراجعة.");return;}await loadAll();}
async function removeEv(e){const {error}=await sb.from("evidence").delete().eq("id",e.id);if(error){flash("تعذر حذف الدليل.");return;}
  if(e.file_path)await sb.storage.from("evidence").remove([e.file_path]);await loadAll();}
function flash(t){$("export-msg").textContent=t;}

// ---------- add ----------
function setMsg(t,err){const m=$("f-msg");m.textContent=t;m.className=t?("msg "+(err?"err":"ok")):"";}
$("add-form").addEventListener("submit",async ev=>{ev.preventDefault();setMsg("");
  const form=$("f-form").value,date=$("f-date").value;if(!date){setMsg("أدخلي تاريخ الدليل.",true);return;}
  const num=id=>{const v=$(id).value;return v===""?null:Number(v);};
  const rec={school:$("f-school").value,plc:$("f-plc").value,cycle:$("f-cycle").value,form,evidence_date:date,note:$("f-note").value.trim()||null,uploaded_by:meEmail,status:"pending"};
  if(form==="02"){rec.attended=num("f-att");rec.members=num("f-mem");if(rec.attended==null||!rec.members){setMsg("أدخلي عدد الحاضرين وعدد الأعضاء.",true);return;}if(rec.attended>rec.members){setMsg("عدد الحاضرين أكبر من عدد الأعضاء.",true);return;}}
  if(form==="05"){rec.indicator=$("f-ind").value.trim()||null;rec.pre=num("f-pre");rec.post=num("f-post");rec.better=$("f-dir").value;if(rec.pre==null||rec.post==null){setMsg("أدخلي القيمتين القبلية والبعدية.",true);return;}}
  if(form==="06"){rec.avg_score=num("f-avg");rec.respondents=num("f-resp");if(!(rec.avg_score>=1&&rec.avg_score<=5)){setMsg("متوسط الاستبانة بين 1 و5.",true);return;}}
  const file=$("f-file").files[0];const btn=$("f-submit");btn.disabled=true;btn.textContent="يجري الحفظ…";
  try{
    if(file){if(file.size>50*1024*1024)throw new Error("big");
      const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"");
      const path=rec.plc+"/"+(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2))+"."+ext;
      const up=await sb.storage.from("evidence").upload(path,file,{contentType:file.type||undefined});
      if(up.error)throw up.error;rec.file_path=path;rec.file_name=file.name;}
    const {error}=await sb.from("evidence").insert(rec);if(error)throw error;
    setMsg("حُفظ الدليل ("+form+" "+formName[form]+") لمدرسة "+rec.school+".",false);
    ["f-file","f-note","f-att","f-mem","f-pre","f-post","f-avg","f-resp","f-ind"].forEach(i=>{$(i).value="";});
    await loadAll();
  }catch(err){setMsg(err&&err.message==="big"?"الملف أكبر من 50 ميغابايت.":"تعذر الحفظ. تأكدي من الاتصال وأعيدي المحاولة.",true);}
  finally{btn.disabled=false;btn.textContent="حفظ الدليل";}
});

// ---------- export (real .xlsx) ----------
$("export").addEventListener("click",()=>{
  if(!EV.length){flash("لا توجد أدلة للتنزيل بعد.");return;}
  const head=["التاريخ","المدرسة","المجتمع","الدورة","النموذج","الحالة","ملاحظة المراجعة","عدد الحاضرين","عدد الأعضاء","المؤشر المقيس","القيمة القبلية","القيمة البعدية","متوسط الاستبانة","عدد المستجيبين","ملاحظة","رفعه","اسم الملف"];
  const rows=filtered().slice().sort((a,b)=>(a.evidence_date||"").localeCompare(b.evidence_date||"")).map(e=>[e.evidence_date,e.school,e.plc+". "+(plcName[e.plc]||""),String(e.cycle)==="2"?"الثانية":"الأولى",e.form+" "+(formName[e.form]||""),stLabel[e.status]||e.status,e.review_note||"",e.attended,e.members,e.indicator||"",e.pre,e.post,e.avg_score,e.respondents,e.note||"",nameOf(e.uploaded_by),e.file_name||""]);
  const ws=XLSX.utils.aoa_to_sheet([head].concat(rows));ws["!cols"]=head.map(()=>({wch:18}));
  const wb=XLSX.utils.book_new();wb.Workbook={Views:[{RTL:true}]};XLSX.utils.book_append_sheet(wb,ws,"الأدلة");
  XLSX.writeFile(wb,"سجل_أدلة_مجتمعات_التعلم_"+new Date().toISOString().slice(0,10)+".xlsx");
});

// ---------- team (admin) ----------
function renderTeam(){const t=$("team");t.innerHTML="";
  const hr=t.createTHead().insertRow();["الاسم","الإيميل","الصلاحية",""].forEach(h=>{const th=document.createElement("th");th.textContent=h;hr.appendChild(th);});
  const tb=t.createTBody();TEAM.forEach(m=>{const tr=tb.insertRow();tr.insertCell().textContent=m.name;const ec=tr.insertCell();ec.textContent=m.email;ec.dir="ltr";
    tr.insertCell().textContent=m.role==="admin"?"مشرف":"عضو";const ac=tr.insertCell();
    if(m.email.toLowerCase()!==meEmail){const d=document.createElement("button");d.className="btn sm";d.type="button";d.textContent="إزالة";
      d.onclick=()=>{const y=document.createElement("button");y.className="btn sm";y.type="button";y.textContent="تأكيد الإزالة";
        y.onclick=async()=>{const {error}=await sb.from("team_members").delete().eq("email",m.email);if(error){$("t-msg").textContent="تعذرت الإزالة.";return;}await loadAll();};d.replaceWith(y);};ac.appendChild(d);}});}
$("team-form").addEventListener("submit",async ev=>{ev.preventDefault();const m=$("t-msg");
  const email=$("t-email").value.trim().toLowerCase(),name=$("t-name").value.trim(),role=$("t-role").value;
  if(!email||!name){m.textContent="أدخلي الإيميل والاسم.";m.className="msg err";return;}
  const {error}=await sb.from("team_members").upsert({email,name,role});
  if(error){m.textContent="تعذرت الإضافة.";m.className="msg err";return;}
  m.textContent="أُضيف "+name+". أنشئي له مستخدماً في Supabase بنفس الإيميل.";m.className="msg ok";$("t-email").value="";$("t-name").value="";await loadAll();});

function renderAll(){renderAnalysis();renderLog();if(isAdmin)renderTeam();}
["a-cycle"].forEach(i=>$(i).addEventListener("change",renderAnalysis));
["l-school","l-plc","l-cycle","l-status"].forEach(i=>$(i).addEventListener("change",renderLog));
let rt;window.addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(renderAnalysis,150);});
renderAll();
start();
})();
