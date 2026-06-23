"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEYS = { recipes: "fnp_recipes_v2", categories: "fnp_categories_v1", planner: "fnp_planner_v1" };
const load = k => { try { return JSON.parse(localStorage.getItem(k)||"[]"); } catch { return []; } };
const save = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ─── Unit conversion ──────────────────────────────────────────────────────────
const TO_G={g:1,kg:1000,oz:28.3495,lb:453.592};
const TO_ML={ml:1,L:1000,tsp:4.92892,tbsp:14.7868,cup:236.588,"fl oz":29.5735};
function pickBest(base,prefs,map){let b=prefs[0];for(const u of prefs){if(!map[u])continue;const v=base/map[u];if(v>=0.1&&v<1000){b=u;break;}}return{unit:b,amount:base/map[b]};}
function convertIng(ing,sys,scale){
  const sc=ing.amount*scale;
  if(!ing.unit||sc===0||sys==="original")return{...ing,amount:sc};
  if(TO_G[ing.unit]){const g=sc*TO_G[ing.unit];const{unit,amount}=pickBest(g,sys==="metric"?["g","kg"]:["oz","lb"],TO_G);return{...ing,amount,unit};}
  if(TO_ML[ing.unit]){const ml=sc*TO_ML[ing.unit];const{unit,amount}=pickBest(ml,sys==="metric"?["ml","L","tsp","tbsp"]:["fl oz","cup","tsp","tbsp"],TO_ML);return{...ing,amount,unit};}
  return{...ing,amount:sc};
}
function fmtN(n){
  if(n===0)return"";
  const fr=[[1/8,"⅛"],[1/4,"¼"],[1/3,"⅓"],[1/2,"½"],[2/3,"⅔"],[3/4,"¾"]];
  for(const[v,s]of fr)if(Math.abs(n-v)<0.04)return s;
  const w=Math.floor(n),r=n-w;
  for(const[v,s]of fr)if(Math.abs(r-v)<0.04)return w>0?`${w} ${s}`:s;
  if(n>=10)return Math.round(n).toString();
  return parseFloat(n.toFixed(1)).toString();
}
function fmtIng(ing,sys,scale){const c=convertIng(ing,sys,scale);return`${fmtN(c.amount)}${c.unit?" "+c.unit:""} ${c.name}`.trim();}

// ─── Colours ──────────────────────────────────────────────────────────────────
const TAG_PAL={
  breakfast:["#FEF3C7","#92400E"],lunch:["#DCEFD8","#2D4A2D"],dinner:["#E8DCC8","#6B4528"],
  dessert:["#FCE7F3","#831843"],snack:["#D4E8D0","#2D4A2D"],vegetarian:["#DCEFD8","#3D6B30"],
  vegan:["#C8E6C0","#1B5E20"],chicken:["#FEF9C3","#854D0E"],pasta:["#FCE8D8","#9A3412"],
  soup:["#E8F0D8","#3D5A1E"],beef:["#F5DDD8","#991B1B"],fish:["#D8EAF5","#1E3A5F"],
  salad:["#D0F0D8","#1B5E20"],quick:["#EDE9FE","#4C1D95"],
};
const tb=(t)=>{const k=Object.keys(TAG_PAL).find(k=>(t||"").toLowerCase().includes(k));return k?TAG_PAL[k][0]:"#EEF4EC";};
const tf=(t)=>{const k=Object.keys(TAG_PAL).find(k=>(t||"").toLowerCase().includes(k));return k?TAG_PAL[k][1]:"#2A3D2A";};

const CAT_COLORS=["#4A6741","#8C6642","#5B7FA6","#A0522D","#4A7A7A","#7A4A7A","#6B8E23","#CD853F"];

