import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import {
  BookOpen, Brain, CheckCircle2, ChevronLeft, ClipboardList, FileText,
  Home, ImagePlus, LayoutDashboard, Menu, Moon, Plus, RefreshCw, Search,
  Sparkles, Sun, Target, Trash2, Upload, X, AlertTriangle, Download,
  LogIn, LogOut, BarChart3, PlayCircle
} from "lucide-react";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const cn = (...xs) => xs.filter(Boolean).join(" ");

function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("home");
  const [dark, setDark] = useState(() => localStorage.getItem("sm-theme") !== "light");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [subject, setSubject] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("sm-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3200);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (!supabase) return <SetupScreen />;
  if (!session) return <AuthScreen />;

  const nav = [
    ["home", "الرئيسية", Home],
    ["subjects", "المواد", BookOpen],
    ["assignments", "الواجبات", ClipboardList],
    ["results", "النتائج", BarChart3]
  ];

  const openLesson = (s, l = null) => {
    setSubject(s);
    setCurrentLesson(l);
    setTab(l ? "lesson" : "subjects");
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className={cn("sidebar", mobileOpen && "open")}>
        <div className="brand">
          <div className="brand-mark"><Sparkles size={21}/></div>
          <div><b>StudyMate</b><span>AI</span><small>مساعد مذاكرتك</small></div>
          <button className="icon-btn mobile-close" onClick={() => setMobileOpen(false)}><X size={20}/></button>
        </div>
        <div className="profile-mini">
          <div className="avatar">{(session.user.email || "ط").slice(0,1).toUpperCase()}</div>
          <div><b>أهلاً بك 👋</b><small>{session.user.email}</small></div>
        </div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button key={id} className={cn("nav-item", tab === id && "active")} onClick={() => {setTab(id); setMobileOpen(false);}}>
              <Icon size={19}/><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setDark(v => !v)}>
            {dark ? <Sun size={19}/> : <Moon size={19}/>}<span>{dark ? "الوضع الفاتح" : "الوضع الداكن"}</span>
          </button>
          <button className="nav-item danger" onClick={() => supabase.auth.signOut()}>
            <LogOut size={19}/><span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="overlay" onClick={() => setMobileOpen(false)}/>}
      <main className="main">
        <header className="topbar">
          <button className="icon-btn hamburger" onClick={() => setMobileOpen(true)}><Menu/></button>
          <div>
            <h1>{tab === "home" ? "مساحة مذاكرتك" : tab === "subjects" ? "المواد والدروس" : tab === "assignments" ? "الواجبات والاختبارات" : tab === "results" ? "نتائجك" : currentLesson?.title || "الدرس"}</h1>
            <p>حوّل صفحات منهجك إلى مذاكرة منظمة بذكاء.</p>
          </div>
          <div className="top-actions">
            <button className="icon-btn" onClick={() => setDark(v => !v)}>{dark ? <Sun/> : <Moon/>}</button>
          </div>
        </header>

        <div className="content">
          {tab === "home" && <HomeView onUpload={() => setTab("subjects")} onOpenLesson={openLesson} />}
          {tab === "subjects" && <SubjectsView subject={subject} setSubject={setSubject} lessons={lessons} setLessons={setLessons} openLesson={openLesson} setToast={setToast} />}
          {tab === "lesson" && <LessonView subject={subject} lesson={currentLesson} setLesson={setCurrentLesson} setToast={setToast} />}
          {tab === "assignments" && <AssignmentsView setToast={setToast} />}
          {tab === "results" && <ResultsView />}
        </div>
      </main>
      {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
    </div>
  );
}

