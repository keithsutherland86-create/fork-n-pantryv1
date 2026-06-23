"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEYS = { recipes:"fnp_r3", categories:"fnp_c2", planner:"fnp_p2" };
const load = k => { try { return JSON.parse(localStorage.getItem(k)||"[]"); } catch { return []; } };
const persist = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ─── Unit conversion ──────────────────────────────────────────────────────────
const TO_G={g:1,kg:1000,oz:28.35,lb:453.59};
const TO_ML={ml:1,L:1000,tsp:4.93,tbsp:14.79,cup:236.59,"fl oz":29.57};
function pickBest(base,prefs,map){let b=prefs[0];for(const u of prefs){if(!map[u])continue;const v=base/map[u];if(v>=0.1&&v<1000){b=u;break;}}return{unit:b,amount:base/map[b]};}
function convertIng(ing,sys,scale){
  const sc=ing.amount*scale;
  if(!ing.unit||sc===0||sys==="original")return{...ing,amount:sc};
  if(TO_G[ing.unit]){const g=sc*TO_G[ing.unit];const{unit,amount}=pickBest(g,sys==="metric"?["g","kg"]:["oz","lb"],TO_G);return{...ing,amount,unit};}
  if(TO_ML[ing.unit]){const ml=sc*TO_ML[ing.unit];const{unit,amount}=pickBest(ml,sys==="metric"?["ml","L","tsp","tbsp"]:["fl oz","cup","tsp","tbsp"],TO_ML);return{...ing,amount,unit};}
  return{...ing,amount:sc};
}
function fmtN(n){
  if(!n||n===0)return"";
  const fr=[[1/8,"⅛"],[1/4,"¼"],[1/3,"⅓"],[1/2,"½"],[2/3,"⅔"],[3/4,"¾"]];
  for(const[v,s]of fr)if(Math.abs(n-v)<0.04)return s;
  const w=Math.floor(n),r=n-w;
  for(const[v,s]of fr)if(Math.abs(r-v)<0.04)return w>0?`${w} ${s}`:s;
  if(n>=10)return Math.round(n).toString();
  return parseFloat(n.toFixed(1)).toString();
}
function fmtIng(ing,sys,scale){const c=convertIng(ing,sys,scale);return`${fmtN(c.amount)}${c.unit?" "+c.unit:""} ${c.name}`.trim();}

// ─── Tag colours ──────────────────────────────────────────────────────────────
const TPAL={breakfast:["#FEF3C7","#92400E"],lunch:["#DCEFD8","#2D4A2D"],dinner:["#E4DAF0","#4C1D95"],dessert:["#FCE7F3","#831843"],snack:["#D4E8D0","#2D4A2D"],vegetarian:["#D0EDD4","#1B5E20"],vegan:["#C8E6C0","#1B5E20"],chicken:["#FEF9C3","#854D0E"],pasta:["#FCE8D8","#9A3412"],soup:["#E0EDD0","#2D4A1E"],beef:["#F5DDD8","#991B1B"],fish:["#D8EAF5","#1E3A5F"],salad:["#C8F0D0","#1B5E20"],quick:["#EDE9FE","#4C1D95"]};
const tb=t=>{const k=Object.keys(TPAL).find(k=>(t||"").toLowerCase().includes(k));return k?TPAL[k][0]:"#EAF2EB";};
const tf=t=>{const k=Object.keys(TPAL).find(k=>(t||"").toLowerCase().includes(k));return k?TPAL[k][1]:"#1E3023";};
const CAT_COLORS=["#3D6147","#7A4A2A","#3A5F8A","#6B3A2A","#3A6B6B","#6B3A6B","#5A7A23","#8A6023"];

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({label,sm}){return <span style={{background:tb(label),color:tf(label),borderRadius:20,fontSize:sm?10:11,padding:sm?"1px 7px":"3px 10px",fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap",boxShadow:"inset 0 1px 0 rgba(255,255,255,.5)"}}>{label}</span>;}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({size=34}){
  return(
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{filter:"drop-shadow(0 2px 4px rgba(0,0,0,.3))"}}>
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#273D2C"/>
          <stop offset="100%" stopColor="#1A2E1E"/>
        </linearGradient>
        <linearGradient id="shine" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity=".18"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#bg)"/>
      <rect width="48" height="24" rx="13" fill="url(#shine)"/>
      <rect x="1" y="1" width="46" height="23" rx="12" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1"/>
      {[12,16,20,24].map(x=><line key={x} x1={x} y1="9" x2={x} y2="21" stroke="#EDE8DC" strokeWidth="2" strokeLinecap="round"/>)}
      <path d="M12 21 Q18 27 18 30 L18 40" stroke="#EDE8DC" strokeWidth="2" strokeLinecap="round"/>
      <path d="M30 9 L37 16 L37 28 L30 28 Z" fill="#B8D4BA" opacity=".9"/>
      <line x1="30" y1="9" x2="30" y2="40" stroke="#EDE8DC" strokeWidth="2" strokeLinecap="round"/>
      <ellipse cx="24" cy="43" rx="4" ry="2.5" fill="#7FA882" opacity=".8"/>
    </svg>
  );
}

// ─── Image with fallback ──────────────────────────────────────────────────────
function RecipeImage({recipe,style:st={}}){
  const[err,setErr]=useState(false);
  const[loaded,setLoaded]=useState(false);
  const src = recipe.ogImage;

  if(src&&!err) return(
    <div style={{position:"relative",width:"100%",height:"100%",...st}}>
      {!loaded&&<div style={{position:"absolute",inset:0,background:`linear-gradient(145deg,${tb(recipe.tags?.[0])},var(--parchment))`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40}}>{recipe.emoji||"🍽️"}</div>}
      <img src={src} alt={recipe.title||""} onError={()=>setErr(true)} onLoad={()=>setLoaded(true)}
        style={{width:"100%",height:"100%",objectFit:"cover",transition:"opacity .3s",opacity:loaded?1:0}}/>
    </div>
  );

  const bg1=tb(recipe.tags?.[0])||"#EAF2EB";
  return(
    <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
      background:`radial-gradient(ellipse at 30% 30%, ${bg1}, var(--parchment) 70%)`,fontSize:"min(44px, 40%)",...st}}>
      {recipe.emoji||"🍽️"}
    </div>
  );
}