// ─── Design tokens ────────────────────────────────────────────────────────────
const s={
  card:{background:"var(--warm-white)",borderRadius:"var(--r-lg)",border:"1px solid rgba(143,175,136,.25)",boxShadow:"var(--shadow-sm)"},
  btn:{moss:{background:"var(--moss)",color:"#fff",border:"none",borderRadius:"var(--r-md)",fontWeight:700,cursor:"pointer",transition:"all .18s"},
       ghost:{background:"transparent",color:"var(--moss)",border:"1.5px solid var(--sage-lt)",borderRadius:"var(--r-md)",fontWeight:600,cursor:"pointer",transition:"all .18s"},
       bark:{background:"var(--bark)",color:"#fff",border:"none",borderRadius:"var(--r-md)",fontWeight:700,cursor:"pointer",transition:"all .18s"}},
  input:{background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"11px 14px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%"},
};

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({label,small}){
  return <span style={{background:tb(label),color:tf(label),borderRadius:20,fontSize:small?10:11,padding:small?"1px 7px":"2px 9px",fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{label}</span>;
}

// ─── Logo SVG ─────────────────────────────────────────────────────────────────
function Logo({size=32}){
  return(
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill="#2A3D2A"/>
      <rect x="0" y="0" width="48" height="24" rx="12" fill="#344F34" opacity=".6"/>
      {/* Fork tines */}
      {[13,17,21,25].map(x=><line key={x} x1={x} y1="10" x2={x} y2="22" stroke="#EDE8DC" strokeWidth="2" strokeLinecap="round"/>)}
      {/* Fork join + handle */}
      <path d="M13 22 Q19 27 19 30 L19 39" stroke="#EDE8DC" strokeWidth="2" strokeLinecap="round"/>
      {/* Knife blade */}
      <path d="M31 10 L37 16 L37 27 L31 27 Z" fill="#C8DCC4"/>
      {/* Knife spine */}
      <line x1="31" y1="10" x2="31" y2="39" stroke="#EDE8DC" strokeWidth="2" strokeLinecap="round"/>
      {/* Leaf */}
      <ellipse cx="24" cy="42" rx="4" ry="3" fill="#8FAF88"/>
    </svg>
  );
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────
function Thumb({recipe,height=140}){
  const[err,setErr]=useState(false);
  if(recipe.ogImage&&!err)
    return <img src={recipe.ogImage} alt="" onError={()=>setErr(true)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>;
  const bg=recipe.tags?.[0]?tb(recipe.tags[0]):"#EEF4EC";
  return(
    <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:`linear-gradient(145deg,${bg} 0%,var(--cream) 100%)`,fontSize:Math.round(height*0.34)}}>
      {recipe.emoji||"🍽️"}
    </div>
  );
}

// ─── Recipe card ──────────────────────────────────────────────────────────────
function RecipeCard({recipe,onOpen,onDelete,compact}){
  const src=recipe.source||(recipe.url?(()=>{try{return new URL(recipe.url).hostname.replace("www.","");}catch{return"";}})():"");
  return(
    <div onClick={()=>onOpen(recipe)} style={{...s.card,overflow:"hidden",cursor:"pointer",display:"flex",flexDirection:"column",transition:"transform .18s, box-shadow .18s"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="var(--shadow-md)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="var(--shadow-sm)";}}>
      <div style={{height:compact?110:140,overflow:"hidden",position:"relative",flexShrink:0,borderRadius:"var(--r-lg) var(--r-lg) 0 0"}}>
        <Thumb recipe={recipe} height={compact?110:140}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 55%,rgba(28,43,28,.55))",borderRadius:"var(--r-lg) var(--r-lg) 0 0"}}/>
        {src&&<div style={{position:"absolute",bottom:7,left:10,fontSize:10,color:"rgba(255,255,255,.85)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>{src}</div>}
        <button onClick={e=>{e.stopPropagation();onDelete(recipe.id);}} style={{position:"absolute",top:8,right:8,background:"rgba(28,43,28,.5)",backdropFilter:"blur(6px)",border:"none",color:"#fff",borderRadius:"50%",width:26,height:26,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
      </div>
      <div style={{padding:"11px 13px 12px",flex:1,display:"flex",flexDirection:"column",gap:5}}>
        <div className="serif" style={{fontWeight:600,fontSize:compact?13:15,color:"var(--forest)",lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{recipe.title||"Untitled"}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:"auto"}}>
          {(recipe.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} small/>)}
        </div>
        {(recipe.servings||recipe.prepTime)&&(
          <div style={{fontSize:11,color:"var(--mist)",display:"flex",gap:8}}>
            {recipe.servings&&<span>🍽 {recipe.servings}</span>}
            {recipe.prepTime&&<span>⏱ {recipe.prepTime}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Scaler bar ───────────────────────────────────────────────────────────────
function ScalerBar({servings,setServings,base,unit,setUnit}){
  const scale=servings/base;
  return(
    <div style={{background:"var(--sage-pale)",borderRadius:"var(--r-md)",padding:"12px 14px",marginBottom:16,border:"1px solid var(--sage-lt)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:700,color:"var(--forest)"}}>Servings</span>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setServings(s=>Math.max(1,s-1))} style={{width:30,height:30,borderRadius:"50%",border:"1.5px solid var(--sage-lt)",background:"var(--cream)",fontSize:18,cursor:"pointer",color:"var(--moss)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>−</button>
          <span className="serif" style={{fontSize:20,fontWeight:600,color:"var(--forest)",minWidth:24,textAlign:"center"}}>{servings}</span>
          <button onClick={()=>setServings(s=>s+1)} style={{width:30,height:30,borderRadius:"50%",border:"1.5px solid var(--sage-lt)",background:"var(--cream)",fontSize:18,cursor:"pointer",color:"var(--moss)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>+</button>
        </div>
        {scale!==1&&<span style={{fontSize:11,color:"var(--mist)",background:"var(--cream)",border:"1px solid var(--sage-lt)",borderRadius:6,padding:"2px 7px"}}>{scale>1?`×${fmtN(scale)}`:`÷${fmtN(1/scale)}`}</span>}
      </div>
      <div style={{display:"flex",gap:5}}>
        {["original","metric","imperial"].map(u=>(
          <button key={u} onClick={()=>setUnit(u)} style={{flex:1,padding:"7px 0",borderRadius:8,border:unit===u?"none":"1px solid var(--sage-lt)",cursor:"pointer",fontSize:11,fontWeight:700,textTransform:"capitalize",background:unit===u?"var(--moss)":"var(--cream)",color:unit===u?"#fff":"var(--mist)",transition:"all .15s"}}>
            {u==="original"?"Original":u==="metric"?"Metric 🇦🇺":"Imperial 🇺🇸"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Recipe modal ─────────────────────────────────────────────────────────────
function RecipeModal({recipe,onClose}){
  const[imgErr,setImgErr]=useState(false);
  const[servings,setServings]=useState(null);
  const[unit,setUnit]=useState("original");
  useEffect(()=>{ if(recipe){setServings(recipe.servings||4);setImgErr(false);} },[recipe]);
  if(!recipe||servings===null)return null;
  const base=recipe.servings||4, scale=servings/base;
  const hasStr=recipe.ingredients?.length>0&&typeof recipe.ingredients[0]==="object";

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(28,43,28,.55)",zIndex:300,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"28px 28px 0 0",width:"100%",maxHeight:"93vh",overflowY:"auto",paddingBottom:"calc(28px + env(safe-area-inset-bottom))"}}>
        {recipe.ogImage&&!imgErr
          ?<div style={{height:220,overflow:"hidden",borderRadius:"28px 28px 0 0",position:"relative",flexShrink:0}}>
              <img src={recipe.ogImage} alt="" onError={()=>setImgErr(true)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 40%,rgba(28,43,28,.65))"}}/>
              <div style={{position:"absolute",bottom:18,left:20,right:50}}>
                <h2 className="serif" style={{fontSize:22,fontWeight:600,color:"#fff",lineHeight:1.2}}>{recipe.title}</h2>
              </div>
            </div>
          :<div style={{height:140,background:`linear-gradient(145deg,${recipe.tags?.[0]?tb(recipe.tags[0]):"#EEF4EC"},var(--cream))`,borderRadius:"28px 28px 0 0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:64,position:"relative"}}>
              {recipe.emoji||"🍽️"}
            </div>
        }
        <div style={{padding:"18px 20px 0"}}>
          <div style={{width:36,height:4,background:"var(--sage-lt)",borderRadius:2,margin:"-4px auto 14px"}}/>
          {(!recipe.ogImage||imgErr)&&<h2 className="serif" style={{fontSize:22,fontWeight:600,color:"var(--forest)",lineHeight:1.25,marginBottom:10,paddingRight:32}}>{recipe.title}</h2>}
          <button onClick={onClose} style={{position:"absolute",top:16,right:16,background:"var(--parchment)",border:"none",borderRadius:"50%",width:32,height:32,fontSize:18,cursor:"pointer",color:"var(--mist)",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>

          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12,alignItems:"center"}}>
            {recipe.source&&<span style={{fontSize:12,color:"var(--mist)"}}>📍 {recipe.source}</span>}
            {recipe.prepTime&&<span style={{fontSize:12,color:"var(--mist)"}}>⏱ Prep {recipe.prepTime}</span>}
            {recipe.cookTime&&<span style={{fontSize:12,color:"var(--mist)"}}>🔥 Cook {recipe.cookTime}</span>}
          </div>
          {recipe.url&&<a href={recipe.url} target="_blank" rel="noreferrer" style={{fontSize:13,color:"var(--moss)",display:"block",marginBottom:12}}>🔗 View original recipe</a>}
          {recipe.description&&<p style={{color:"var(--bark)",fontSize:14,lineHeight:1.7,marginBottom:14,fontStyle:"italic"}}>{recipe.description}</p>}
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:16}}>{(recipe.tags||[]).map(t=><Chip key={t} label={t}/>)}</div>

          {hasStr&&<ScalerBar servings={servings} setServings={setServings} base={base} unit={unit} setUnit={setUnit}/>}

          {recipe.ingredients?.length>0&&<>
            <h3 className="serif" style={{fontSize:17,fontWeight:600,color:"var(--forest)",marginBottom:10,paddingBottom:6,borderBottom:"1.5px solid var(--parchment)"}}>Ingredients</h3>
            <ul style={{listStyle:"none",marginBottom:20}}>
              {recipe.ingredients.map((ing,i)=>{
                const line=hasStr?fmtIng(ing,unit,scale):(typeof ing==="string"?ing:ing.name||"");
                return <li key={i} style={{fontSize:14,color:"var(--ink)",padding:"7px 0",borderBottom:"1px solid var(--sage-pale)",display:"flex",gap:10,alignItems:"baseline"}}>
                  <span style={{color:"var(--sage)",fontSize:10,flexShrink:0}}>◆</span>{line}
                </li>;
              })}
            </ul>
          </>}

          {recipe.steps?.length>0&&<>
            <h3 className="serif" style={{fontSize:17,fontWeight:600,color:"var(--forest)",marginBottom:10,paddingBottom:6,borderBottom:"1.5px solid var(--parchment)"}}>Method</h3>
            <ol style={{listStyle:"none",paddingBottom:8}}>
              {recipe.steps.map((step,i)=>(
                <li key={i} style={{fontSize:14,color:"var(--ink)",marginBottom:14,lineHeight:1.7,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <span style={{background:"var(--moss)",color:"#fff",borderRadius:"50%",width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,marginTop:2}}>{i+1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </>}
          {recipe.notes&&<p style={{fontSize:13,color:"var(--mist)",fontStyle:"italic",paddingBottom:10,lineHeight:1.6}}>{recipe.notes}</p>}
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
      if(!data.ok)throw new Error();
      onAdd({id:Date.now().toString(),...data.recipe,ogImage:data.ogImage||"",url:text.startsWith("http")?text:"",savedAt:Date.now()});
      onClose();
    }catch{setError("Couldn't parse — try manual entry.");}
    finally{setLoading(false);}
  }

  function startVoice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setError("Voice not supported.");return;}
    const r=new SR();r.continuous=true;r.interimResults=true;r.lang="en-AU";
    r.onresult=e=>setTranscript(Array.from(e.results).map(r=>r[0].transcript).join(" "));
    r.onerror=()=>{setListening(false);setError("Mic error — check permissions.");};
    r.onend=()=>setListening(false);
    r.start();recRef.current=r;setListening(true);setTranscript("");setError("");
  }

  if(loading&&prefill) return(
    <div style={{position:"fixed",inset:0,background:"rgba(28,43,28,.55)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{...s.card,padding:"32px 28px",textAlign:"center",minWidth:220}}>
        <div style={{fontSize:40,marginBottom:12}}>🌿</div>
        <div className="serif" style={{fontWeight:600,fontSize:18,color:"var(--forest)",marginBottom:6}}>Adding to pantry…</div>
        <div style={{fontSize:13,color:"var(--mist)"}}>AI is reading the page</div>
      </div>
    </div>
  );

  const tabs=[{id:"paste",icon:"📋",label:"Paste"},{id:"voice",icon:"🎙️",label:"Voice"},{id:"manual",icon:"✏️",label:"Manual"}];
  const inp={...s.input};
  const mossBtn=(dis)=>({...s.btn.moss,width:"100%",padding:"13px 0",fontSize:15,opacity:dis?.7:1});

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(28,43,28,.55)",zIndex:300,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"28px 28px 0 0",width:"100%",padding:"16px 18px 20px",paddingBottom:"calc(20px + env(safe-area-inset-bottom))"}}>
        <div style={{width:36,height:4,background:"var(--sage-lt)",borderRadius:2,margin:"0 auto 16px"}}/>
        <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:16}}>Add to Pantry</div>
        <div style={{display:"flex",gap:5,marginBottom:18,background:"var(--parchment)",borderRadius:14,padding:4}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setError("");}} style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:tab===t.id?"var(--warm-white)":"transparent",color:tab===t.id?"var(--forest)":"var(--mist)",boxShadow:tab===t.id?"var(--shadow-sm)":"none",transition:"all .15s"}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab==="paste"&&<>
          <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder={"Paste a URL or recipe text…\n\nTip: copy a caption from Instagram or TikTok"}
            style={{...inp,minHeight:110,resize:"none"}}/>
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginTop:6}}>{error}</div>}
          <button onClick={()=>parseAndSave(input)} disabled={loading||!input.trim()} style={{...mossBtn(loading||!input.trim()),marginTop:10}}>{loading?"Analysing…":"Save with AI ✦"}</button>
          <div style={{marginTop:10,padding:"10px 12px",background:"var(--sage-pale)",borderRadius:10,fontSize:12,color:"var(--forest)",lineHeight:1.65,border:"1px solid var(--sage-lt)"}}>
            💡 <strong>Recipe websites:</strong> paste the URL. <strong>Instagram/TikTok:</strong> copy the caption text and paste here.
          </div>
        </>}

        {tab==="voice"&&<>
          <div style={{textAlign:"center",padding:"16px 0 20px"}}>
            <button onClick={listening?()=>{recRef.current?.stop();setListening(false);}:startVoice} style={{width:88,height:88,borderRadius:"50%",border:"none",cursor:"pointer",background:listening?"#FEE2E2":"var(--sage-pale)",fontSize:40,display:"inline-flex",alignItems:"center",justifyContent:"center",boxShadow:listening?"0 0 0 10px #FECACA":"var(--shadow-md)",transition:"all .3s"}}>
              {listening?"⏹":"🎙️"}
            </button>
            <div style={{marginTop:12,fontSize:14,color:listening?"var(--moss)":"var(--mist)",fontWeight:600}}>{listening?"Listening… tap to stop":"Tap to speak a recipe"}</div>
          </div>
          {transcript&&<div style={{...inp,minHeight:60,marginBottom:12,lineHeight:1.65,padding:"10px 13px"}}>{transcript}</div>}
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8}}>{error}</div>}
          {transcript&&!listening&&<button onClick={()=>parseAndSave(transcript)} disabled={loading} style={mossBtn(loading)}>{loading?"Analysing…":"Parse & Save ✦"}</button>}
        </>}

        {tab==="manual"&&<>
          {[["Title *","title","text"],["URL","url","url"],["Source","source","text"]].map(([l,k,t])=>(
            <div key={k} style={{marginBottom:10}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>{l}</label>
              <input type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp}/>
            </div>
          ))}
          <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes…" style={{...inp,minHeight:70,resize:"none",marginBottom:12}}/>
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8}}>{error}</div>}
          <button onClick={()=>{
            if(!form.title.trim()){setError("Title required.");return;}
            onAdd({id:Date.now().toString(),...form,description:"",ingredients:[],steps:[],tags:[],ogImage:"",emoji:"🍽️",servings:4,savedAt:Date.now()});
            onClose();
          }} style={mossBtn(false)}>Save Recipe</button>
        </>}
      </div>
    </div>
  );
}

// ─── RECIPES TAB ──────────────────────────────────────────────────────────────
function RecipesTab({recipes,onAdd,onDelete,sharedPrefill,clearShared}){
  const[search,setSearch]=useState("");
  const[tag,setTag]=useState("");
  const[showAdd,setShowAdd]=useState(!!sharedPrefill);
  const[selected,setSelected]=useState(null);
  useEffect(()=>{ if(sharedPrefill)setShowAdd(true); },[sharedPrefill]);

  const allTags=[...new Set(recipes.flatMap(r=>r.tags||[]))];
  const filtered=recipes.filter(r=>{
    const q=search.toLowerCase();
    const ms=!q||r.title?.toLowerCase().includes(q)||(r.tags||[]).some(t=>t.toLowerCase().includes(q))||r.source?.toLowerCase().includes(q);
    return ms&&(!tag||(r.tags||[]).includes(tag));
  });

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:100}}>
      {/* Search + add */}
      <div style={{padding:"14px 16px 0",display:"flex",gap:10}}>
        <div style={{flex:1,position:"relative"}}>
          <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",opacity:.45,fontSize:15}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipes…"
            style={{...s.input,paddingLeft:34,borderRadius:14}}/>
        </div>
        <button onClick={()=>setShowAdd(true)} style={{...s.btn.moss,padding:"0 16px",borderRadius:14,fontSize:13,flexShrink:0}}>+ Add</button>
      </div>

      {/* Tag filter */}
      {allTags.length>0&&(
        <div style={{display:"flex",gap:6,padding:"10px 16px 0",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          {allTags.map(t=>(
            <button key={t} onClick={()=>setTag(t===tag?"":t)} style={{flexShrink:0,background:t===tag?"var(--forest)":"var(--cream)",color:t===tag?"#fff":"var(--ink)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.04em",transition:"all .15s"}}>{t}</button>
          ))}
          {tag&&<button onClick={()=>setTag("")} style={{flexShrink:0,background:"#FEE2E2",color:"#991B1B",border:"1px solid #FECACA",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕</button>}
        </div>
      )}

      {/* Grid */}
      <div style={{padding:"12px 16px 0"}}>
        {filtered.length===0?(
          <div style={{textAlign:"center",paddingTop:70}}>
            <div style={{fontSize:52,marginBottom:14}}>🫙</div>
            <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:8}}>{recipes.length===0?"Your pantry is empty":"No recipes match"}</div>
            <div style={{fontSize:14,color:"var(--mist)",lineHeight:1.7}}>{recipes.length===0?"Tap + Add to save your first recipe.\nPaste a link, speak it, or type it in.":"Try a different search or filter."}</div>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(158px,1fr))",gap:12}}>
            {filtered.map(r=><RecipeCard key={r.id} recipe={r} onOpen={setSelected} onDelete={onDelete}/>)}
          </div>
        )}
      </div>

      {showAdd&&<AddSheet onAdd={r=>{onAdd(r);setShowAdd(false);clearShared();}} onClose={()=>{setShowAdd(false);clearShared();}} prefill={sharedPrefill}/>}
      <RecipeModal recipe={selected} onClose={()=>setSelected(null)}/>
    </div>
  );
}

// ─── CATEGORIES TAB ───────────────────────────────────────────────────────────
function CategoriesTab({recipes,categories,setCategories}){
  const[showNew,setShowNew]=useState(false);
  const[newName,setNewName]=useState("");
  const[newColor,setNewColor]=useState(CAT_COLORS[0]);
  const[selected,setSelected]=useState(null); // {catId}
  const[addingTo,setAddingTo]=useState(null); // catId
  const[recipeModal,setRecipeModal]=useState(null);

  function createCat(){
    if(!newName.trim())return;
    const cat={id:Date.now().toString(),name:newName.trim(),color:newColor,recipeIds:[]};
    const u=[...categories,cat];setCategories(u);save(KEYS.categories,u);
    setNewName("");setShowNew(false);
  }
  function deleteCat(id){const u=categories.filter(c=>c.id!==id);setCategories(u);save(KEYS.categories,u);if(selected===id)setSelected(null);}
  function addRecipeToCat(catId,recipeId){
    const u=categories.map(c=>c.id===catId?{...c,recipeIds:[...new Set([...(c.recipeIds||[]),recipeId])]}:c);
    setCategories(u);save(KEYS.categories,u);setAddingTo(null);
  }
  function removeFromCat(catId,recipeId){
    const u=categories.map(c=>c.id===catId?{...c,recipeIds:(c.recipeIds||[]).filter(id=>id!==recipeId)}:c);
    setCategories(u);save(KEYS.categories,u);
  }

  const cat=categories.find(c=>c.id===selected);
  const catRecipes=cat?(cat.recipeIds||[]).map(id=>recipes.find(r=>r.id===id)).filter(Boolean):[];
  const notInCat=cat?recipes.filter(r=>!(cat.recipeIds||[]).includes(r.id)):[];

  if(selected&&cat) return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:100}}>
      <div style={{padding:"14px 16px 4px",display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>setSelected(null)} style={{...s.btn.ghost,padding:"7px 12px",fontSize:13,borderRadius:10}}>← Back</button>
        <div style={{width:14,height:14,borderRadius:"50%",background:cat.color,flexShrink:0}}/>
        <span className="serif" style={{fontWeight:600,fontSize:18,color:"var(--forest)"}}>{cat.name}</span>
        <span style={{fontSize:12,color:"var(--mist)",marginLeft:"auto"}}>{catRecipes.length} recipes</span>
      </div>

      <div style={{padding:"10px 16px 0",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(158px,1fr))",gap:12}}>
        {catRecipes.map(r=>(
          <div key={r.id} style={{position:"relative"}}>
            <RecipeCard recipe={r} onOpen={setRecipeModal} onDelete={()=>removeFromCat(cat.id,r.id)} compact/>
          </div>
        ))}
        {catRecipes.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",paddingTop:40,color:"var(--mist)",fontSize:14}}>No recipes yet — tap + to add some</div>}
      </div>

      <div style={{padding:"16px 16px 0"}}>
        <button onClick={()=>setAddingTo(cat.id)} style={{...s.btn.ghost,width:"100%",padding:"12px 0",fontSize:14,borderRadius:14}}>+ Add recipes to {cat.name}</button>
      </div>

      {addingTo&&(
        <div style={{position:"fixed",inset:0,background:"rgba(28,43,28,.55)",zIndex:300,display:"flex",alignItems:"flex-end"}} onClick={()=>setAddingTo(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"28px 28px 0 0",width:"100%",maxHeight:"75vh",overflowY:"auto",padding:"16px 16px 32px",paddingBottom:"calc(32px + env(safe-area-inset-bottom))"}}>
            <div style={{width:36,height:4,background:"var(--sage-lt)",borderRadius:2,margin:"0 auto 14px"}}/>
            <div className="serif" style={{fontWeight:600,fontSize:18,color:"var(--forest)",marginBottom:14}}>Add to {cat.name}</div>
            {notInCat.length===0?<div style={{color:"var(--mist)",fontSize:14,textAlign:"center",paddingTop:20}}>All recipes already added.</div>
            :notInCat.map(r=>(
              <div key={r.id} onClick={()=>addRecipeToCat(cat.id,r.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}}>
                <div style={{width:44,height:44,borderRadius:10,overflow:"hidden",flexShrink:0}}>
                  <Thumb recipe={r} height={44}/>
                </div>
                <div>
                  <div style={{fontWeight:600,fontSize:14,color:"var(--forest)"}}>{r.title}</div>
                  <div style={{fontSize:11,color:"var(--mist)"}}>{(r.tags||[]).slice(0,2).join(", ")}</div>
                </div>
                <div style={{marginLeft:"auto",background:"var(--sage-pale)",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--moss)",fontSize:18,fontWeight:700}}>+</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <RecipeModal recipe={recipeModal} onClose={()=>setRecipeModal(null)}/>
    </div>
  );

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:100}}>
      <div style={{padding:"14px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span className="serif" style={{fontWeight:600,fontSize:18,color:"var(--forest)"}}>Categories</span>
        <button onClick={()=>setShowNew(true)} style={{...s.btn.moss,padding:"7px 14px",fontSize:13,borderRadius:12}}>+ New</button>
      </div>

      <div style={{padding:"12px 16px 0",display:"flex",flexDirection:"column",gap:10}}>
        {categories.length===0&&<div style={{textAlign:"center",paddingTop:60}}>
          <div style={{fontSize:48,marginBottom:12}}>📂</div>
          <div className="serif" style={{fontWeight:600,fontSize:18,color:"var(--forest)",marginBottom:8}}>No categories yet</div>
          <div style={{fontSize:14,color:"var(--mist)"}}>Create categories like "Weeknight Dinners",\n"Batch Cook", or "Keith's Favourites"</div>
        </div>}
        {categories.map(cat=>(
          <div key={cat.id} onClick={()=>setSelected(cat.id)} style={{...s.card,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,transition:"transform .15s, box-shadow .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="var(--shadow-md)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="var(--shadow-sm)";}}>
            <div style={{width:42,height:42,borderRadius:14,background:cat.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,boxShadow:"0 2px 8px rgba(0,0,0,.15)"}}>
              {cat.emoji||"📁"}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15,color:"var(--forest)"}}>{cat.name}</div>
              <div style={{fontSize:12,color:"var(--mist)",marginTop:2}}>{(cat.recipeIds||[]).length} recipe{(cat.recipeIds||[]).length!==1?"s":""}</div>
            </div>
            <span style={{color:"var(--sage-lt)",fontSize:18}}>›</span>
            <button onClick={e=>{e.stopPropagation();deleteCat(cat.id);}} style={{background:"none",border:"none",color:"var(--sage-lt)",fontSize:18,cursor:"pointer",padding:"0 4px"}}>×</button>
          </div>
        ))}
      </div>

      {showNew&&(
        <div style={{position:"fixed",inset:0,background:"rgba(28,43,28,.55)",zIndex:300,display:"flex",alignItems:"flex-end"}} onClick={()=>setShowNew(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"28px 28px 0 0",width:"100%",padding:"16px 18px 24px",paddingBottom:"calc(24px + env(safe-area-inset-bottom))"}}>
            <div style={{width:36,height:4,background:"var(--sage-lt)",borderRadius:2,margin:"0 auto 16px"}}/>
            <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:16}}>New Category</div>
            <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Name</label>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Weeknight Dinners"
              style={{...s.input,marginBottom:14}} autoFocus/>
            <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:8}}>Colour</label>
            <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
              {CAT_COLORS.map(c=>(
                <button key={c} onClick={()=>setNewColor(c)} style={{width:36,height:36,borderRadius:"50%",background:c,border:newColor===c?"3px solid var(--forest)":"3px solid transparent",cursor:"pointer",transition:"border .15s"}}/>
              ))}
            </div>
            <button onClick={createCat} disabled={!newName.trim()} style={{...s.btn.moss,width:"100%",padding:"13px 0",fontSize:15,opacity:newName.trim()?1:.6}}>Create Category</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PLANNER TAB ──────────────────────────────────────────────────────────────
const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MEALS=["Breakfast","Lunch","Dinner"];

function PlannerTab({recipes,planner,setPlanner}){
  const[picking,setPicking]=useState(null); // {day,meal}
  const[search,setSearch]=useState("");
  const[recipeModal,setRecipeModal]=useState(null);

  function assign(day,meal,recipeId){
    const key=`${day}_${meal}`;
    const u={...planner,[key]:recipeId};
    setPlanner(u);save(KEYS.planner,u);setPicking(null);
  }
  function clear(day,meal){
    const key=`${day}_${meal}`;
    const u={...planner};delete u[key];
    setPlanner(u);save(KEYS.planner,u);
  }
  function getRecipe(day,meal){
    const id=planner[`${day}_${meal}`];
    return id?recipes.find(r=>r.id===id):null;
  }

  const searchedRecipes=search?recipes.filter(r=>r.title?.toLowerCase().includes(search.toLowerCase())):recipes;

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:100}}>
      <div style={{padding:"14px 16px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span className="serif" style={{fontWeight:600,fontSize:18,color:"var(--forest)"}}>This Week</span>
        <button onClick={()=>{setPlanner({});save(KEYS.planner,{});}} style={{...s.btn.ghost,padding:"6px 12px",fontSize:12,borderRadius:10,color:"var(--mist)",border:"1px solid var(--parchment)"}}>Clear all</button>
      </div>

      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
        {DAYS.map(day=>(
          <div key={day} style={{...s.card,padding:"12px 14px"}}>
            <div className="serif" style={{fontWeight:600,fontSize:15,color:"var(--forest)",marginBottom:10}}>{day}</div>
            <div style={{display:"flex",gap:8,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:2}}>
              {MEALS.map(meal=>{
                const r=getRecipe(day,meal);
                return(
                  <div key={meal} style={{flexShrink:0,width:110}}>
                    <div style={{fontSize:10,fontWeight:700,color:"var(--mist)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>{meal}</div>
                    {r?(
                      <div onClick={()=>setRecipeModal(r)} style={{borderRadius:10,overflow:"hidden",border:"1px solid var(--sage-lt)",cursor:"pointer",position:"relative"}}>
                        <div style={{height:64,overflow:"hidden"}}><Thumb recipe={r} height={64}/></div>
                        <div style={{padding:"5px 7px",background:"var(--warm-white)"}}>
                          <div style={{fontSize:11,fontWeight:600,color:"var(--forest)",lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{r.title}</div>
                        </div>
                        <button onClick={e=>{e.stopPropagation();clear(day,meal);}} style={{position:"absolute",top:4,right:4,background:"rgba(28,43,28,.5)",border:"none",color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
                      </div>
                    ):(
                      <button onClick={()=>setPicking({day,meal})} style={{width:"100%",height:90,borderRadius:10,border:"1.5px dashed var(--sage-lt)",background:"var(--sage-pale)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,color:"var(--sage)",fontSize:11,fontWeight:600,transition:"all .15s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="var(--sage-lt)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="var(--sage-pale)";}}>
                        <span style={{fontSize:20}}>+</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {picking&&(
        <div style={{position:"fixed",inset:0,background:"rgba(28,43,28,.55)",zIndex:300,display:"flex",alignItems:"flex-end"}} onClick={()=>setPicking(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"28px 28px 0 0",width:"100%",maxHeight:"78vh",display:"flex",flexDirection:"column",paddingBottom:"env(safe-area-inset-bottom)"}}>
            <div style={{padding:"16px 18px 12px",flexShrink:0}}>
              <div style={{width:36,height:4,background:"var(--sage-lt)",borderRadius:2,margin:"0 auto 14px"}}/>
              <div className="serif" style={{fontWeight:600,fontSize:18,color:"var(--forest)",marginBottom:12}}>{picking.meal} · {picking.day}</div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipes…" style={{...s.input,borderRadius:12}}/>
            </div>
            <div style={{overflowY:"auto",padding:"0 16px 16px",flex:1}}>
              {searchedRecipes.map(r=>(
                <div key={r.id} onClick={()=>assign(picking.day,picking.meal,r.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}}>
                  <div style={{width:50,height:50,borderRadius:12,overflow:"hidden",flexShrink:0}}><Thumb recipe={r} height={50}/></div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14,color:"var(--forest)",lineHeight:1.3}}>{r.title}</div>
                    <div style={{display:"flex",gap:4,marginTop:3}}>{(r.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} small/>)}</div>
                  </div>
                </div>
              ))}
              {searchedRecipes.length===0&&<div style={{color:"var(--mist)",fontSize:14,textAlign:"center",paddingTop:24}}>No recipes found.</div>}
            </div>
          </div>
        </div>
      )}
      <RecipeModal recipe={recipeModal} onClose={()=>setRecipeModal(null)}/>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────
function TabBar({tab,setTab,recipeCount}){
  const tabs=[
    {id:"recipes",icon:(a)=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="13" y="3" width="8" height="8" rx="2" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="3" y="13" width="8" height="8" rx="2" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="13" y="13" width="8" height="8" rx="2" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
      </svg>), label:"Recipes"},
    {id:"categories",icon:(a)=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 7h18M3 12h18M3 17h10" stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="19" cy="17" r="3" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
      </svg>), label:"Categories"},
    {id:"planner",icon:(a)=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="17" rx="3" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <path d="M8 2v4M16 2v4M3 9h18" stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="8" cy="14" r="1.5" fill={a?"#fff":"var(--mist)"}/>
        <circle cx="12" cy="14" r="1.5" fill={a?"#fff":"var(--mist)"}/>
        <circle cx="16" cy="14" r="1.5" fill={a?"#fff":"var(--mist)"}/>
      </svg>), label:"Planner"},
  ];
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"var(--warm-white)",borderTop:"1px solid var(--parchment)",display:"flex",paddingBottom:"env(safe-area-inset-bottom)",zIndex:100,boxShadow:"0 -4px 20px rgba(28,43,28,.06)"}}>
      {tabs.map(t=>{
        const active=tab===t.id;
        return(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 0 8px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"all .15s"}}>
            {t.icon(active)}
            <span style={{fontSize:10,fontWeight:700,color:active?"var(--moss)":"var(--mist)",letterSpacing:"0.04em",textTransform:"uppercase"}}>{t.label}</span>
            {active&&<div style={{width:20,height:2.5,background:"var(--moss)",borderRadius:2,marginTop:1}}/>}
          </button>
        );
      })}
    </div>
  );
}

// ─── App header ───────────────────────────────────────────────────────────────
function Header(){
  return(
    <div style={{background:"var(--forest)",paddingTop:"env(safe-area-inset-top)",flexShrink:0}}>
      <div style={{padding:"13px 18px 12px",display:"flex",alignItems:"center",gap:10}}>
        <Logo size={34}/>
        <div>
          <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--cream)",lineHeight:1,letterSpacing:"-0.01em"}}>Fork n Pantry</div>
          <div style={{fontSize:11,color:"var(--sage)",marginTop:1,letterSpacing:"0.05em",textTransform:"uppercase"}}>Your recipe collection</div>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
function AppInner(){
  const[recipes,setRecipes]=useState([]);
  const[categories,setCategories]=useState([]);
  const[planner,setPlanner]=useState({});
  const[tab,setTab]=useState("recipes");
  const[sharedPrefill,setSharedPrefill]=useState("");
  const searchParams=useSearchParams();
  const router=useRouter();

  useEffect(()=>{
    setRecipes(load(KEYS.recipes));
    setCategories(load(KEYS.categories));
    setPlanner(load(KEYS.planner)||{});
    if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
    const shared=searchParams.get("shared");
    if(shared){setSharedPrefill(decodeURIComponent(shared));setTab("recipes");router.replace("/");}
  },[]);

  function addRecipe(r){const u=[r,...recipes];setRecipes(u);save(KEYS.recipes,u);}
  function deleteRecipe(id){const u=recipes.filter(r=>r.id!==id);setRecipes(u);save(KEYS.recipes,u);}

  return(
    <div style={{height:"100dvh",display:"flex",flexDirection:"column",background:"var(--linen)"}}>
      <Header/>
      {tab==="recipes"&&<RecipesTab recipes={recipes} onAdd={addRecipe} onDelete={deleteRecipe} sharedPrefill={sharedPrefill} clearShared={()=>setSharedPrefill("")}/>}
      {tab==="categories"&&<CategoriesTab recipes={recipes} categories={categories} setCategories={setCategories}/>}
      {tab==="planner"&&<PlannerTab recipes={recipes} planner={planner} setPlanner={setPlanner}/>}
      <TabBar tab={tab} setTab={setTab} recipeCount={recipes.length}/>
    </div>
  );
}

export default function App(){return <Suspense><AppInner/></Suspense>;}