function SetupScreen() {
  return <div className="center-screen"><div className="setup-card">
    <div className="brand-mark big"><Sparkles/></div>
    <h1>StudyMate AI</h1>
    <p>أضف قيم <code>VITE_SUPABASE_URL</code> و <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> في ملف البيئة ثم شغّل المشروع.</p>
    <p className="muted">لا تضع مفتاح OpenRouter في متغير يبدأ بـ VITE_.</p>
  </div></div>;
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async e => {
    e.preventDefault(); setLoading(true); setMsg("");
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({email, password})
      : await supabase.auth.signUp({email, password});
    setLoading(false);
    if (result.error) setMsg(result.error.message);
    else setMsg(mode === "login" ? "تم تسجيل الدخول." : "تم إنشاء الحساب. لو طلب تأكيد البريد، راجعه.");
  };

  return <div className="auth-page">
    <div className="auth-art">
      <div className="brand big-brand"><div className="brand-mark"><Sparkles/></div><b>StudyMate<span> AI</span></b></div>
      <h1>منهجك في مكان واحد.</h1>
      <p>صوّر، افهم، اختبر نفسك، وتابع تقدمك بدون ما تضيع بين الكراسات والملفات.</p>
      <div className="feature-pills"><span>📸 قراءة الصور</span><span>📄 PDF للطباعة</span><span>🧠 أسئلة ذكية</span></div>
    </div>
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-title"><h2>{mode === "login" ? "مرحبًا بعودتك" : "إنشاء حساب جديد"}</h2><p>{mode === "login" ? "كمّل مذاكرتك من حيث توقفت." : "أنشئ مساحة مذاكرتك في ثوانٍ."}</p></div>
      <label>البريد الإلكتروني<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/></label>
      <label>كلمة المرور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength="6" placeholder="••••••••"/></label>
      {msg && <div className="notice">{msg}</div>}
      <button className="primary-btn full" disabled={loading}>{loading ? "جاري التنفيذ..." : mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"} <LogIn size={18}/></button>
      <button type="button" className="text-btn" onClick={()=>setMode(v=>v==="login"?"signup":"login")}>{mode==="login" ? "ليس لديك حساب؟ أنشئ حسابًا" : "لديك حساب بالفعل؟ تسجيل الدخول"}</button>
    </form>
  </div>;
}

function HomeView({onUpload, onOpenLesson}) {
  return <div className="home-grid">
    <section className="hero-card">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={15}/> مساعد مذاكرة بالذكاء الاصطناعي</div>
        <h2>صوّر منهجك.<br/><span>وخلي المذاكرة أذكى.</span></h2>
        <p>ارفع صفحات واضحة، وسيتم استخراج المحتوى، إنشاء شرح مبسط، وتجهيز أسئلة وواجبات قابلة للحفظ والطباعة.</p>
        <button className="primary-btn" onClick={onUpload}><ImagePlus size={19}/> ابدأ برفع الصفحات</button>
      </div>
      <div className="hero-visual"><div className="floating paper"><FileText size={34}/><b>مذكرة PDF</b><small>جاهزة للطباعة</small></div><div className="floating quiz"><Target size={28}/><b>20 سؤال</b><small>8 اختيار من متعدد على الأقل</small></div><div className="orbit">✦</div></div>
    </section>
    <section className="quick-grid">
      <StatCard icon={BookOpen} title="موادك" value="ابدأ أول مادة" />
      <StatCard icon={ClipboardList} title="واجبات" value="لا توجد نتائج بعد" />
      <StatCard icon={Target} title="نقاط الضعف" value="ستظهر بعد الاختبارات" />
    </section>
    <section className="section-card tips">
      <div className="section-head"><div><h3>كيف تستخدمه؟</h3><p>3 خطوات وتبدأ مذاكرتك.</p></div></div>
      <div className="steps"><Step n="01" title="ارفع الصفحات" text="صوّر أو ارفع صور صفحات المنهج."/><Step n="02" title="أنشئ المذكرة" text="شرح مبسط وأمثلة ونقاط مهمة."/><Step n="03" title="اختبر نفسك" text="واجبات متنوعة مع تصحيح وتحليل." /></div>
    </section>
  </div>;
}

function StatCard({icon:Icon,title,value}) { return <div className="stat-card"><div className="stat-icon"><Icon size={20}/></div><small>{title}</small><b>{value}</b></div> }
function Step({n,title,text}) { return <div className="step"><span>{n}</span><div><b>{title}</b><p>{text}</p></div></div> }

function SubjectsView({subject,setSubject,lessons,setLessons,openLesson,setToast}) {
  const [name,setName]=useState("");
  const [files,setFiles]=useState([]);
  const [busy,setBusy]=useState(false);
  const [subjectList,setSubjectList]=useState(()=>JSON.parse(localStorage.getItem("sm-subjects")||"[]"));
  const [selectedId,setSelectedId]=useState(subject?.id || null);

  const saveSubjects = list => { setSubjectList(list); localStorage.setItem("sm-subjects",JSON.stringify(list)); };

  const addSubject = () => {
    const n=name.trim(); if(!n) return;
    const s={id:crypto.randomUUID(),name:n,createdAt:Date.now()};
    saveSubjects([...subjectList,s]); setName(""); setSelectedId(s.id); setSubject(s); setLessons([]);
  };

  const current = subjectList.find(x=>x.id===selectedId) || subject || subjectList[0];

  const onFiles = e => setFiles(Array.from(e.target.files||[]).filter(f=>f.type.startsWith("image/")).slice(0,60));

  const process = async () => {
    if(!current || !files.length) return setToast("اختر مادة وأضف صور الصفحات أولًا.");
    setBusy(true);
    try {
      const fd=new FormData(); files.forEach(f=>fd.append("pages",f));
      const r=await fetch("/api/analyze-images",{method:"POST",body:fd});
      const data=await r.json(); if(!r.ok) throw new Error(data.error);
      const good=data.pages.filter(p=>p.status==="ok");
      const failed=data.pages.filter(p=>p.status!=="ok");
      const lesson={id:crypto.randomUUID(),title:good[0]?.title || `درس جديد — ${new Date().toLocaleDateString("ar-EG")}`,pages:data.pages,sourceText:good.map(p=>`[صفحة ${p.page}]\\n${p.text}`).join("\\n\\n"),createdAt:Date.now()};
      const next=[lesson,...lessons]; setLessons(next); localStorage.setItem(`sm-lessons-${current.id}`,JSON.stringify(next));
      setSubject(current); setCurrentLessonFallback(current,lesson,openLesson);
      setFiles([]);
      setToast(`تم تحليل ${good.length} صفحة${failed.length ? `، وفشل ${failed.length}` : ""}.`);
    } catch(e) { setToast(e.message || "حدث خطأ أثناء تحليل الصور."); }
    finally { setBusy(false); }
  };

  function setCurrentLessonFallback(s,l,fn){ fn(s,l); }

  useEffect(()=> {
    if(current) {
      setSubject(current);
      const saved=JSON.parse(localStorage.getItem(`sm-lessons-${current.id}`)||"[]");
      setLessons(saved);
    }
  },[selectedId, subjectList.length]);

  return <div className="subjects-layout">
    <section className="section-card">
      <div className="section-head"><div><h3>موادك</h3><p>أنشئ مادة لكل منهج.</p></div></div>
      <div className="subject-create"><input value={name} onChange={e=>setName(e.target.value)} placeholder="مثال: الفيزياء"/><button className="primary-btn" onClick={addSubject}><Plus size={18}/> إضافة</button></div>
      <div className="subject-list">
        {subjectList.length===0 && <Empty icon={BookOpen} text="لم تضف أي مادة بعد."/>}
        {subjectList.map(s=><button key={s.id} className={cn("subject-row",current?.id===s.id&&"selected")} onClick={()=>setSelectedId(s.id)}><div className="subject-avatar">{s.name.slice(0,1)}</div><div><b>{s.name}</b><small>مادة دراسية</small></div><ChevronLeft size={18}/></button>)}
      </div>
    </section>

    <section className="section-card upload-panel">
      <div className="section-head"><div><h3>{current ? `إضافة صفحات إلى ${current.name}` : "اختر مادة أولًا"}</h3><p>الصور الواضحة تعطي أفضل نتيجة.</p></div></div>
      <label className="dropzone">
        <input type="file" accept="image/*" multiple onChange={onFiles}/>
        <div className="upload-icon"><Upload size={26}/></div>
        <b>اسحب الصور هنا أو اضغط للاختيار</b>
        <span>حتى 60 صفحة — JPG / PNG / WEBP</span>
      </label>
      {files.length>0 && <div className="file-preview">
        {files.map((f,i)=><div className="file-chip" key={f.name+i}><img src={URL.createObjectURL(f)}/><span>صفحة {i+1}</span><button onClick={()=>setFiles(v=>v.filter((_,x)=>x!==i))}><X size={14}/></button></div>)}
      </div>}
      <button className="primary-btn full" disabled={!current || !files.length || busy} onClick={process}>{busy?<><RefreshCw className="spin"/> جاري فحص الصفحات...</>:<><Brain size={19}/> تحليل الصفحات وإنشاء الدرس</>}</button>
      <div className="safe-note"><AlertTriangle size={16}/><span>أي صفحة غير واضحة تُسجل كفشل ولا يتم اختراع محتواها.</span></div>
    </section>

    {current && <section className="section-card lesson-list-card">
      <div className="section-head"><div><h3>الدروس المحفوظة</h3><p>يمكنك الرجوع إليها وتوليد المذكرات والواجبات.</p></div></div>
      {lessons.length===0?<Empty icon={FileText} text="لم يتم إنشاء دروس لهذه المادة بعد."/>:
      lessons.map(l=><button className="lesson-row" key={l.id} onClick={()=>openLesson(current,l)}><div className="lesson-status"><CheckCircle2 size={18}/></div><div><b>{l.title}</b><small>{l.pages?.length||0} صفحة · {l.pages?.filter(p=>p.status==="ok").length||0} مقروءة</small></div><ChevronLeft/></button>)}
    </section>}
  </div>;
}

function Empty({icon:Icon,text}) { return <div className="empty"><Icon size={28}/><p>{text}</p></div> }

function LessonView({subject,lesson,setLesson,setToast}) {
  const [note,setNote]=useState(null);
  const [loading,setLoading]=useState(false);
  const [questions,setQuestions]=useState([]);
  const [count,setCount]=useState(20);
  const [difficulty,setDifficulty]=useState("mixed");
  const [mode,setMode]=useState("note");

  useEffect(()=> {
    if(!lesson) return;
    const saved=JSON.parse(localStorage.getItem(`sm-note-${lesson.id}`)||"null");
    const qs=JSON.parse(localStorage.getItem(`sm-questions-${lesson.id}`)||"[]");
    setNote(saved); setQuestions(qs);
  },[lesson?.id]);

  if(!lesson) return <Empty icon={FileText} text="لم يتم اختيار درس."/>;
  const failed=lesson.pages.filter(p=>p.status!=="ok");
  const goodText=lesson.sourceText || "";

  const makeNote=async()=>{
    setLoading(true);
    try {
      const r=await fetch("/api/generate-note",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subject:subject?.name,lessonTitle:lesson.title,sourceText:goodText})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error);
      setNote(d); localStorage.setItem(`sm-note-${lesson.id}`,JSON.stringify(d)); setToast("تم إنشاء المذكرة.");
    } catch(e){setToast(e.message)}
    finally{setLoading(false)}
  };

  const makeQuestions=async()=>{
    setLoading(true);
    try {
      const r=await fetch("/api/generate-questions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subject:subject?.name,sourceText:goodText,count,difficulty})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error);
      setQuestions(d.questions||[]); localStorage.setItem(`sm-questions-${lesson.id}`,JSON.stringify(d.questions||[])); setToast(`تم إنشاء ${d.questions?.length||0} سؤال.`);
    } catch(e){setToast(e.message)}
    finally{setLoading(false)}
  };

  const downloadPdf=()=>{
    if(!note) return setToast("أنشئ المذكرة أولًا.");
    const doc=new jsPDF({unit:"mm",format:"a4"});
    doc.setFont("helvetica","normal");
    const margin=15, width=180;
    let y=18;
    const add=(txt,size=12,gap=7)=>{
      doc.setFontSize(size);
      const lines=doc.splitTextToSize(String(txt||""),width);
      if(y+lines.length*gap>282){doc.addPage();y=18;}
      doc.text(lines,195,y,{align:"right",maxWidth:width}); y+=lines.length*gap+4;
    };
    add(note.title||lesson.title,20,9);
    add(note.summary,13,7);
    (note.sections||[]).forEach(s=>{add(s.heading,16,8);add(s.body,12,7);(s.bullets||[]).forEach(b=>add("• "+b,11,6));if(s.formula)add("القانون: "+s.formula,12,7);});
    (note.examples||[]).forEach(e=>{add(e.title,15,8);add(e.body,12,7);});
    add("أهم النقاط",16,8);(note.keyPoints||[]).forEach(x=>add("• "+x,11,6));
    doc.save(`${(note.title||lesson.title).replace(/[\\/:*?"<>|]/g,"-")}.pdf`);
    setToast("تم تجهيز PDF.");
  };

  return <div className="lesson-page">
    <div className="lesson-hero section-card">
      <div><div className="eyebrow">📚 {subject?.name}</div><h2>{lesson.title}</h2><p>{lesson.pages.length} صفحة · {lesson.pages.filter(p=>p.status==="ok").length} نجحت في القراءة</p></div>
      <div className="lesson-actions"><button className="secondary-btn" onClick={downloadPdf}><Download size={18}/> PDF</button><button className="primary-btn" onClick={makeNote} disabled={loading}>{loading?<RefreshCw className="spin"/>:<Sparkles size={18}/>} إنشاء المذكرة</button></div>
    </div>

    {failed.length>0 && <div className="warning-box"><AlertTriangle/><div><b>هناك {failed.length} صفحة فشلت قراءتها</b><p>لن تدخل هذه الصفحات في الشرح أو الأسئلة.</p><div className="failed-list">{failed.map(p=><span key={p.page}>❌ صفحة {p.page}{p.title?` — ${p.title}`:" — غير معروفة"}</span>)}</div></div></div>}

    <div className="tabs"><button className={mode==="note"?"active":""} onClick={()=>setMode("note")}><FileText size={17}/> المذكرة</button><button className={mode==="quiz"?"active":""} onClick={()=>setMode("quiz")}><ClipboardList size={17}/> الواجب</button><button className={mode==="source"?"active":""} onClick={()=>setMode("source")}><Search size={17}/> المحتوى المقروء</button></div>

    {mode==="note" && <section className="section-card document-card">
      {!note?<Empty icon={FileText} text="اضغط «إنشاء المذكرة» لعمل شرح مبسط من الصفحات المقروءة."/>:<>
        <div className="doc-title"><span className="doc-badge">مذكرة</span><h2>{note.title}</h2><p>{note.summary}</p></div>
        {(note.sections||[]).map((s,i)=><article className="doc-section" key={i}><h3>{s.heading}</h3><p>{s.body}</p>{s.bullets?.length>0&&<ul>{s.bullets.map((b,j)=><li key={j}>{b}</li>)}</ul>}{s.formula&&<div className="formula">{s.formula}</div>}</article>)}
        {(note.examples||[]).length>0&&<div className="examples"><h3>🌎 أمثلة وتطبيقات</h3>{note.examples.map((e,i)=><div className="example" key={i}><b>{e.title}</b><p>{e.body}</p><small>{e.source}</small></div>)}</div>}
        <div className="keypoints"><h3>⭐ أهم النقاط</h3>{(note.keyPoints||[]).map((x,i)=><span key={i}>{x}</span>)}</div>
      </>}
    </section>}

    {mode==="quiz" && <section className="section-card">
      <div className="quiz-builder"><div><h3>إنشاء واجب</h3><p>8 اختيار من متعدد على الأقل، والباقي يتنوع حسب طبيعة المحتوى.</p></div><div className="quiz-controls"><select value={count} onChange={e=>setCount(Number(e.target.value))}><option value="20">20 سؤال</option><option value="50">50 سؤال</option><option value="100">100 سؤال</option></select><select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="mixed">مختلط</option><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option></select><button className="primary-btn" onClick={makeQuestions} disabled={loading}>{loading?<RefreshCw className="spin"/>:<PlayCircle/>} إنشاء</button></div></div>
      {questions.length>0?<Quiz questions={questions} lessonId={lesson.id} setToast={setToast}/>:<Empty icon={ClipboardList} text="أنشئ واجبًا ليظهر هنا."/>}
    </section>}

    {mode==="source" && <section className="section-card source-card">{lesson.pages.filter(p=>p.status==="ok").map(p=><article key={p.page}><div><b>صفحة {p.page}</b><small>{p.title||"بدون عنوان"} · ثقة {p.confidence||0}%</small></div><p>{p.text}</p></article>)}</section>}
  </div>;
}

