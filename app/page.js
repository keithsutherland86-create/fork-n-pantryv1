"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const DB_KEY = "fnp_recipes_v1";
function loadRecipes() { try { return JSON.parse(localStorage.getItem(DB_KEY)||"[]"); } catch { return []; } }
function saveRecipes(r) { try { localStorage.setItem(DB_KEY, JSON.stringify(r)); } catch {} }

// ─── Unit conversion ──────────────────────────────────────────────────────────
const TO_G  = { g:1, kg:1000, oz:28.3495, lb:453.592 };
const TO_ML = { ml:1, L:1000, tsp:4.92892, tbsp:14.7868, cup:236.588, "fl oz":29.5735 };

function pickBestUnit(baseVal, prefs, map) {
  let best=prefs[0];
  for(const u of prefs){ if(!map[u])continue; const v=baseVal/map[u]; if(v>=0.1&&v<1000){best=u;break;} }
  return { unit:best, amount:baseVal/map[best] };
}
function convertIngredient(ing, sys, scale) {
  const scaled = ing.amount * scale;
  if(!ing.unit||scaled===0||sys==="original") return {...ing, amount:scaled};
  if(TO_G[ing.unit]) {
    const g = scaled*(TO_G[ing.unit]||1);
    const {unit,amount} = pickBestUnit(g, sys==="metric"?["g","kg"]:["oz","lb"], TO_G);
    return {...ing, amount, unit};
  }
  if(TO_ML[ing.unit]) {
    const ml = scaled*(TO_ML[ing.unit]||1);
    const {unit,amount} = pickBestUnit(ml, sys==="metric"?["ml","L","tsp","tbsp"]:["fl oz","cup","tsp","tbsp"], TO_ML);
    return {...ing, amount, unit};
  }
  return {...ing, amount:scaled};
}
function fmtAmt(n) {
  if(n===0)return "";
  const fracs=[[1/8,"⅛"],[1/4,"¼"],[1/3,"⅓"],[1/2,"½"],[2/3,"⅔"],[3/4,"¾"]];
  for(const[v,s]of fracs)if(Math.abs(n-v)<0.04)return s;
  const w=Math.floor(n), r=n-w;
  for(const[v,s]of fracs)if(Math.abs(r-v)<0.04)return w>0?`${w} ${s}`:s;
  if(n>=10)return Math.round(n).toString();
  return parseFloat(n.toFixed(1)).toString();
}
function fmtIngredient(ing, sys, scale) {
  const c=convertIngredient(ing,sys,scale);
  const amt=fmtAmt(c.amount);
  return `${amt}${c.unit?" "+c.unit:""} ${c.name}`.trim();
}

// ─── Tag palette — earthy tones ───────────────────────────────────────────────
const TAG_COLORS = {
  breakfast:["#FEF3C7","#92400E"], lunch:["#DCEFD8","#2D4A2D"], dinner:["#E8DCC8","#6B4528"],
  dessert:["#FCE7F3","#831843"],   snack:["#D4E8D0","#2D4A2D"],  vegetarian:["#DCEFD8","#3D6B30"],
  vegan:["#C8E6C0","#1B5E20"],     chicken:["#FEF9C3","#854D0E"], pasta:["#FCE8D8","#9A3412"],
  soup:["#E8F0D8","#3D5A1E"],      beef:["#F5DDD8","#991B1B"],    fish:["#D8EAF5","#1E3A5F"],
  rice:["#FEF9C3","#6B4528"],      quick:["#E0D4F0","#4C1D95"],
};
function tagBg(t){ const k=Object.keys(TAG_COLORS).find(k=>(t||"").toLowerCase().includes(k)); return k?TAG_COLORS[k][0]:"#E8DCC8"; }
function tagFg(t){ const k=Object.keys(TAG_COLORS).find(k=>(t||"").toLowerCase().includes(k)); return k?TAG_COLORS[k][1]:"#6B4528"; }