// ─── Recipe card — 3D premium ─────────────────────────────────────────────────
function RecipeCard({recipe,onOpen,onDelete,compact}){
  const[hov,setHov]=useState(false);
  const src=recipe.source||(recipe.url?(()=>{try{return new URL(recipe.url).hostname.replace("www.","");}catch{return"";}})():"");
  const h=compact?108:148;
  return(
    <div
      onClick={()=>onOpen(recipe)}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      style={{
        background:"var(--cream)",
        borderRadius:"var(--r-lg)",
        border:"1px solid rgba(255,255,255,.9)",
        boxShadow:hov?"var(--shadow-lg)":"var(--shadow-sm)",
        overflow:"hidden",cursor:"pointer",display:"flex",flexDirection:"column",
        transform:hov?"translateY(-4px) scale(1.01)":"translateY(0) scale(1)",
        transition:"transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease",
        position:"relative",
      }}>
      {/* Top sheen */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:"50%",background:"linear-gradient(180deg,rgba(255,255,255,.5) 0%,transparent 100%)",zIndex:2,pointerEvents:"none",borderRadius:"var(--r-lg) var(--r-lg) 0 0"}}/>

      {/* Image */}
      <div style={{height:h,overflow:"hidden",position:"relative",flexShrink:0}}>
        <RecipeImage recipe={recipe}/>
        {/* Gradient overlay */}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 45%,rgba(20,35,22,.7))"}}/>
        {src&&<div style={{position:"absolute",bottom:8,left:10,fontSize:9,color:"rgba(255,255,255,.8)",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>{src}</div>}
        <button
          onClick={e=>{e.stopPropagation();onDelete(recipe.id);}}
          style={{position:"absolute",top:8,right:8,background:"rgba(20,35,22,.5)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",borderRadius:"50%",width:24,height:24,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3}}>×</button>
      </div>

      {/* Content */}
      <div style={{padding:"11px 12px 12px",flex:1,display:"flex",flexDirection:"column",gap:5,position:"relative",zIndex:1}}>
        <div className="serif" style={{fontWeight:600,fontSize:compact?13.5:15.5,color:"var(--forest)",lineHeight:1.25,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{recipe.title||"Untitled"}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:"auto"}}>
          {(recipe.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}
        </div>
        {(recipe.servings||recipe.prepTime)&&(
          <div style={{fontSize:11,color:"var(--mist)",display:"flex",gap:8,marginTop:1}}>
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
    <div style={{background:"var(--sage-pale)",borderRadius:"var(--r-md)",padding:"13px 15px",marginBottom:16,border:"1px solid var(--sage-lt)",boxShadow:"var(--inset-sm)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:11}}>
        <span style={{fontSize:13,fontWeight:700,color:"var(--forest)"}}>Servings</span>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {[["−",()=>setServings(s=>Math.max(1,s-1))],["+",()=>setServings(s=>s+1)]].map(([lbl,fn],i)=>(
            <button key={i} onClick={fn} style={{width:32,height:32,borderRadius:"50%",border:"none",background:"linear-gradient(145deg,var(--sage-lt),var(--sage))",color:"var(--forest)",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,boxShadow:"0 2px 6px rgba(61,97,71,.25), inset 0 1px 0 rgba(255,255,255,.4)"}}>{lbl}</button>
          ))}
        </div>
        <span className="serif" style={{fontSize:22,fontWeight:600,color:"var(--forest)",minWidth:30,textAlign:"center"}}>{servings}</span>
        {scale!==1&&<span style={{fontSize:11,color:"var(--mist)",background:"var(--cream)",border:"1px solid var(--sage-lt)",borderRadius:6,padding:"2px 7px"}}>{scale>1?`×${fmtN(scale)}`:`÷${fmtN(1/scale)}`}</span>}
      </div>
      <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.5)",borderRadius:10,padding:3}}>
        {["original","metric","imperial"].map(u=>(
          <button key={u} onClick={()=>setUnit(u)} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,textTransform:"capitalize",background:unit===u?"var(--moss)":"transparent",color:unit===u?"#fff":"var(--mist)",boxShadow:unit===u?"0 2px 6px rgba(61,97,71,.3), inset 0 1px 0 rgba(255,255,255,.2)":"none",transition:"all .18s"}}>
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
  const[imgLoaded,setImgLoaded]=useState(false);
  useEffect(()=>{ if(recipe){setServings(recipe.servings||4);setImgErr(false);setImgLoaded(false);} },[recipe]);
  if(!recipe||servings===null)return null;
  const base=recipe.servings||4, scale=servings/base;
  const hasStr=recipe.ingredients?.length>0&&typeof recipe.ingredients[0]==="object";

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,28,18,.65)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",zIndex:300,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"28px 28px 0 0",width:"100%",maxHeight:"94vh",overflowY:"auto",paddingBottom:"calc(28px + env(safe-area-inset-bottom))",boxShadow:"0 -8px 48px rgba(15,28,18,.25)"}}>

        {/* Hero */}
        <div style={{height:240,position:"relative",flexShrink:0,borderRadius:"28px 28px 0 0",overflow:"hidden"}}>
          <RecipeImage recipe={recipe}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 30%,rgba(15,28,18,.75))"}}/>
          <div style={{position:"absolute",bottom:20,left:20,right:52}}>
            <h2 className="serif" style={{fontSize:26,fontWeight:600,color:"#fff",lineHeight:1.2,textShadow:"0 2px 8px rgba(0,0,0,.4)"}}>{recipe.title}</h2>
            {recipe.source&&<div style={{fontSize:12,color:"rgba(255,255,255,.75)",marginTop:4,fontWeight:500}}>📍 {recipe.source}</div>}
          </div>
          <button onClick={onClose} style={{position:"absolute",top:14,right:14,background:"rgba(15,28,18,.5)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",borderRadius:"50%",width:34,height:34,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>×</button>
        </div>

        <div style={{padding:"18px 20px 0"}}>
          {/* Meta row */}
          <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14,alignItems:"center"}}>
            {recipe.prepTime&&<span style={{fontSize:12,color:"var(--mist)",background:"var(--cream)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"3px 10px",fontWeight:600}}>⏱ {recipe.prepTime}</span>}
            {recipe.cookTime&&<span style={{fontSize:12,color:"var(--mist)",background:"var(--cream)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"3px 10px",fontWeight:600}}>🔥 {recipe.cookTime}</span>}
            {recipe.url&&<a href={recipe.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:"var(--moss)",background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"3px 10px",fontWeight:600,textDecoration:"none"}}>🔗 Original</a>}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:16}}>{(recipe.tags||[]).map(t=><Chip key={t} label={t}/>)}</div>
          {recipe.description&&<p style={{color:"var(--bark)",fontSize:14,lineHeight:1.75,marginBottom:16,fontStyle:"italic"}}>{recipe.description}</p>}

          {hasStr&&<ScalerBar servings={servings} setServings={setServings} base={base} unit={unit} setUnit={setUnit}/>}

          {recipe.ingredients?.length>0&&<>
            <h3 className="serif" style={{fontSize:20,fontWeight:600,color:"var(--forest)",marginBottom:10,paddingBottom:8,borderBottom:"1.5px solid var(--parchment)"}}>Ingredients</h3>
            <ul style={{listStyle:"none",marginBottom:20}}>
              {recipe.ingredients.map((ing,i)=>{
                const line=hasStr?fmtIng(ing,unit,scale):(typeof ing==="string"?ing:ing.name||"");
                return(
                  <li key={i} style={{fontSize:14,color:"var(--ink)",padding:"8px 0",borderBottom:"1px solid var(--sage-pale)",display:"flex",gap:10,alignItems:"baseline"}}>
                    <span style={{color:"var(--sage)",fontSize:9,flexShrink:0,marginTop:2}}>◆</span>{line}
                  </li>
                );
              })}
            </ul>
          </>}

          {recipe.steps?.length>0&&<>
            <h3 className="serif" style={{fontSize:20,fontWeight:600,color:"var(--forest)",marginBottom:12,paddingBottom:8,borderBottom:"1.5px solid var(--parchment)"}}>Method</h3>
            <ol style={{listStyle:"none",paddingBottom:8}}>
              {recipe.steps.map((step,i)=>(
                <li key={i} style={{fontSize:14,color:"var(--ink)",marginBottom:16,lineHeight:1.75,display:"flex",gap:14,alignItems:"flex-start"}}>
                  <span style={{background:"linear-gradient(145deg,#4A7055,#2E5238)",color:"#fff",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,marginTop:1,boxShadow:"0 2px 6px rgba(61,97,71,.3)"}}>{i+1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </>}
          {recipe.notes&&<p style={{fontSize:13,color:"var(--mist)",fontStyle:"italic",paddingBottom:10,lineHeight:1.65}}>{recipe.notes}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Add sheet ────────────────────────────────────────────────────────────────
function Sheet({children,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,28,18,.6)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",zIndex:300,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"28px 28px 0 0",width:"100%",maxHeight:"90vh",overflowY:"auto",paddingBottom:"calc(20px + env(safe-area-inset-bottom))",boxShadow:"0 -8px 48px rgba(15,28,18,.2)"}}>
        <div style={{width:36,height:4,background:"var(--sage-lt)",borderRadius:2,margin:"14px auto 0"}}/>
        {children}
      </div>
    </div>
  );
}

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
    r.onerror=()=>{setListening(false);setError("Mic error.");};
    r.onend=()=>setListening(false);
    r.start();recRef.current=r;setListening(true);setTranscript("");setError("");
  }

  if(loading&&prefill) return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,28,18,.65)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"var(--cream)",borderRadius:"var(--r-xl)",padding:"36px 32px",textAlign:"center",boxShadow:"var(--shadow-xl)",border:"1px solid rgba(255,255,255,.8)"}}>
        <div style={{fontSize:44,marginBottom:14}}>🌿</div>
        <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:6}}>Adding to pantry…</div>
        <div style={{fontSize:13,color:"var(--mist)"}}>AI is reading the page</div>
      </div>
    </div>
  );

  const tabs=[{id:"paste",icon:"📋",label:"Paste"},{id:"voice",icon:"🎙️",label:"Voice"},{id:"manual",icon:"✏️",label:"Manual"}];
  const inp={background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"11px 14px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%",boxShadow:"var(--inset-sm)"};

  return(
    <Sheet onClose={onClose}>
      <div style={{padding:"14px 18px 0"}}>
        <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:16}}>Add to Pantry</div>
        <div style={{display:"flex",gap:4,marginBottom:18,background:"rgba(255,255,255,.5)",borderRadius:14,padding:4,border:"1px solid var(--parchment)"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setError("");}} style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:tab===t.id?"var(--cream)":"transparent",color:tab===t.id?"var(--forest)":"var(--mist)",boxShadow:tab===t.id?"var(--shadow-sm)":"none",transition:"all .18s"}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab==="paste"&&<>
          <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder={"Paste a recipe URL or text…\n\nTip: copy an Instagram or TikTok caption and paste here"} style={{...inp,minHeight:110,resize:"none"}}/>
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginTop:6}}>{error}</div>}
          <button onClick={()=>parseAndSave(input)} disabled={loading||!input.trim()} className="btn-moss" style={{width:"100%",padding:"14px 0",fontSize:15,marginTop:10,borderRadius:"var(--r-md)",opacity:loading||!input.trim()?.7:1}}>{loading?"Analysing…":"Save with AI ✦"}</button>
          <div style={{marginTop:10,padding:"10px 13px",background:"var(--sage-pale)",borderRadius:12,fontSize:12,color:"var(--forest)",lineHeight:1.65,border:"1px solid var(--sage-lt)"}}>
            💡 <strong>Recipe sites:</strong> paste the URL. <strong>Instagram/TikTok:</strong> copy the caption and paste here.
          </div>
        </>}

        {tab==="voice"&&<>
          <div style={{textAlign:"center",padding:"20px 0 22px"}}>
            <button onClick={listening?()=>{recRef.current?.stop();setListening(false);}:startVoice}
              style={{width:90,height:90,borderRadius:"50%",border:"none",cursor:"pointer",fontSize:40,display:"inline-flex",alignItems:"center",justifyContent:"center",
                background:listening?"linear-gradient(145deg,#FEE2E2,#FECACA)":"linear-gradient(145deg,var(--sage-pale),var(--sage-lt))",
                boxShadow:listening?"0 0 0 12px rgba(254,202,202,.4), var(--shadow-md)":"var(--shadow-md)",transition:"all .3s"}}>
              {listening?"⏹":"🎙️"}
            </button>
            <div style={{marginTop:12,fontSize:14,color:listening?"var(--moss)":"var(--mist)",fontWeight:600}}>{listening?"Listening… tap to stop":"Tap to speak a recipe"}</div>
          </div>
          {transcript&&<div style={{...inp,minHeight:60,marginBottom:12,lineHeight:1.65}}>{transcript}</div>}
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8}}>{error}</div>}
          {transcript&&!listening&&<button onClick={()=>parseAndSave(transcript)} disabled={loading} className="btn-moss" style={{width:"100%",padding:"14px 0",fontSize:15,borderRadius:"var(--r-md)"}}>{loading?"Analysing…":"Parse & Save ✦"}</button>}
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
          }} className="btn-moss" style={{width:"100%",padding:"14px 0",fontSize:15,borderRadius:"var(--r-md)"}}>Save Recipe</button>
        </>}
      </div>
    </Sheet>
  );
}