function Quiz({questions,lessonId,setToast}) {
  const [answers,setAnswers]=useState({});
  const [submitted,setSubmitted]=useState(false);
  const score=useMemo(()=>questions.reduce((s,q,i)=>s+(isCorrect(q,answers[i])?1:0),0),[questions,answers]);
  const submit=()=>{setSubmitted(true);localStorage.setItem(`sm-result-${Date.now()}`,JSON.stringify({lessonId,score,total:questions.length,date:Date.now()}));setToast(`نتيجتك ${score} / ${questions.length}`)};
  return <div className="quiz-list">{questions.map((q,i)=><div className={cn("question",submitted && (isCorrect(q,answers[i])?"correct":"wrong"))} key={i}>
    <div className="q-top"><span>سؤال {i+1}</span><small>{typeLabel(q.type)}</small></div><h4>{q.question}</h4>
    {q.type==="mcq" ? <div className="options">{(q.options||[]).map((o,j)=><label key={j} className={answers[i]===o?"picked":""}><input type="radio" name={`q${i}`} checked={answers[i]===o} onChange={()=>setAnswers(a=>({...a,[i]:o}))}/><span>{String.fromCharCode(1575+j)}. {o}</span></label>)}</div>
    : q.type==="true_false" ? <div className="options tf"><button className={answers[i]===true?"picked":""} onClick={()=>setAnswers(a=>({...a,[i]:true}))}>صح</button><button className={answers[i]===false?"picked":""} onClick={()=>setAnswers(a=>({...a,[i]:false}))}>خطأ</button></div>
    : <textarea value={answers[i]||""} onChange={e=>setAnswers(a=>({...a,[i]:e.target.value}))} placeholder="اكتب إجابتك هنا..."/>}
    {submitted && <div className="answer-box"><b>{isCorrect(q,answers[i])?"✓ إجابة صحيحة":"الإجابة النموذجية"}</b><p>{q.answer}</p><small>{q.explanation}</small></div>}
  </div>)}<div className="submit-bar">{submitted?<><b>النتيجة: {score} / {questions.length}</b><button className="secondary-btn" onClick={()=>{setSubmitted(false);setAnswers({})}}>إعادة المحاولة</button></>:<button className="primary-btn" onClick={submit}>تسليم الواجب</button>}</div></div>;
}
function typeLabel(t){return ({mcq:"اختيار من متعدد",fill:"أكمل",true_false:"صح / خطأ",short:"سؤال قصير",essay:"مقالي"})[t]||t}
function isCorrect(q,a){if(a===undefined||a==="")return false;if(q.type==="true_false")return Boolean(a)===Boolean(q.answer);if(["mcq","fill"].includes(q.type))return String(a).trim().toLowerCase()===String(q.answer).trim().toLowerCase();if(["short","essay"].includes(q.type)){const x=String(a).toLowerCase(),y=String(q.answer).toLowerCase();return x.length>10&&y.split(/\s+/).filter(w=>w.length>3).some(w=>x.includes(w));}return false}