function Chip({label}){
  return <span style={{background:tagBg(label),color:tagFg(label),borderRadius:4,fontSize:11,padding:"2px 8px",fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",fontFamily:"'DM Sans',sans-serif"}}>{label}</span>;
}

// ─── SVG Logo mark ────────────────────────────────────────────────────────────
function ForkIcon({size=28,color="#E8DCC8"}){
  return(
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* fork tines */}
      <line x1="8"  y1="3" x2="8"  y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="11" y1="3" x2="11" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="14" y1="3" x2="14" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      {/* fork join + handle */}
      <path d="M8 12 Q11 15 11 18 L11 25" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      {/* knife */}
      <path d="M20 3 L20 11 Q20 14 18 15 L18 25" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────
function Thumb({recipe}){
  const[err,setErr]=useState(false);
  if(recipe.ogImage&&!err) return <img src={recipe.ogImage} alt="" onError={()=>setErr(true)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>;
  const bg = recipe.tags?.[0] ? tagBg(recipe.tags[0]) : "#E8DCC8";
  return(
    <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:`linear-gradient(145deg,${bg},#FDFAF4)`,fontSize:44}}>
      {recipe.emoji||"🍽️"}
    </div>
  );
}

// ─── Recipe card ──────────────────────────────────────────────────────────────
function RecipeCard({recipe,onOpen,onDelete}){
  const host=recipe.url?(()=>{try{return new URL(recipe.url).hostname.replace("www.","");}catch{return"";}})():"";
  const src=recipe.source||host;
  const ingCount=Array.isArray(recipe.ingredients)?recipe.ingredients.length:0;
  return(
    <div onClick={()=>onOpen(recipe)} style={{
      background:"#FDFAF4", borderRadius:12, overflow:"hidden", cursor:"pointer",
      border:"1px solid var(--bark-lt)", boxShadow:"0 2px 8px var(--shadow)",
      display:"flex", flexDirection:"column", transition:"transform .15s, box-shadow .15s",
    }}
    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 18px rgba(45,30,15,.14)";}}
    onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 2px 8px var(--shadow)";}}>
      <div style={{height:130,overflow:"hidden",position:"relative",flexShrink:0}}>
        <Thumb recipe={recipe}/>
        <button onClick={e=>{e.stopPropagation();onDelete(recipe.id);}} style={{position:"absolute",top:7,right:7,background:"rgba(30,20,8,.55)",backdropFilter:"blur(4px)",border:"none",color:"#E8DCC8",borderRadius:"50%",width:26,height:26,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        {src&&<div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(30,20,8,.6))",padding:"16px 10px 6px",fontSize:10,color:"#E8DCC8",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>{src}</div>}
      </div>
      <div style={{padding:"10px 12px 10px",flex:1,display:"flex",flexDirection:"column",gap:5}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:14,color:"var(--forest)",lineHeight:1.35,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{recipe.title||"Untitled"}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:"auto"}}>
          {(recipe.tags||[]).slice(0,2).map(t=><Chip key={t} label={t}/>)}
        </div>
        {recipe.servings&&<div style={{fontSize:11,color:"var(--mist)"}}>Serves {recipe.servings} · {ingCount} ingredients</div>}
      </div>
    </div>
  );
}

// ─── Scaler bar ───────────────────────────────────────────────────────────────
function ScalerBar({servings,setServings,baseServings,unitSystem,setUnitSystem}){
  const scale=servings/baseServings;
  const btn=(active,label,onClick)=>(
    <button onClick={onClick} style={{flex:1,padding:"7px 0",borderRadius:6,border:active?"none":"1px solid var(--bark-lt)",cursor:"pointer",fontSize:12,fontWeight:700,background:active?"var(--moss)":"var(--cream)",color:active?"#fff":"var(--walnut)",transition:"all .15s"}}>
      {label}
    </button>
  );
  return(
    <div style={{background:"var(--cream)",borderRadius:10,padding:"12px 14px",marginBottom:16,border:"1px solid var(--bark-lt)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:11}}>
        <span style={{fontSize:13,fontWeight:700,color:"var(--forest)"}}>Servings</span>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setServings(s=>Math.max(1,s-1))} style={{width:30,height:30,borderRadius:"50%",border:"1px solid var(--bark-lt)",background:"var(--linen)",fontSize:18,cursor:"pointer",color:"var(--walnut)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>−</button>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"var(--forest)",minWidth:24,textAlign:"center"}}>{servings}</span>
          <button onClick={()=>setServings(s=>s+1)} style={{width:30,height:30,borderRadius:"50%",border:"1px solid var(--bark-lt)",background:"var(--linen)",fontSize:18,cursor:"pointer",color:"var(--walnut)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>+</button>
        </div>
        {scale!==1&&<span style={{fontSize:11,color:"var(--mist)",background:"var(--linen)",border:"1px solid var(--bark-lt)",borderRadius:6,padding:"2px 7px"}}>{scale>1?`×${fmtAmt(scale)}`:`÷${fmtAmt(1/scale)}`}</span>}
      </div>
      <div style={{display:"flex",gap:5}}>
        {btn(unitSystem==="original","Original",()=>setUnitSystem("original"))}
        {btn(unitSystem==="metric","Metric 🇦🇺",()=>setUnitSystem("metric"))}
        {btn(unitSystem==="imperial","Imperial 🇺🇸",()=>setUnitSystem("imperial"))}
      </div>
    </div>
  );
}

// ─── Recipe modal ─────────────────────────────────────────────────────────────
function RecipeModal({recipe,onClose}){
  const[imgErr,setImgErr]=useState(false);
  const[servings,setServings]=useState(null);
  const[unitSystem,setUnitSystem]=useState("original");
  useEffect(()=>{ if(recipe)setServings(recipe.servings||4); setImgErr(false); },[recipe]);
  if(!recipe||servings===null)return null;

  const baseServings=recipe.servings||4;
  const scale=servings/baseServings;
  const hasStructured=recipe.ingredients?.length>0&&typeof recipe.ingredients[0]==="object";

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(20,12,4,.6)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"93vh",overflowY:"auto",paddingBottom:"calc(24px + env(safe-area-inset-bottom))"}}>

        {/* Hero image or emoji */}
        {recipe.ogImage&&!imgErr
          ?<div style={{height:210,overflow:"hidden",borderRadius:"20px 20px 0 0",position:"relative"}}>
              <img src={recipe.ogImage} alt="" onError={()=>setImgErr(true)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 50%,rgba(20,12,4,.5))"}}/>
            </div>
          :<div style={{height:130,background:`linear-gradient(135deg,${recipe.tags?.[0]?tagBg(recipe.tags[0]):"#E8DCC8"},#FDFAF4)`,borderRadius:"20px 20px 0 0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:60}}>{recipe.emoji||"🍽️"}</div>
        }

        <div style={{padding:"18px 20px 0"}}>
          {/* Drag handle */}
          <div style={{width:36,height:4,background:"var(--bark)",borderRadius:2,margin:"-6px auto 14px"}}/>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"var(--forest)",lineHeight:1.25,flex:1,paddingRight:12}}>{recipe.title}</h2>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:24,color:"var(--bark)",cursor:"pointer",flexShrink:0,marginTop:-2}}>×</button>
          </div>

          {recipe.source&&<div style={{fontSize:13,color:"var(--mist)",marginBottom:6}}>📍 {recipe.source}</div>}
          {recipe.url&&<a href={recipe.url} target="_blank" rel="noreferrer" style={{fontSize:13,color:"var(--moss)",wordBreak:"break-all",display:"block",marginBottom:10}}>🔗 View original</a>}
          {recipe.description&&<p style={{color:"var(--walnut)",fontSize:14,lineHeight:1.65,marginBottom:14}}>{recipe.description}</p>}

          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:16}}>
            {(recipe.tags||[]).map(t=><Chip key={t} label={t}/>)}
          </div>

          {hasStructured&&<ScalerBar servings={servings} setServings={setServings} baseServings={baseServings} unitSystem={unitSystem} setUnitSystem={setUnitSystem}/>}

          {/* Ingredients */}
          {recipe.ingredients?.length>0&&<>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,marginBottom:10,color:"var(--forest)",paddingBottom:6,borderBottom:"2px solid var(--bark-lt)"}}>Ingredients</h3>
            <ul style={{paddingLeft:0,marginBottom:20,listStyle:"none"}}>
              {recipe.ingredients.map((ing,i)=>{
                const line=hasStructured?fmtIngredient(ing,unitSystem,scale):(typeof ing==="string"?ing:JSON.stringify(ing));
                return(
                  <li key={i} style={{fontSize:14,color:"var(--ink)",marginBottom:0,lineHeight:1.55,display:"flex",alignItems:"baseline",gap:10,padding:"7px 0",borderBottom:"1px solid var(--linen)"}}>
                    <span style={{color:"var(--moss)",fontSize:11,flexShrink:0,marginTop:2}}>◆</span>
                    <span>{line}</span>
                  </li>
                );
              })}
            </ul>
          </>}

          {/* Steps */}
          {recipe.steps?.length>0&&<>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,marginBottom:10,color:"var(--forest)",paddingBottom:6,borderBottom:"2px solid var(--bark-lt)"}}>Method</h3>
            <ol style={{paddingLeft:0,listStyle:"none",paddingBottom:12}}>
              {recipe.steps.map((s,i)=>(
                <li key={i} style={{fontSize:14,color:"var(--ink)",marginBottom:14,lineHeight:1.65,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <span style={{fontFamily:"'Playfair Display',serif",background:"var(--walnut)",color:"#F5F0E8",borderRadius:"50%",width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0,marginTop:1}}>{i+1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </>}

          {recipe.notes&&<>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,margin:"14px 0 8px",color:"var(--forest)"}}>Notes</h3>
            <p style={{fontSize:14,color:"var(--walnut)",lineHeight:1.65,paddingBottom:10}}>{recipe.notes}</p>
          </>}
        </div>
      </div>
    </div>
  );
}

// ─── Add sheet ────────────────────────────────────────────────────────────────
function AddSheet({onAdd,onClose,prefill=""}){
  const[tab,setTab]=useState("paste");
  const[input,setInput]=useState(prefill);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const[listening,setListening]=useState(false);
  const[transcript,setTranscript]=useState("");
  const recRef=useRef(null);
  const[form,setForm]=useState({title:"",url:"",source:"",notes:""});

  useEffect(()=>{ if(prefill)parseAndSave(prefill); },[]);

  async function parseAndSave(text){
    setLoading(true);setError("");
    try{
      const res=await fetch("/api/parse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:text})});
      const data=await res.json();
      if(!data.ok)throw new Error(data.error);
      onAdd({id:Date.now().toString(),...data.recipe,ogImage:data.ogImage||"",url:text.startsWith("http")?text:"",savedAt:Date.now()});
      onClose();
    }catch(e){setError("Couldn't parse — try manual entry.");}
    finally{setLoading(false);}
  }

  function startVoice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setError("Voice not supported in this browser.");return;}
    const r=new SR(); r.continuous=true; r.interimResults=true; r.lang="en-AU";
    r.onresult=e=>{setTranscript(Array.from(e.results).map(r=>r[0].transcript).join(" "));};
    r.onerror=()=>{setListening(false);setError("Microphone error — check permissions.");};
    r.onend=()=>setListening(false);
    r.start(); recRef.current=r; setListening(true); setTranscript(""); setError("");
  }
  function stopVoice(){recRef.current?.stop();setListening(false);}

  function handleManual(){
    if(!form.title.trim()){setError("Title is required.");return;}
    onAdd({id:Date.now().toString(),title:form.title,url:form.url,source:form.source,notes:form.notes,description:"",ingredients:[],steps:[],tags:[],ogImage:"",emoji:"🍽️",servings:4,savedAt:Date.now()});
    onClose();
  }

  const tabs=[{id:"paste",label:"📋 Paste"},{id:"voice",label:"🎙️ Voice"},{id:"manual",label:"✏️ Manual"}];
  const inputStyle={width:"100%",padding:"10px 13px",borderRadius:8,border:"1px solid var(--bark-lt)",background:"var(--cream)",fontSize:14,outline:"none",color:"var(--forest)"};
  const mossBtnStyle=(disabled)=>({width:"100%",padding:"13px 0",borderRadius:10,border:"none",background:disabled?"var(--bark-lt)":"var(--moss)",color:disabled?"var(--mist)":"#fff",fontWeight:700,fontSize:15,cursor:disabled?"default":"pointer",transition:"background .15s"});

  if(loading&&prefill){
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(20,12,4,.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:"var(--cream)",borderRadius:16,padding:"32px 28px",textAlign:"center",border:"1px solid var(--bark-lt)"}}>
          <div style={{fontSize:36,marginBottom:12}}>🍳</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:17,color:"var(--forest)",marginBottom:6}}>Saving to pantry…</div>
          <div style={{fontSize:13,color:"var(--mist)"}}>AI is reading the page</div>
        </div>
      </div>
    );
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(20,12,4,.6)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"20px 20px 0 0",width:"100%",padding:"16px 18px 24px",paddingBottom:"calc(24px + env(safe-area-inset-bottom))"}}>
        <div style={{width:36,height:4,background:"var(--bark)",borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:19,color:"var(--forest)",marginBottom:14}}>Add to Pantry</div>

        {/* Tabs */}
        <div style={{display:"flex",gap:5,marginBottom:16,background:"var(--cream)",borderRadius:10,padding:4,border:"1px solid var(--bark-lt)"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setError("");}} style={{flex:1,padding:"7px 0",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:tab===t.id?"var(--walnut)":"transparent",color:tab===t.id?"#F5F0E8":"var(--walnut)",boxShadow:tab===t.id?"0 1px 4px rgba(0,0,0,.12)":"none",transition:"all .15s"}}>{t.label}</button>
          ))}
        </div>

        {tab==="paste"&&<>
          <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder={"Paste a URL or recipe text…\n\nTip: copy an Instagram or TikTok caption and paste it here"}
            style={{...inputStyle,minHeight:110,resize:"none"}}/>
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginTop:6}}>{error}</div>}
          <button onClick={()=>parseAndSave(input)} disabled={loading||!input.trim()} style={{...mossBtnStyle(loading||!input.trim()),marginTop:10}}>
            {loading?"Analysing…":"Save with AI ✦"}
          </button>
          <div style={{marginTop:10,padding:"10px 12px",background:"#EEF5E8",borderRadius:8,fontSize:12,color:"var(--forest)",lineHeight:1.6,border:"1px solid var(--bark-lt)"}}>
            💡 <strong>From Instagram/TikTok:</strong> Copy the post caption, paste above. For recipe sites, paste the URL directly.
          </div>
        </>}

        {tab==="voice"&&<>
          <div style={{textAlign:"center",padding:"14px 0 18px"}}>
            <button onClick={listening?stopVoice:startVoice} style={{width:84,height:84,borderRadius:"50%",border:listening?"none":"2px solid var(--bark-lt)",cursor:"pointer",background:listening?"#FEE2E2":"var(--cream)",fontSize:38,display:"inline-flex",alignItems:"center",justifyContent:"center",boxShadow:listening?"0 0 0 10px #FECACA":"0 2px 8px var(--shadow)",transition:"all .3s"}}>
              {listening?"⏹":"🎙️"}
            </button>
            <div style={{marginTop:12,fontSize:14,color:listening?"var(--moss)":"var(--mist)",fontWeight:600}}>{listening?"Listening… tap to stop":"Tap to start speaking"}</div>
            {!listening&&<div style={{fontSize:12,color:"var(--bark)",marginTop:5}}>Read out a recipe or describe a dish</div>}
          </div>
          {transcript&&<div style={{background:"var(--cream)",borderRadius:10,padding:"10px 13px",fontSize:13,color:"var(--forest)",minHeight:60,marginBottom:12,lineHeight:1.6,border:"1px solid var(--bark-lt)"}}>{transcript}</div>}
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8}}>{error}</div>}
          {transcript&&!listening&&<button onClick={()=>parseAndSave(transcript)} disabled={loading} style={mossBtnStyle(loading)}>{loading?"Analysing…":"Parse & Save ✦"}</button>}
        </>}

        {tab==="manual"&&<>
          {[["Recipe title *","title","text"],["URL (optional)","url","url"],["Source","source","text"]].map(([lbl,key,type])=>(
            <div key={key} style={{marginBottom:10}}>
              <label style={{fontSize:12,fontWeight:700,color:"var(--walnut)",display:"block",marginBottom:4,letterSpacing:"0.03em"}}>{lbl}</label>
              <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={inputStyle}/>
            </div>
          ))}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:700,color:"var(--walnut)",display:"block",marginBottom:4,letterSpacing:"0.03em"}}>Notes</label>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{...inputStyle,minHeight:70,resize:"none"}}/>
          </div>
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8}}>{error}</div>}
          <button onClick={handleManual} style={mossBtnStyle(false)}>Save Recipe</button>
        </>}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function HomeInner(){
  const[recipes,setRecipes]=useState([]);
  const[showAdd,setShowAdd]=useState(false);
  const[selected,setSelected]=useState(null);
  const[search,setSearch]=useState("");
  const[filterTag,setFilterTag]=useState("");
  const[sharedPrefill,setSharedPrefill]=useState("");
  const searchParams=useSearchParams();
  const router=useRouter();

  useEffect(()=>{
    setRecipes(loadRecipes());
    if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
    const shared=searchParams.get("shared");
    if(shared){setSharedPrefill(decodeURIComponent(shared));setShowAdd(true);router.replace("/");}
  },[]);

  function addRecipe(r){const u=[r,...recipes];setRecipes(u);saveRecipes(u);}
  function deleteRecipe(id){const u=recipes.filter(r=>r.id!==id);setRecipes(u);saveRecipes(u);}

  const allTags=[...new Set(recipes.flatMap(r=>r.tags||[]))];
  const filtered=recipes.filter(r=>{
    const q=search.toLowerCase();
    const ms=!q||r.title?.toLowerCase().includes(q)||r.source?.toLowerCase().includes(q)||(r.tags||[]).some(t=>t.toLowerCase().includes(q));
    const mt=!filterTag||(r.tags||[]).includes(filterTag);
    return ms&&mt;
  });

  return(
    <div style={{minHeight:"100vh",background:"var(--linen)",paddingBottom:80}}>

      {/* Wood header */}
      <div className="wood-header" style={{paddingTop:"env(safe-area-inset-top)",position:"sticky",top:0,zIndex:10}}>
        <div style={{padding:"14px 18px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <ForkIcon size={26} color="#E8DCC8"/>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:20,color:"#F5F0E8",letterSpacing:"-0.01em",lineHeight:1}}>Fork n Pantry</div>
              <div style={{fontSize:11,color:"var(--bark)",marginTop:2,letterSpacing:"0.06em",textTransform:"uppercase"}}>{recipes.length} recipe{recipes.length!==1?"s":""} saved</div>
            </div>
          </div>
          <button onClick={()=>{setSharedPrefill("");setShowAdd(true);}} style={{background:"var(--moss)",color:"#fff",border:"none",borderRadius:20,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer",letterSpacing:"0.02em"}}>+ Add</button>
        </div>

        {/* Search bar */}
        <div style={{padding:"0 18px 13px"}}>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:15,opacity:.5}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your pantry…"
              style={{width:"100%",padding:"9px 13px 9px 34px",borderRadius:9,border:"none",fontSize:14,background:"rgba(245,240,232,.15)",color:"#F5F0E8",outline:"none","::placeholder":{color:"rgba(245,240,232,.5)"}}}/>
          </div>
        </div>
      </div>

      <div style={{padding:"14px 14px 0"}}>
        {/* Tag filter pills */}
        {allTags.length>0&&(
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:12,scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
            {allTags.map(t=>(
              <button key={t} onClick={()=>setFilterTag(t===filterTag?"":t)} style={{flexShrink:0,background:t===filterTag?"var(--walnut)":"var(--cream)",color:t===filterTag?"#F5F0E8":"var(--walnut)",border:"1px solid var(--bark-lt)",borderRadius:20,padding:"5px 13px",fontSize:12,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.04em",transition:"all .15s"}}>{t}</button>
            ))}
            {filterTag&&<button onClick={()=>setFilterTag("")} style={{flexShrink:0,background:"#FEE2E2",color:"#991B1B",border:"1px solid #FECACA",borderRadius:20,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>✕ Clear</button>}
          </div>
        )}

        {/* Grid */}
        {filtered.length===0?(
          <div style={{textAlign:"center",paddingTop:80}}>
            {recipes.length===0
              ?<>
                  <div style={{fontSize:52,marginBottom:14}}>🫙</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:20,color:"var(--forest)",marginBottom:8}}>Your pantry is empty</div>
                  <div style={{fontSize:14,color:"var(--mist)",lineHeight:1.7}}>Tap + Add to save your first recipe.<br/>Paste a link, speak it aloud, or type it in.</div>
                </>
              :<div style={{fontSize:14,color:"var(--mist)"}}>No recipes match.</div>
            }
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(158px,1fr))",gap:12}}>
            {filtered.map(r=><RecipeCard key={r.id} recipe={r} onOpen={setSelected} onDelete={deleteRecipe}/>)}
          </div>
        )}
      </div>

      {showAdd&&<AddSheet onAdd={addRecipe} onClose={()=>{setShowAdd(false);setSharedPrefill("");}} prefill={sharedPrefill}/>}
      <RecipeModal recipe={selected} onClose={()=>setSelected(null)}/>
    </div>
  );
}

export default function Home(){
  return <Suspense><HomeInner/></Suspense>;
}