// ─── RECIPES TAB ──────────────────────────────────────────────────────────────
function RecipesTab({recipes,onAdd,onDelete,sharedPrefill,clearShared}){
  const[search,setSearch]=useState("");
  const[tag,setTag]=useState("");
  const[showAdd,setShowAdd]=useState(false);
  const[selected,setSelected]=useState(null);
  useEffect(()=>{ if(sharedPrefill)setShowAdd(true); },[sharedPrefill]);
  const allTags=[...new Set(recipes.flatMap(r=>r.tags||[]))];
  const filtered=recipes.filter(r=>{
    const q=search.toLowerCase();
    return(!q||r.title?.toLowerCase().includes(q)||(r.tags||[]).some(t=>t.toLowerCase().includes(q))||r.source?.toLowerCase().includes(q))&&(!tag||(r.tags||[]).includes(tag));
  });
  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:100}}>
      <div style={{padding:"14px 16px 0",display:"flex",gap:10}}>
        <div style={{flex:1,position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",opacity:.4,fontSize:14,pointerEvents:"none"}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipes…"
            style={{background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:14,padding:"10px 12px 10px 34px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%",boxShadow:"var(--inset-sm)"}}/>
        </div>
        <button onClick={()=>setShowAdd(true)} className="btn-moss" style={{padding:"0 18px",borderRadius:14,fontSize:13,flexShrink:0,height:44}}>+ Add</button>
      </div>
      {allTags.length>0&&(
        <div style={{display:"flex",gap:6,padding:"10px 16px 0",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          {allTags.map(t=>(
            <button key={t} onClick={()=>setTag(t===tag?"":t)} style={{flexShrink:0,background:t===tag?"var(--forest)":"var(--cream)",color:t===tag?"#fff":"var(--ink)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"4px 13px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.04em",transition:"all .18s",boxShadow:t===tag?"var(--shadow-sm)":"none"}}>{t}</button>
          ))}
          {tag&&<button onClick={()=>setTag("")} style={{flexShrink:0,background:"#FEE2E2",color:"#991B1B",border:"1px solid #FECACA",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕</button>}
        </div>
      )}
      <div style={{padding:"12px 16px 0"}}>
        {filtered.length===0?(
          <div style={{textAlign:"center",paddingTop:70}}>
            <div style={{fontSize:54,marginBottom:14}}>🫙</div>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:8}}>{recipes.length===0?"Your pantry is empty":"Nothing matches"}</div>
            <div style={{fontSize:14,color:"var(--mist)",lineHeight:1.8}}>{recipes.length===0?"Tap + Add to save your first recipe.\nPaste a link, speak it, or type it in.":"Try a different search or tag."}</div>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:13}}>
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
  const[selected,setSelected]=useState(null);
  const[addingTo,setAddingTo]=useState(null);
  const[recipeModal,setRecipeModal]=useState(null);

  function createCat(){
    if(!newName.trim())return;
    const u=[...categories,{id:Date.now().toString(),name:newName.trim(),color:newColor,recipeIds:[]}];
    setCategories(u);persist(KEYS.categories,u);setNewName("");setShowNew(false);
  }
  function deleteCat(id){const u=categories.filter(c=>c.id!==id);setCategories(u);persist(KEYS.categories,u);if(selected===id)setSelected(null);}
  function addRecipeToCat(catId,recipeId){const u=categories.map(c=>c.id===catId?{...c,recipeIds:[...new Set([...(c.recipeIds||[]),recipeId])]}:c);setCategories(u);persist(KEYS.categories,u);setAddingTo(null);}
  function removeFromCat(catId,recipeId){const u=categories.map(c=>c.id===catId?{...c,recipeIds:(c.recipeIds||[]).filter(id=>id!==recipeId)}:c);setCategories(u);persist(KEYS.categories,u);}

  const cat=categories.find(c=>c.id===selected);
  const catRecipes=cat?(cat.recipeIds||[]).map(id=>recipes.find(r=>r.id===id)).filter(Boolean):[];
  const notInCat=cat?recipes.filter(r=>!(cat.recipeIds||[]).includes(r.id)):[];
  const inp={background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"11px 14px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%",boxShadow:"var(--inset-sm)"};

  if(selected&&cat) return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:100}}>
      <div style={{padding:"14px 16px 10px",display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>setSelected(null)} className="btn-ghost" style={{padding:"7px 13px",fontSize:13}}>← Back</button>
        <div style={{width:16,height:16,borderRadius:"50%",background:cat.color,boxShadow:"0 2px 4px rgba(0,0,0,.2)",flexShrink:0}}/>
        <span className="serif" style={{fontWeight:600,fontSize:19,color:"var(--forest)"}}>{cat.name}</span>
        <span style={{fontSize:12,color:"var(--mist)",marginLeft:"auto"}}>{catRecipes.length} recipes</span>
      </div>
      <div style={{padding:"4px 16px 0",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:13}}>
        {catRecipes.map(r=><RecipeCard key={r.id} recipe={r} onOpen={setRecipeModal} onDelete={()=>removeFromCat(cat.id,r.id)} compact/>)}
        {catRecipes.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",paddingTop:50,color:"var(--mist)",fontSize:14}}>No recipes yet — add some below</div>}
      </div>
      <div style={{padding:"16px 16px 0"}}>
        <button onClick={()=>setAddingTo(cat.id)} className="btn-ghost" style={{width:"100%",padding:"13px 0",fontSize:14,borderRadius:"var(--r-md)"}}>+ Add recipes to {cat.name}</button>
      </div>
      {addingTo&&(
        <Sheet onClose={()=>setAddingTo(null)}>
          <div style={{padding:"14px 18px 0"}}>
            <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:14}}>Add to {cat.name}</div>
            {notInCat.length===0?<div style={{color:"var(--mist)",fontSize:14,textAlign:"center",paddingTop:20,paddingBottom:20}}>All recipes already in this category.</div>
            :notInCat.map(r=>(
              <div key={r.id} onClick={()=>addRecipeToCat(cat.id,r.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}}>
                <div style={{width:48,height:48,borderRadius:12,overflow:"hidden",flexShrink:0,boxShadow:"var(--shadow-sm)"}}><RecipeImage recipe={r}/></div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,color:"var(--forest)"}}>{r.title}</div>
                  <div style={{display:"flex",gap:3,marginTop:2}}>{(r.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}</div>
                </div>
                <div style={{background:"var(--sage-pale)",borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--moss)",fontSize:20,fontWeight:700,boxShadow:"var(--shadow-sm)"}}>+</div>
              </div>
            ))}
          </div>
        </Sheet>
      )}
      <RecipeModal recipe={recipeModal} onClose={()=>setRecipeModal(null)}/>
    </div>
  );

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:100}}>
      <div style={{padding:"14px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)"}}>Categories</span>
        <button onClick={()=>setShowNew(true)} className="btn-moss" style={{padding:"8px 16px",fontSize:13,borderRadius:12}}>+ New</button>
      </div>
      <div style={{padding:"12px 16px 0",display:"flex",flexDirection:"column",gap:10}}>
        {categories.length===0&&(
          <div style={{textAlign:"center",paddingTop:70}}>
            <div style={{fontSize:52,marginBottom:14}}>📂</div>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:8}}>No categories yet</div>
            <div style={{fontSize:14,color:"var(--mist)",lineHeight:1.75}}>Organise recipes into collections like<br/>"Weeknight Dinners" or "Batch Cook"</div>
          </div>
        )}
        {categories.map(cat=>(
          <div key={cat.id} onClick={()=>setSelected(cat.id)}
            style={{background:"var(--cream)",borderRadius:"var(--r-lg)",border:"1px solid rgba(255,255,255,.9)",boxShadow:"var(--shadow-sm)",padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,transition:"transform .18s, box-shadow .18s",position:"relative",overflow:"hidden"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="var(--shadow-md)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="var(--shadow-sm)";}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:"50%",background:"linear-gradient(rgba(255,255,255,.4),transparent)",pointerEvents:"none"}}/>
            <div style={{width:46,height:46,borderRadius:14,background:`linear-gradient(145deg,${cat.color},${cat.color}99)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0,boxShadow:"0 3px 10px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.2)"}}>📁</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15,color:"var(--forest)"}}>{cat.name}</div>
              <div style={{fontSize:12,color:"var(--mist)",marginTop:2}}>{(cat.recipeIds||[]).length} recipe{(cat.recipeIds||[]).length!==1?"s":""}</div>
            </div>
            <span style={{color:"var(--sage-lt)",fontSize:20}}>›</span>
            <button onClick={e=>{e.stopPropagation();deleteCat(cat.id);}} style={{background:"none",border:"none",color:"var(--sage-lt)",fontSize:20,cursor:"pointer",padding:"0 4px",lineHeight:1}}>×</button>
          </div>
        ))}
      </div>
      {showNew&&(
        <Sheet onClose={()=>setShowNew(false)}>
          <div style={{padding:"14px 18px 0"}}>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:16}}>New Category</div>
            <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Name</label>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Weeknight Dinners"
              style={{...inp,marginBottom:14}} autoFocus/>
            <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:8}}>Colour</label>
            <div style={{display:"flex",gap:10,marginBottom:22,flexWrap:"wrap"}}>
              {CAT_COLORS.map(c=>(
                <button key={c} onClick={()=>setNewColor(c)} style={{width:38,height:38,borderRadius:"50%",background:`linear-gradient(145deg,${c},${c}99)`,border:newColor===c?"3px solid var(--forest)":"3px solid transparent",cursor:"pointer",boxShadow:newColor===c?"var(--shadow-md)":"var(--shadow-xs)",transition:"all .18s"}}/>
              ))}
            </div>
            <button onClick={createCat} disabled={!newName.trim()} className="btn-moss" style={{width:"100%",padding:"14px 0",fontSize:15,borderRadius:"var(--r-md)",opacity:newName.trim()?1:.6}}>Create Category</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ─── PLANNER TAB ──────────────────────────────────────────────────────────────
const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MEALS=["Breakfast","Lunch","Dinner"];

function PlannerTab({recipes,planner,setPlanner}){
  const[picking,setPicking]=useState(null);
  const[search,setSearch]=useState("");
  const[recipeModal,setRecipeModal]=useState(null);

  function assign(day,meal,id){const u={...planner,[`${day}_${meal}`]:id};setPlanner(u);persist(KEYS.planner,u);setPicking(null);}
  function clear(day,meal){const u={...planner};delete u[`${day}_${meal}`];setPlanner(u);persist(KEYS.planner,u);}
  function get(day,meal){const id=planner[`${day}_${meal}`];return id?recipes.find(r=>r.id===id):null;}
  const searched=search?recipes.filter(r=>r.title?.toLowerCase().includes(search.toLowerCase())):recipes;

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:100}}>
      <div style={{padding:"14px 16px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)"}}>This Week</span>
        <button onClick={()=>{setPlanner({});persist(KEYS.planner,{});}} className="btn-ghost" style={{padding:"6px 13px",fontSize:12}}>Clear all</button>
      </div>
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
        {DAYS.map(day=>(
          <div key={day} style={{background:"var(--cream)",borderRadius:"var(--r-lg)",border:"1px solid rgba(255,255,255,.9)",boxShadow:"var(--shadow-sm)",padding:"13px 14px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,var(--moss),var(--sage))`}}/>
            <div className="serif" style={{fontWeight:600,fontSize:16,color:"var(--forest)",marginBottom:10}}>{day}</div>
            <div style={{display:"flex",gap:8,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:2}}>
              {MEALS.map(meal=>{
                const r=get(day,meal);
                return(
                  <div key={meal} style={{flexShrink:0,width:112}}>
                    <div style={{fontSize:9,fontWeight:700,color:"var(--mist)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{meal}</div>
                    {r?(
                      <div onClick={()=>setRecipeModal(r)} style={{borderRadius:12,overflow:"hidden",border:"1px solid rgba(255,255,255,.8)",cursor:"pointer",position:"relative",boxShadow:"var(--shadow-sm)",transition:"transform .18s, box-shadow .18s"}}
                        onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="var(--shadow-md)";}}
                        onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="var(--shadow-sm)";}}>
                        <div style={{height:66,overflow:"hidden"}}><RecipeImage recipe={r}/></div>
                        <div style={{padding:"5px 7px",background:"var(--cream)"}}>
                          <div style={{fontSize:11,fontWeight:600,color:"var(--forest)",lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{r.title}</div>
                        </div>
                        <button onClick={e=>{e.stopPropagation();clear(day,meal);}} style={{position:"absolute",top:4,right:4,background:"rgba(15,28,18,.5)",backdropFilter:"blur(4px)",border:"none",color:"#fff",borderRadius:"50%",width:20,height:20,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                      </div>
                    ):(
                      <button onClick={()=>setPicking({day,meal})}
                        style={{width:"100%",height:96,borderRadius:12,border:"1.5px dashed var(--sage-lt)",background:"var(--sage-pale)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"var(--sage)",transition:"all .18s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="var(--sage-lt)";e.currentTarget.style.borderColor="var(--sage)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="var(--sage-pale)";e.currentTarget.style.borderColor="var(--sage-lt)";}}>
                        <span style={{fontSize:22,color:"var(--sage)"}}>+</span>
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
        <Sheet onClose={()=>setPicking(null)}>
          <div style={{display:"flex",flexDirection:"column",maxHeight:"75vh"}}>
            <div style={{padding:"14px 18px 12px",flexShrink:0}}>
              <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:12}}>{picking.meal} · {picking.day}</div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipes…"
                style={{background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%",boxShadow:"var(--inset-sm)"}}/>
            </div>
            <div style={{overflowY:"auto",padding:"0 16px 20px",flex:1}}>
              {searched.map(r=>(
                <div key={r.id} onClick={()=>assign(picking.day,picking.meal,r.id)}
                  style={{display:"flex",alignItems:"center",gap:13,padding:"11px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}}>
                  <div style={{width:52,height:52,borderRadius:13,overflow:"hidden",flexShrink:0,boxShadow:"var(--shadow-sm)"}}><RecipeImage recipe={r}/></div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14,color:"var(--forest)",lineHeight:1.3}}>{r.title}</div>
                    <div style={{display:"flex",gap:3,marginTop:3}}>{(r.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}</div>
                  </div>
                  <span style={{color:"var(--sage-lt)",fontSize:22}}>›</span>
                </div>
              ))}
              {searched.length===0&&<div style={{color:"var(--mist)",fontSize:14,textAlign:"center",paddingTop:30}}>No recipes found.</div>}
            </div>
          </div>
        </Sheet>
      )}
      <RecipeModal recipe={recipeModal} onClose={()=>setRecipeModal(null)}/>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────
function TabBar({tab,setTab}){
  const tabs=[
    {id:"recipes",label:"Recipes",icon:(a)=>(
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="13" y="3" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="3" y="13" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="13" y="13" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
      </svg>)},
    {id:"categories",label:"Categories",icon:(a)=>(
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <path d="M3 7h18M3 12h18M3 17h10" stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="19" cy="17" r="3" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
      </svg>)},
    {id:"planner",label:"Planner",icon:(a)=>(
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="17" rx="3" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <path d="M8 2v4M16 2v4M3 9h18" stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="8" cy="14" r="1.5" fill={a?"#fff":"var(--mist)"}/>
        <circle cx="12" cy="14" r="1.5" fill={a?"#fff":"var(--mist)"}/>
        <circle cx="16" cy="14" r="1.5" fill={a?"#fff":"var(--mist)"}/>
      </svg>)},
  ];
  return(
    <div className="tab-bar" style={{position:"fixed",bottom:0,left:0,right:0,display:"flex",paddingBottom:"env(safe-area-inset-bottom)",zIndex:100}}>
      {tabs.map(t=>{
        const a=tab===t.id;
        return(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 0 8px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"all .18s"}}>
            {t.icon(a)}
            <span style={{fontSize:10,fontWeight:700,color:a?"var(--moss)":"var(--mist)",letterSpacing:"0.04em",textTransform:"uppercase"}}>{t.label}</span>
            {a&&<div style={{width:18,height:2.5,background:"linear-gradient(90deg,var(--moss),var(--sage))",borderRadius:2,marginTop:1}}/>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({recipeCount}){
  return(
    <div style={{background:"linear-gradient(180deg,var(--forest-2) 0%,var(--forest) 100%)",paddingTop:"env(safe-area-inset-top)",flexShrink:0,boxShadow:"0 4px 20px rgba(15,28,18,.25)"}}>
      <div style={{padding:"13px 18px 13px",display:"flex",alignItems:"center",gap:11}}>
        <Logo size={36}/>
        <div>
          <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--cream)",lineHeight:1,letterSpacing:"-0.01em"}}>Fork n Pantry</div>
          <div style={{fontSize:11,color:"var(--sage)",marginTop:2,letterSpacing:"0.06em",textTransform:"uppercase"}}>{recipeCount} recipe{recipeCount!==1?"s":""} saved</div>
        </div>
        <div style={{marginLeft:"auto",width:8,height:8,borderRadius:"50%",background:"var(--sage)",boxShadow:"0 0 8px var(--sage)",animation:"none",opacity:.8}}/>
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
    const p=load(KEYS.planner);
    setPlanner(Array.isArray(p)?{}:p);
    if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
    const shared=searchParams.get("shared");
    if(shared){setSharedPrefill(decodeURIComponent(shared));setTab("recipes");router.replace("/");}
  },[]);

  function addRecipe(r){const u=[r,...recipes];setRecipes(u);persist(KEYS.recipes,u);}
  function deleteRecipe(id){const u=recipes.filter(r=>r.id!==id);setRecipes(u);persist(KEYS.recipes,u);}

  return(
    <div style={{height:"100dvh",display:"flex",flexDirection:"column",background:"var(--linen)"}}>
      <Header recipeCount={recipes.length}/>
      {tab==="recipes"&&<RecipesTab recipes={recipes} onAdd={addRecipe} onDelete={deleteRecipe} sharedPrefill={sharedPrefill} clearShared={()=>setSharedPrefill("")}/>}
      {tab==="categories"&&<CategoriesTab recipes={recipes} categories={categories} setCategories={setCategories}/>}
      {tab==="planner"&&<PlannerTab recipes={recipes} planner={planner} setPlanner={setPlanner}/>}
      <TabBar tab={tab} setTab={setTab}/>
    </div>
  );
}

export default function App(){return <Suspense><AppInner/></Suspense>;}