function AssignmentsView({setToast}) {
  const results=Object.keys(localStorage).filter(k=>k.startsWith("sm-result-")).map(k=>JSON.parse(localStorage.getItem(k))).sort((a,b)=>b.date-a.date);
  return <section className="section-card"><div className="section-head"><div><h3>الواجبات والنتائج الأخيرة</h3><p>كل محاولة محفوظة على هذا الجهاز في النسخة الحالية.</p></div></div>{results.length===0?<Empty icon={ClipboardList} text="لسه مفيش واجبات محلولة."/>:<div className="result-list">{results.map((r,i)=><div className="result-row" key={i}><div className="result-ring">{Math.round(r.score/r.total*100)}%</div><div><b>اختبار محفوظ</b><small>{r.score} / {r.total} · {new Date(r.date).toLocaleString("ar-EG")}</small></div></div>)}</div>}</section>
}
function ResultsView(){return <div className="home-grid"><section className="section-card"><div className="section-head"><div><h3>تحليلك</h3><p>سيظهر هنا تاريخ نتائجك ونقاط الضعف مع توسع المشروع.</p></div></div><div className="empty"><BarChart3 size={32}/><p>حل أول واجب لتبدأ الإحصائيات.</p></div></section></div>}

createRoot(document.getElementById("root")).render(<App />);
