"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// â”€â”€â”€ Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const KEYS = { r:"fnp_r4", c:"fnp_c3", p:"fnp_p3", g:"fnp_g1" };
const load = k => { try { const v = JSON.parse(localStorage.getItem(k)||"null"); return v || []; } catch { return []; } };
const save = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// â”€â”€â”€ Unit conversion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const fr=[[1/8,"â…›"],[1/4,"Â¼"],[1/3,"â…“"],[1/2,"Â½"],[2/3,"â…”"],[3/4,"Â¾"]];
  for(const[v,s]of fr)if(Math.abs(n-v)<0.04)return s;
  const w=Math.floor(n),r=n-w;
  for(const[v,s]of fr)if(Math.abs(r-v)<0.04)return w>0?`${w} ${s}`:s;
  if(n>=10)return Math.round(n).toString();
  return parseFloat(n.toFixed(1)).toString();
}
function fmtIng(ing,sys,scale){const c=convertIng(ing,sys,scale);return`${fmtN(c.amount)}${c.unit?" "+c.unit:""} ${c.name}`.trim();}

// â”€â”€â”€ Tag colours â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TPAL={breakfast:["#FEF9C3","#854D0E"],lunch:["#DCFCE7","#166534"],dinner:["#EDE9FE","#5B21B6"],dessert:["#FCE7F3","#9D174D"],snack:["#D1FAE5","#065F46"],vegetarian:["#DCFCE7","#14532D"],vegan:["#BBF7D0","#14532D"],chicken:["#FEF3C7","#92400E"],pasta:["#FEE2E2","#991B1B"],soup:["#D1FAE5","#065F46"],beef:["#FEE2E2","#991B1B"],fish:["#DBEAFE","#1E40AF"],salad:["#BBFBD0","#14532D"],quick:["#EDE9FE","#4C1D95"],seafood:["#DBEAFE","#1E40AF"]};
const tb=t=>{const k=Object.keys(TPAL).find(k=>(t||"").toLowerCase().includes(k));return k?TPAL[k][0]:"#EBF3EC";};
const tf=t=>{const k=Object.keys(TPAL).find(k=>(t||"").toLowerCase().includes(k));return k?TPAL[k][1]:"#1A2E1E";};
const CAT_COLORS=["#3A5E42","#8C5E2A","#2A5E8C","#5E2A2A","#2A5E5E","#5E2A5E","#4A6E1A","#8C6E1A"];
const MEALS=["Breakfast","Lunch","Dinner","Snack"];
const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Chip({label,sm,onRemove}){
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:4,background:tb(label),color:tf(label),borderRadius:20,fontSize:sm?10:11,padding:sm?"1px 8px":"3px 10px",fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap"}}>
      {label}{onRemove&&<span onClick={e=>{e.stopPropagation();onRemove();}} style={{cursor:"pointer",opacity:.6,fontSize:12,lineHeight:1}}>Ã—</span>}
    </span>
  );
}

function Logo({size=34}){
  return(
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="lgbg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#2C4A32"/><stop offset="100%" stopColor="#1A2E1E"/></linearGradient>
        <linearGradient id="lgsh" x1="0" y1="0" x2="0" y2="26" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="white" stopOpacity=".2"/><stop offset="100%" stopColor="white" stopOpacity="0"/></linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#lgbg)"/>
      <rect width="48" height="26" rx="14" fill="url(#lgsh)"/>
      {[11,15,19,23].map(x=><line key={x} x1={x} y1="9" x2={x} y2="21" stroke="#EDE8DC" strokeWidth="1.9" strokeLinecap="round"/>)}
      <path d="M11 21 Q17 27 17 31 L17 40" stroke="#EDE8DC" strokeWidth="1.9" strokeLinecap="round"/>
      <path d="M29 9 L36 16 L36 27 L29 27 Z" fill="#B2CEB6" opacity=".9"/>
      <line x1="29" y1="9" x2="29" y2="40" stroke="#EDE8DC" strokeWidth="1.9" strokeLinecap="round"/>
      <ellipse cx="24" cy="43.5" rx="4.5" ry="2.5" fill="#72A67A" opacity=".75"/>
    </svg>
  );
}

// â”€â”€â”€ Recipe image â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RImg({recipe,style:st={},className=""}){
  const[err,setErr]=useState(false);
  const[loaded,setLoaded]=useState(false);
  useEffect(()=>{setErr(false);setLoaded(false);},[recipe?.ogImage]);
  if(recipe?.ogImage&&!err) return(
    <div style={{position:"relative",overflow:"hidden",...st}} className={className}>
      {!loaded&&<div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 30% 30%,${tb(recipe.tags?.[0])},var(--parchment))`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"min(42px,38%)"}}>{recipe.emoji||"ðŸ½ï¸"}</div>}
      <img src={recipe.ogImage} alt="" onError={()=>setErr(true)} onLoad={()=>setLoaded(true)}
        style={{width:"100%",height:"100%",objectFit:"cover",transition:"opacity .3s",opacity:loaded?1:0,display:"block"}}/>
    </div>
  );
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",background:`radial-gradient(ellipse at 30% 30%,${tb(recipe?.tags?.[0])},var(--parchment) 70%)`,fontSize:"min(42px,38%)",overflow:"hidden",...st}} className={className}>
      {recipe?.emoji||"ðŸ½ï¸"}
    </div>
  );
}

// â”€â”€â”€ Bottom sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Sheet({children,onClose,tall}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,24,17,.6)",backdropFilter:"blur(5px)",WebkitBackdropFilter:"blur(5px)",zIndex:400,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"24px 24px 0 0",width:"100%",maxHeight:tall?"94vh":"88vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 40px rgba(15,24,17,.2)",paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div style={{width:34,height:4,background:"var(--sage-lt)",borderRadius:2,margin:"12px auto 0",flexShrink:0}}/>
        <div style={{overflowY:"auto",flex:1}}>{children}</div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Nutrition ring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function NutritionRing({nutrition,servings,base}){
  if(!nutrition?.calories)return null;
  const scale=servings/(base||4);
  const cal=Math.round((nutrition.calories||0)*scale);
  const pro=Math.round((nutrition.protein||0)*scale);
  const carb=Math.round((nutrition.carbs||0)*scale);
  const fat=Math.round((nutrition.fat||0)*scale);
  const total=(pro*4)+(carb*4)+(fat*9)||1;
  const proP=(pro*4/total)*100, carbP=(carb*4/total)*100, fatP=(fat*9/total)*100;

  // SVG donut
  const r=42, cx=50, cy=50, circ=2*Math.PI*r;
  const segments=[
    {pct:proP/100,color:"#A78BFA",label:"Protein",val:pro,unit:"g"},
    {pct:carbP/100,color:"#FCD34D",label:"Carbs",val:carb,unit:"g"},
    {pct:fatP/100,color:"#6EE7B7",label:"Fat",val:fat,unit:"g"},
  ];
  let offset=0;
  const arcs=segments.map(seg=>{
    const dash=seg.pct*circ, gap=circ-dash;
    const el=<circle key={seg.label} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="14" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset*circ} strokeLinecap="round" style={{transform:"rotate(-90deg)",transformOrigin:"50% 50%"}}/>;
    offset+=seg.pct; return el;
  });

  return(
    <div style={{background:"var(--cream)",borderRadius:"var(--r-lg)",padding:"16px",border:"1px solid var(--sage-lt)",boxShadow:"var(--sh-sm)",marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Nutrition Â· per serving</div>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <div style={{position:"relative",width:100,height:100,flexShrink:0}}>
          <svg width="100" height="100" viewBox="0 0 100 100">{arcs}</svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontFamily:"Lora,serif",fontSize:22,fontWeight:600,color:"var(--forest)",lineHeight:1}}>{cal}</span>
            <span style={{fontSize:10,color:"var(--mist)",fontWeight:600}}>cal</span>
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
          {segments.map(seg=>(
            <div key={seg.label} style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:seg.color,flexShrink:0}}/>
              <span style={{fontSize:13,color:"var(--ink)",flex:1}}>{seg.label}</span>
              <span style={{fontWeight:700,fontSize:13,color:"var(--forest)"}}>{seg.val}{seg.unit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Recipe card â€” full-width photo style â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RecipeCard({recipe,onOpen,onDelete}){
  const src=recipe.source||(recipe.url?(()=>{try{return new URL(recipe.url).hostname.replace("www.","");}catch{return"";}})():"");
  return(
    <div onClick={()=>onOpen(recipe)} style={{background:"var(--cream)",borderRadius:"var(--r-lg)",border:"1px solid rgba(255,255,255,.85)",boxShadow:"var(--sh-sm)",overflow:"hidden",cursor:"pointer",transition:"transform .2s, box-shadow .2s",marginBottom:12}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="var(--sh-md)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="var(--sh-sm)";}}>
      {/* Full-width photo */}
      <div style={{height:180,position:"relative"}}>
        <RImg recipe={recipe} style={{width:"100%",height:"100%"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 50%,rgba(15,24,17,.65))"}}/>
        {src&&<div style={{position:"absolute",bottom:10,left:12,fontSize:10,color:"rgba(255,255,255,.8)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>{src}</div>}
        <button onClick={e=>{e.stopPropagation();onDelete(recipe.id);}} style={{position:"absolute",top:10,right:10,background:"rgba(15,24,17,.5)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",borderRadius:"50%",width:28,height:28,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>Ã—</button>
        {recipe.nutrition?.calories>0&&(
          <div style={{position:"absolute",top:10,left:10,background:"rgba(15,24,17,.55)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.2)",borderRadius:20,padding:"3px 10px",fontSize:11,color:"#fff",fontWeight:700}}>ðŸ”¥ {recipe.nutrition.calories} cal</div>
        )}
      </div>
      {/* Info row */}
      <div style={{padding:"12px 14px"}}>
        <div className="serif" style={{fontWeight:600,fontSize:17,color:"var(--forest)",lineHeight:1.25,marginBottom:6}}>{recipe.title||"Untitled"}</div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {(recipe.tags||[]).slice(0,3).map(t=><Chip key={t} label={t} sm/>)}
          <div style={{marginLeft:"auto",display:"flex",gap:8,color:"var(--mist)",fontSize:11,fontWeight:500}}>
            {recipe.servings&&<span>ðŸ½ {recipe.servings}</span>}
            {recipe.prepTime&&<span>â± {recipe.prepTime}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Compact card (for planner/categories) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MiniCard({recipe,onOpen,onRemove}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--sage-pale)",cursor:"pointer"}} onClick={()=>onOpen&&onOpen(recipe)}>
      <div style={{width:52,height:52,borderRadius:12,overflow:"hidden",flexShrink:0,boxShadow:"var(--sh-xs)"}}>
        <RImg recipe={recipe} style={{width:"100%",height:"100%"}}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:600,fontSize:14,color:"var(--forest)",lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{recipe.title}</div>
        <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
          {(recipe.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}
        </div>
      </div>
      {onRemove&&<button onClick={e=>{e.stopPropagation();onRemove();}} style={{background:"none",border:"none",color:"var(--sage-lt)",fontSize:20,cursor:"pointer",padding:"0 4px",flexShrink:0,lineHeight:1}}>Ã—</button>}
    </div>
  );
}

// â”€â”€â”€ Scaler bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ScalerBar({servings,setServings,base,unit,setUnit}){
  const scale=servings/base;
  return(
    <div style={{background:"var(--sage-pale)",borderRadius:"var(--r-md)",padding:"12px 14px",marginBottom:16,border:"1px solid var(--sage-lt)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:600,color:"var(--forest)"}}>Servings</span>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setServings(s=>Math.max(1,s-1))} style={{width:30,height:30,borderRadius:"50%",border:"none",background:"linear-gradient(145deg,var(--sage-lt),var(--sage))",color:"var(--forest)",fontSize:17,cursor:"pointer",fontWeight:700,boxShadow:"var(--sh-xs)"}}>âˆ’</button>
          <span className="serif" style={{fontSize:20,fontWeight:600,color:"var(--forest)",minWidth:26,textAlign:"center"}}>{servings}</span>
          <button onClick={()=>setServings(s=>s+1)} style={{width:30,height:30,borderRadius:"50%",border:"none",background:"linear-gradient(145deg,var(--sage-lt),var(--sage))",color:"var(--forest)",fontSize:17,cursor:"pointer",fontWeight:700,boxShadow:"var(--sh-xs)"}}>+</button>
        </div>
        {scale!==1&&<span style={{fontSize:11,color:"var(--mist)",background:"var(--cream)",borderRadius:6,padding:"2px 7px",border:"1px solid var(--sage-lt)"}}>{scale>1?`Ã—${fmtN(scale)}`:`Ã·${fmtN(1/scale)}`}</span>}
      </div>
      <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.5)",borderRadius:10,padding:3}}>
        {["original","metric","imperial"].map(u=>(
          <button key={u} onClick={()=>setUnit(u)} style={{flex:1,padding:"6px 0",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,textTransform:"capitalize",background:u===unit?"var(--moss)":"transparent",color:u===unit?"#fff":"var(--mist)",boxShadow:u===unit?"var(--sh-xs)":"none",transition:"all .15s"}}>
            {u==="original"?"Original":u==="metric"?"Metric ðŸ‡¦ðŸ‡º":"Imperial ðŸ‡ºðŸ‡¸"}
          </button>
        ))}
      </div>
    </div>
  );
}

// â”€â”€â”€ Recipe detail modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€ Edit modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function EditModal({recipe,onSave,onClose}){
  const inp={background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"9px 12px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%"};
  // Convert ingredients to plain strings for editing
  const ingToStr=ing=>typeof ing==="string"?ing:fmtIng(ing,"original",1);
  const[form,setForm]=useState({
    title:recipe.title||"",
    description:recipe.description||"",
    source:recipe.source||"",
    url:recipe.url||"",
    servings:recipe.servings||4,
    prepTime:recipe.prepTime||"",
    cookTime:recipe.cookTime||"",
    tags:(recipe.tags||[]).join(", "),
    notes:recipe.notes||"",
    ingredientsText:(recipe.ingredients||[]).map(ingToStr).join("\n"),
    stepsText:(recipe.steps||[]).join("\n"),
    emoji:recipe.emoji||"ðŸ½ï¸",
    ogImage:recipe.ogImage||"",
  });

  function handleSave(){
    const updated={
      ...recipe,
      ...form,
      servings:parseInt(form.servings)||4,
      tags:form.tags.split(",").map(t=>t.trim().toLowerCase()).filter(Boolean),
      ingredients:form.ingredientsText.split("\n").filter(l=>l.trim()).map(line=>{
        // Try to parse back into structured format
        const m=line.match(/^([â…›Â¼â…“Â½â…”Â¾\d./\s]+)\s+(g|kg|ml|L|tsp|tbsp|cup|oz|lb|fl oz)\s+(.+)$/i);
        if(m) return{amount:parseFloat(m[1])||0,unit:m[2],name:m[3].trim()};
        return{amount:0,unit:null,name:line.trim()};
      }),
      steps:form.stepsText.split("\n").filter(l=>l.trim()),
    };
    onSave(updated);
    onClose();
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,24,17,.65)",backdropFilter:"blur(5px)",WebkitBackdropFilter:"blur(5px)",zIndex:600,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"24px 24px 0 0",width:"100%",maxHeight:"95vh",overflowY:"auto",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -8px 48px rgba(15,24,17,.25)"}}>
        <div style={{width:34,height:4,background:"var(--sage-lt)",borderRadius:2,margin:"12px auto 0"}}/>
        <div style={{padding:"14px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)"}}>Edit Recipe</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} className="btn-ghost" style={{padding:"7px 13px",fontSize:13}}>Cancel</button>
            <button onClick={handleSave} className="btn-primary" style={{padding:"7px 16px",fontSize:13,borderRadius:20}}>Save âœ“</button>
          </div>
        </div>

        <div style={{padding:"0 18px 24px",display:"flex",flexDirection:"column",gap:12}}>
          {/* Title + emoji row */}
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:"0 0 52px"}}>
              <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Icon</label>
              <input value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} style={{...inp,textAlign:"center",fontSize:22,padding:"6px"}}/>
            </div>
            <div style={{flex:1}}>
              <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Title *</label>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={inp}/>
            </div>
          </div>

          {/* Photo URL */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Photo URL</label>
            <input value={form.ogImage} onChange={e=>setForm(f=>({...f,ogImage:e.target.value}))} placeholder="https://â€¦" style={inp}/>
            {form.ogImage&&<img src={form.ogImage} onError={e=>e.target.style.display="none"} style={{marginTop:6,width:"100%",height:120,objectFit:"cover",borderRadius:10}}/>}
          </div>

          {/* Description */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Description</label>
            <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{...inp,minHeight:60,resize:"none"}}/>
          </div>

          {/* Meta row */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[["Servings","servings","number"],["Prep time","prepTime","text"],["Cook time","cookTime","text"]].map(([l,k,t])=>(
              <div key={k}>
                <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>{l}</label>
                <input type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp}/>
              </div>
            ))}
          </div>

          {/* Source + URL */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[["Source","source"],["URL","url"]].map(([l,k])=>(
              <div key={k}>
                <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>{l}</label>
                <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp}/>
              </div>
            ))}
          </div>

          {/* Tags */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Tags (comma separated)</label>
            <input value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} placeholder="chicken, dinner, quick" style={inp}/>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
              {form.tags.split(",").map(t=>t.trim()).filter(Boolean).map(t=><Chip key={t} label={t} sm/>)}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Ingredients (one per line)</label>
            <textarea value={form.ingredientsText} onChange={e=>setForm(f=>({...f,ingredientsText:e.target.value}))}
              placeholder={"2 cup plain flour\n1 tsp salt\n3 large eggs"} style={{...inp,minHeight:140,resize:"vertical",fontFamily:"monospace",fontSize:13,lineHeight:1.7}}/>
          </div>

          {/* Steps */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Method (one step per line)</label>
            <textarea value={form.stepsText} onChange={e=>setForm(f=>({...f,stepsText:e.target.value}))}
              placeholder={"Mix dry ingredients together.\nAdd eggs and butter.\nBake at 180Â°C for 25 mins."} style={{...inp,minHeight:140,resize:"vertical",lineHeight:1.7}}/>
          </div>

          {/* Notes */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Notes</label>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{...inp,minHeight:60,resize:"none"}}/>
          </div>

          <button onClick={handleSave} className="btn-primary" style={{width:"100%",padding:"14px 0",fontSize:15,borderRadius:"var(--r-md)"}}>Save Changes âœ“</button>
        </div>
      </div>
    </div>
  );
}

function RecipeModal({recipe,onClose,onUpdate}){
  const[servings,setServings]=useState(null);
  const[unit,setUnit]=useState("original");
  const[editing,setEditing]=useState(false);
  useEffect(()=>{ if(recipe){setServings(recipe.servings||4);setEditing(false);} },[recipe]);
  if(!recipe||servings===null)return null;
  const base=recipe.servings||4, scale=servings/base;
  const hasStr=recipe.ingredients?.length>0&&typeof recipe.ingredients[0]==="object";

  return(
    <>
    <div style={{position:"fixed",inset:0,background:"rgba(15,24,17,.65)",backdropFilter:"blur(5px)",WebkitBackdropFilter:"blur(5px)",zIndex:500,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"24px 24px 0 0",width:"100%",maxHeight:"95vh",overflowY:"auto",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -8px 48px rgba(15,24,17,.25)"}}>
        {/* Hero */}
        <div style={{height:260,position:"relative",flexShrink:0,borderRadius:"24px 24px 0 0",overflow:"hidden"}}>
          <RImg recipe={recipe} style={{width:"100%",height:"100%"}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 35%,rgba(15,24,17,.78))"}}/>
          <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"20px 20px 18px"}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
              {(recipe.tags||[]).map(t=><Chip key={t} label={t} sm/>)}
            </div>
            <h2 className="serif" style={{fontSize:26,fontWeight:600,color:"#fff",lineHeight:1.2,marginBottom:4,textShadow:"0 2px 8px rgba(0,0,0,.4)"}}>{recipe.title}</h2>
            <div style={{display:"flex",gap:12,fontSize:12,color:"rgba(255,255,255,.75)"}}>
              {recipe.source&&<span>ðŸ“ {recipe.source}</span>}
              {recipe.prepTime&&<span>â± {recipe.prepTime}</span>}
              {recipe.cookTime&&<span>ðŸ”¥ {recipe.cookTime}</span>}
            </div>
          </div>
          {/* Close + Edit buttons */}
          <button onClick={onClose} style={{position:"absolute",top:14,right:14,background:"rgba(15,24,17,.5)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",borderRadius:"50%",width:34,height:34,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>Ã—</button>
          <button onClick={()=>setEditing(true)} style={{position:"absolute",top:14,right:56,background:"rgba(15,24,17,.5)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",borderRadius:20,padding:"7px 13px",fontSize:12,fontWeight:700,cursor:"pointer"}}>âœï¸ Edit</button>
        </div>

        <div style={{padding:"18px 20px 0"}}>
          {recipe.url&&<a href={recipe.url} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:13,color:"var(--moss)",background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"4px 12px",fontWeight:600,textDecoration:"none",marginBottom:14}}>ðŸ”— View original recipe</a>}
          {recipe.description&&<p style={{color:"var(--bark)",fontSize:14,lineHeight:1.75,marginBottom:16,fontStyle:"italic"}}>{recipe.description}</p>}

          <NutritionRing nutrition={recipe.nutrition} servings={servings} base={base}/>
          {hasStr&&<ScalerBar servings={servings} setServings={setServings} base={base} unit={unit} setUnit={setUnit}/>}

          {recipe.ingredients?.length>0&&<>
            <h3 className="serif" style={{fontSize:19,fontWeight:600,color:"var(--forest)",marginBottom:10,paddingBottom:7,borderBottom:"1.5px solid var(--parchment)"}}>Ingredients</h3>
            <ul style={{listStyle:"none",marginBottom:20}}>
              {recipe.ingredients.map((ing,i)=>{
                const line=hasStr?fmtIng(ing,unit,scale):(typeof ing==="string"?ing:ing.name||"");
                return(
                  <li key={i} style={{fontSize:14,color:"var(--ink)",padding:"8px 0",borderBottom:"1px solid var(--sage-pale)",display:"flex",gap:10,alignItems:"baseline"}}>
                    <span style={{color:"var(--sage)",fontSize:9}}>â—†</span>{line}
                  </li>
                );
              })}
            </ul>
          </>}

          {recipe.steps?.length>0&&<>
            <h3 className="serif" style={{fontSize:19,fontWeight:600,color:"var(--forest)",marginBottom:12,paddingBottom:7,borderBottom:"1.5px solid var(--parchment)"}}>Method</h3>
            <ol style={{listStyle:"none",paddingBottom:8}}>
              {recipe.steps.map((step,i)=>(
                <li key={i} style={{fontSize:14,color:"var(--ink)",marginBottom:16,lineHeight:1.75,display:"flex",gap:13,alignItems:"flex-start"}}>
                  <span style={{background:"linear-gradient(145deg,var(--moss),var(--forest))",color:"#fff",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,marginTop:1,boxShadow:"var(--sh-xs)"}}>{i+1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </>}
          {recipe.notes&&<p style={{fontSize:13,color:"var(--mist)",fontStyle:"italic",paddingBottom:10,lineHeight:1.65}}>{recipe.notes}</p>}
        </div>
      </div>
    </div>
    {editing&&<EditModal recipe={recipe} onSave={onUpdate} onClose={()=>setEditing(false)}/>}
    </>
  );
}

// â”€â”€â”€ Add sheet with photo import â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AddSheet({onAdd,onClose,prefill=""}){
  const[tab,setTab]=useState(prefill?"paste":"paste");
  const[input,setInput]=useState(prefill);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const[listening,setListening]=useState(false);
  const[transcript,setTranscript]=useState("");
  const recRef=useRef(null);
  const[form,setForm]=useState({title:"",url:"",source:"",notes:""});
  const fileRef=useRef(null);
  const[imgPreview,setImgPreview]=useState(null);
  useEffect(()=>{ if(prefill)parseAndSave({text:prefill}); },[]);

  async function parseAndSave({text="",imageBase64="",imageMediaType="image/jpeg"}){
    setLoading(true);setError("");
    try{
      const body={input:text,imageBase64,imageMediaType};
      const res=await fetch("/api/parse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data=await res.json();
      if(!data.ok)throw new Error();
      // If image was uploaded, use it as the recipe image
      const ogImage = data.ogImage || (imageBase64 ? `data:${imageMediaType};base64,${imageBase64}` : "");
      onAdd({id:Date.now().toString(),...data.recipe,ogImage,url:text.startsWith("http")?text:"",savedAt:Date.now()});
      onClose();
    }catch{setError("Couldn't parse â€” try manual entry.");}
    finally{setLoading(false);}
  }

  function handleFile(e){
    const file=e.target.files?.[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const dataUrl=ev.target.result;
      const base64=dataUrl.split(",")[1];
      setImgPreview(dataUrl);
      parseAndSave({imageBase64:base64,imageMediaType:file.type||"image/jpeg"});
    };
    reader.readAsDataURL(file);
  }

  function startVoice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setError("Voice not supported in this browser.");return;}
    const r=new SR();r.continuous=true;r.interimResults=true;r.lang="en-AU";
    r.onresult=e=>setTranscript(Array.from(e.results).map(r=>r[0].transcript).join(" "));
    r.onerror=()=>{setListening(false);setError("Mic error â€” check permissions.");};
    r.onend=()=>setListening(false);
    r.start();recRef.current=r;setListening(true);setTranscript("");setError("");
  }

  if(loading) return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,24,17,.65)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"var(--cream)",borderRadius:"var(--r-xl)",padding:"36px 32px",textAlign:"center",boxShadow:"var(--sh-xl)",border:"1px solid rgba(255,255,255,.8)",minWidth:220}}>
        {imgPreview&&<img src={imgPreview} style={{width:80,height:80,objectFit:"cover",borderRadius:12,marginBottom:14}}/>}
        {!imgPreview&&<div style={{fontSize:44,marginBottom:14}}>ðŸŒ¿</div>}
        <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:6}}>Reading recipeâ€¦</div>
        <div style={{fontSize:13,color:"var(--mist)"}}>AI is extracting ingredients &amp; steps</div>
      </div>
    </div>
  );

  const inp={background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"11px 14px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%",boxShadow:"var(--inset)"};
  const tabs=[{id:"paste",icon:"ðŸ“‹",label:"Paste"},{id:"photo",icon:"ðŸ“·",label:"Photo"},{id:"voice",icon:"ðŸŽ™ï¸",label:"Voice"},{id:"manual",icon:"âœï¸",label:"Manual"}];

  return(
    <Sheet onClose={onClose} tall>
      <div style={{padding:"14px 18px 24px"}}>
        <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:16}}>Add to Pantry</div>
        <div style={{display:"flex",gap:4,marginBottom:18,background:"rgba(255,255,255,.5)",borderRadius:14,padding:4,border:"1px solid var(--parchment)"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setError("");}} style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:tab===t.id?"var(--cream)":"transparent",color:tab===t.id?"var(--forest)":"var(--mist)",boxShadow:tab===t.id?"var(--sh-xs)":"none",transition:"all .15s"}}>
              {t.icon}<br/><span style={{fontSize:10}}>{t.label}</span>
            </button>
          ))}
        </div>

        {tab==="paste"&&<>
          <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder={"Paste a recipe URL or textâ€¦\n\nTip: copy a caption from Instagram or TikTok"} style={{...inp,minHeight:110,resize:"none"}}/>
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginTop:6,marginBottom:2}}>{error}</div>}
          <button onClick={()=>parseAndSave({text:input})} disabled={!input.trim()} className="btn-primary" style={{width:"100%",padding:"14px 0",marginTop:10,borderRadius:"var(--r-md)",opacity:input.trim()?1:.6}}>Save with AI âœ¦</button>
          <div style={{marginTop:10,padding:"10px 13px",background:"var(--sage-pale)",borderRadius:12,fontSize:12,color:"var(--forest)",lineHeight:1.65,border:"1px solid var(--sage-lt)"}}>
            ðŸ’¡ <strong>Recipe sites:</strong> paste the URL directly.<br/><strong>Instagram / TikTok:</strong> copy the post caption and paste here.
          </div>
        </>}

        {tab==="photo"&&<>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <button onClick={()=>{ if(fileRef.current){fileRef.current.removeAttribute("capture");fileRef.current.click();} }}
              style={{...inp,border:"2px dashed var(--sage-lt)",borderRadius:"var(--r-lg)",padding:"28px 20px",textAlign:"center",cursor:"pointer",background:"var(--sage-pale)",color:"var(--moss)"}}>
              <div style={{fontSize:36,marginBottom:8}}>ðŸ–¼ï¸</div>
              <div style={{fontWeight:700,fontSize:15}}>Upload a photo</div>
              <div style={{fontSize:13,color:"var(--mist)",marginTop:4}}>Screenshot, photo of recipe card, or any image</div>
            </button>
            <button onClick={()=>{ if(fileRef.current){fileRef.current.setAttribute("capture","environment");fileRef.current.click();} }}
              style={{...inp,border:"2px dashed var(--sage-lt)",borderRadius:"var(--r-lg)",padding:"22px 20px",textAlign:"center",cursor:"pointer",background:"var(--cream)",color:"var(--moss)"}}>
              <div style={{fontSize:32,marginBottom:6}}>ðŸ“¸</div>
              <div style={{fontWeight:700,fontSize:14}}>Take a photo</div>
              <div style={{fontSize:12,color:"var(--mist)",marginTop:3}}>Point camera at a recipe or cookbook page</div>
            </button>
          </div>
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginTop:8}}>{error}</div>}
        </>}

        {tab==="voice"&&<>
          <div style={{textAlign:"center",padding:"20px 0 22px"}}>
            <button onClick={listening?()=>{recRef.current?.stop();setListening(false);}:startVoice}
              style={{width:88,height:88,borderRadius:"50%",border:"none",cursor:"pointer",fontSize:40,display:"inline-flex",alignItems:"center",justifyContent:"center",
                background:listening?"linear-gradient(145deg,#FEE2E2,#FECACA)":"linear-gradient(145deg,var(--sage-pale),var(--sage-lt))",
                boxShadow:listening?"0 0 0 12px rgba(254,202,202,.4),var(--sh-md)":"var(--sh-md)",transition:"all .3s"}}>
              {listening?"â¹":"ðŸŽ™ï¸"}
            </button>
            <div style={{marginTop:12,fontSize:14,color:listening?"var(--moss)":"var(--mist)",fontWeight:600}}>{listening?"Listeningâ€¦ tap to stop":"Tap to speak a recipe"}</div>
          </div>
          {transcript&&<div style={{...inp,minHeight:60,marginBottom:12,lineHeight:1.65}}>{transcript}</div>}
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8}}>{error}</div>}
          {transcript&&!listening&&<button onClick={()=>parseAndSave({text:transcript})} className="btn-primary" style={{width:"100%",padding:"14px 0",borderRadius:"var(--r-md)"}}>Parse & Save âœ¦</button>}
        </>}

        {tab==="manual"&&<>
          {[["Title *","title","text"],["URL","url","url"],["Source","source","text"]].map(([l,k,t])=>(
            <div key={k} style={{marginBottom:10}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>{l}</label>
              <input type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp}/>
            </div>
          ))}
          <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notesâ€¦" style={{...inp,minHeight:70,resize:"none",marginBottom:12}}/>
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8}}>{error}</div>}
          <button onClick={()=>{
            if(!form.title.trim()){setError("Title required.");return;}
            onAdd({id:Date.now().toString(),...form,description:"",ingredients:[],steps:[],tags:[],ogImage:"",emoji:"ðŸ½ï¸",servings:4,savedAt:Date.now()});
            onClose();
          }} className="btn-primary" style={{width:"100%",padding:"14px 0",borderRadius:"var(--r-md)"}}>Save Recipe</button>
        </>}
      </div>
    </Sheet>
  );
}

// â”€â”€â”€ RECIPES TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RecipesTab({recipes,onAdd,onDelete,onUpdate,sharedPrefill,clearShared}){
  const[search,setSearch]=useState("");
  const[tag,setTag]=useState("");
  const[showAdd,setShowAdd]=useState(false);
  const[selected,setSelected]=useState(null);
  const[sort,setSort]=useState("newest"); // newest | az | calories
  useEffect(()=>{ if(sharedPrefill)setShowAdd(true); },[sharedPrefill]);

  const allTags=[...new Set(recipes.flatMap(r=>r.tags||[]))];
  let filtered=recipes.filter(r=>{
    const q=search.toLowerCase();
    return(!q||r.title?.toLowerCase().includes(q)||(r.tags||[]).some(t=>t.toLowerCase().includes(q))||r.source?.toLowerCase().includes(q))&&(!tag||(r.tags||[]).includes(tag));
  });
  if(sort==="az") filtered=[...filtered].sort((a,b)=>(a.title||"").localeCompare(b.title||""));
  if(sort==="calories") filtered=[...filtered].sort((a,b)=>(a.nutrition?.calories||0)-(b.nutrition?.calories||0));

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      {/* Search bar */}
      <div style={{padding:"12px 16px 0",display:"flex",gap:8}}>
        <div style={{flex:1,position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",opacity:.4,fontSize:14,pointerEvents:"none"}}>ðŸ”</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipesâ€¦"
            style={{background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:14,padding:"10px 12px 10px 34px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%",boxShadow:"var(--inset)"}}/>
        </div>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:14,padding:"10px 10px",fontSize:13,outline:"none",color:"var(--ink)",cursor:"pointer",flexShrink:0}}>
          <option value="newest">Newest</option>
          <option value="az">Aâ€“Z</option>
          <option value="calories">Calories</option>
        </select>
      </div>

      {/* Tag pills */}
      {allTags.length>0&&(
        <div style={{display:"flex",gap:6,padding:"10px 16px 0",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          {allTags.map(t=>(
            <button key={t} onClick={()=>setTag(t===tag?"":t)} style={{flexShrink:0,background:t===tag?"var(--forest)":"var(--cream)",color:t===tag?"#fff":"var(--ink)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"4px 13px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.04em",transition:"all .15s",boxShadow:t===tag?"var(--sh-xs)":"none"}}>{t}</button>
          ))}
          {tag&&<button onClick={()=>setTag("")} style={{flexShrink:0,background:"#FEE2E2",color:"#991B1B",border:"1px solid #FECACA",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:700,cursor:"pointer"}}>âœ• Clear</button>}
        </div>
      )}

      {/* List */}
      <div style={{padding:"10px 16px 0"}}>
        {filtered.length===0?(
          <div style={{textAlign:"center",paddingTop:80}}>
            <div style={{fontSize:56,marginBottom:14}}>ðŸ«™</div>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:8}}>{recipes.length===0?"Your pantry is empty":"Nothing matches"}</div>
            <div style={{fontSize:14,color:"var(--mist)",lineHeight:1.8}}>{recipes.length===0?"Tap + Add to save your first recipe.":"Try a different search or tag."}</div>
          </div>
        ):filtered.map(r=><RecipeCard key={r.id} recipe={r} onOpen={setSelected} onDelete={onDelete}/>)}
      </div>

      {/* FAB */}
      <button onClick={()=>setShowAdd(true)} className="btn-primary"
        style={{position:"fixed",bottom:80,right:18,width:54,height:54,borderRadius:"50%",fontSize:26,display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,boxShadow:"var(--sh-lg)"}}>+</button>

      {showAdd&&<AddSheet onAdd={r=>{onAdd(r);setShowAdd(false);clearShared();}} onClose={()=>{setShowAdd(false);clearShared();}} prefill={sharedPrefill}/>}
      <RecipeModal recipe={selected} onClose={()=>setSelected(null)} onUpdate={r=>{onUpdate(r);setSelected(r);}}/>
    </div>
  );
}

// â”€â”€â”€ CATEGORIES TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CategoriesTab({recipes,categories,setCategories,onUpdate}){
  const[showNew,setShowNew]=useState(false);
  const[newName,setNewName]=useState("");
  const[newColor,setNewColor]=useState(CAT_COLORS[0]);
  const[selected,setSelected]=useState(null);
  const[addingTo,setAddingTo]=useState(null);
  const[recipeModal,setRecipeModal]=useState(null);

  function createCat(){if(!newName.trim())return;const u=[...categories,{id:Date.now().toString(),name:newName.trim(),color:newColor,recipeIds:[]}];setCategories(u);save(KEYS.c,u);setNewName("");setShowNew(false);}
  function deleteCat(id){const u=categories.filter(c=>c.id!==id);setCategories(u);save(KEYS.c,u);if(selected===id)setSelected(null);}
  function addToCat(catId,recipeId){const u=categories.map(c=>c.id===catId?{...c,recipeIds:[...new Set([...(c.recipeIds||[]),recipeId])]}:c);setCategories(u);save(KEYS.c,u);setAddingTo(null);}
  function removeFromCat(catId,recipeId){const u=categories.map(c=>c.id===catId?{...c,recipeIds:(c.recipeIds||[]).filter(id=>id!==recipeId)}:c);setCategories(u);save(KEYS.c,u);}

  const cat=categories.find(c=>c.id===selected);
  const catRecipes=cat?(cat.recipeIds||[]).map(id=>recipes.find(r=>r.id===id)).filter(Boolean):[];
  const notInCat=cat?recipes.filter(r=>!(cat.recipeIds||[]).includes(r.id)):[];
  const inp={background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"11px 14px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%"};

  if(selected&&cat) return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      <div style={{padding:"12px 16px 10px",display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>setSelected(null)} className="btn-ghost" style={{padding:"7px 13px",fontSize:13}}>â† Back</button>
        <div style={{width:14,height:14,borderRadius:"50%",background:cat.color,flexShrink:0}}/>
        <span className="serif" style={{fontWeight:600,fontSize:19,color:"var(--forest)"}}>{cat.name}</span>
        <span style={{fontSize:12,color:"var(--mist)",marginLeft:"auto"}}>{catRecipes.length} recipes</span>
      </div>
      <div style={{padding:"4px 16px"}}>
        {catRecipes.map(r=><MiniCard key={r.id} recipe={r} onOpen={setRecipeModal} onRemove={()=>removeFromCat(cat.id,r.id)}/>)}
        {catRecipes.length===0&&<div style={{textAlign:"center",paddingTop:50,color:"var(--mist)",fontSize:14}}>No recipes yet â€” add some below</div>}
      </div>
      <div style={{padding:"12px 16px 0"}}>
        <button onClick={()=>setAddingTo(cat.id)} className="btn-ghost" style={{width:"100%",padding:"13px 0",fontSize:14,borderRadius:"var(--r-md)"}}>+ Add recipes to {cat.name}</button>
      </div>
      {addingTo&&(
        <Sheet onClose={()=>setAddingTo(null)}>
          <div style={{padding:"14px 18px 24px"}}>
            <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:14}}>Add to {cat.name}</div>
            {notInCat.length===0?<div style={{color:"var(--mist)",fontSize:14,textAlign:"center",padding:"20px 0"}}>All recipes already in this category.</div>
            :notInCat.map(r=>(
              <div key={r.id} onClick={()=>addToCat(cat.id,r.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}}>
                <div style={{width:50,height:50,borderRadius:12,overflow:"hidden",flexShrink:0}}><RImg recipe={r} style={{width:"100%",height:"100%"}}/></div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,color:"var(--forest)"}}>{r.title}</div>
                  <div style={{display:"flex",gap:3,marginTop:2}}>{(r.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}</div>
                </div>
                <div style={{background:"var(--sage-pale)",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--moss)",fontSize:18,fontWeight:700}}>+</div>
              </div>
            ))}
          </div>
        </Sheet>
      )}
      <RecipeModal recipe={recipeModal} onClose={()=>setRecipeModal(null)} onUpdate={r=>{if(onUpdate)onUpdate(r);setRecipeModal(r);}}/>
    </div>
  );

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      {/* Mosaic grid */}
      <div style={{padding:"12px 16px 0",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {categories.length===0&&(
          <div style={{gridColumn:"1/-1",textAlign:"center",paddingTop:70}}>
            <div style={{fontSize:52,marginBottom:14}}>ðŸ“‚</div>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:8}}>No categories yet</div>
            <div style={{fontSize:14,color:"var(--mist)",lineHeight:1.75}}>Create collections like<br/>"Weeknight Dinners" or "Batch Cook"</div>
          </div>
        )}
        {categories.map(cat=>{
          const catRecs=(cat.recipeIds||[]).map(id=>recipes.find(r=>r.id===id)).filter(Boolean).slice(0,4);
          return(
            <div key={cat.id} onClick={()=>setSelected(cat.id)} style={{background:"var(--cream)",borderRadius:"var(--r-lg)",border:"1px solid rgba(255,255,255,.85)",boxShadow:"var(--sh-sm)",overflow:"hidden",cursor:"pointer",transition:"transform .18s, box-shadow .18s",position:"relative"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="var(--sh-md)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="var(--sh-sm)";}}>
              {/* 4-photo mosaic */}
              <div style={{height:100,display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",gap:1}}>
                {[0,1,2,3].map(i=>(
                  <div key={i} style={{overflow:"hidden",background:i===0?cat.color:"var(--parchment)"}}>
                    {catRecs[i]?<RImg recipe={catRecs[i]} style={{width:"100%",height:"100%"}}/>:<div style={{width:"100%",height:"100%",background:cat.color,opacity:0.15+i*0.05}}/>}
                  </div>
                ))}
              </div>
              <div style={{padding:"10px 12px 12px",position:"relative"}}>
                <div style={{fontWeight:700,fontSize:14,color:"var(--forest)"}}>{cat.name}</div>
                <div style={{fontSize:11,color:"var(--mist)",marginTop:2}}>{(cat.recipeIds||[]).length} recipe{(cat.recipeIds||[]).length!==1?"s":""}</div>
              </div>
              <button onClick={e=>{e.stopPropagation();deleteCat(cat.id);}} style={{position:"absolute",top:8,right:8,background:"rgba(15,24,17,.45)",border:"none",color:"#fff",borderRadius:"50%",width:22,height:22,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>Ã—</button>
            </div>
          );
        })}
      </div>
      <div style={{padding:"14px 16px 0"}}>
        <button onClick={()=>setShowNew(true)} className="btn-primary" style={{width:"100%",padding:"13px 0",fontSize:14,borderRadius:"var(--r-md)"}}>+ New Category</button>
      </div>
      {showNew&&(
        <Sheet onClose={()=>setShowNew(false)}>
          <div style={{padding:"14px 18px 24px"}}>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:16}}>New Category</div>
            <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Name</label>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Weeknight Dinners" style={{...inp,marginBottom:14}} autoFocus/>
            <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:8}}>Colour</label>
            <div style={{display:"flex",gap:10,marginBottom:22,flexWrap:"wrap"}}>
              {CAT_COLORS.map(c=><button key={c} onClick={()=>setNewColor(c)} style={{width:36,height:36,borderRadius:"50%",background:c,border:newColor===c?"3px solid var(--forest)":"3px solid transparent",cursor:"pointer",boxShadow:newColor===c?"var(--sh-sm)":"none",transition:"all .15s"}}/>)}
            </div>
            <button onClick={createCat} disabled={!newName.trim()} className="btn-primary" style={{width:"100%",padding:"13px 0",fontSize:15,borderRadius:"var(--r-md)",opacity:newName.trim()?1:.6}}>Create Category</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// â”€â”€â”€ PLANNER TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PlannerTab({recipes,planner,setPlanner,onUpdate}){
  const[picking,setPicking]=useState(null);
  const[search,setSearch]=useState("");
  const[recipeModal,setRecipeModal]=useState(null);
  const[showGrocery,setShowGrocery]=useState(false);

  function assign(day,meal,id){const u={...planner,[`${day}_${meal}`]:id};setPlanner(u);save(KEYS.p,u);setPicking(null);}
  function clear(day,meal){const u={...planner};delete u[`${day}_${meal}`];setPlanner(u);save(KEYS.p,u);}
  function get(day,meal){const id=planner[`${day}_${meal}`];return id?recipes.find(r=>r.id===id):null;}

  // Build grocery list from all planned recipes
  function buildGroceryList(){
    const planned=Object.values(planner).map(id=>recipes.find(r=>r.id===id)).filter(Boolean);
    const unique=[...new Map(planned.map(r=>[r.id,r])).values()];
    const items=[];
    for(const r of unique){
      if(r.ingredients?.length>0){
        for(const ing of r.ingredients){
          const line=typeof ing==="string"?ing:fmtIng(ing,"original",1);
          items.push({id:Date.now().toString()+Math.random(),text:line,recipe:r.title,checked:false});
        }
      }
    }
    return items;
  }

  const searched=search?recipes.filter(r=>r.title?.toLowerCase().includes(search.toLowerCase())):recipes;
  const plannedCount=Object.keys(planner).length;

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      <div style={{padding:"12px 16px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)"}}>This Week</span>
        <div style={{display:"flex",gap:8}}>
          {plannedCount>0&&<button onClick={()=>setShowGrocery(true)} className="btn-primary" style={{padding:"7px 13px",fontSize:12,borderRadius:20}}>ðŸ›’ Grocery list</button>}
          <button onClick={()=>{setPlanner({});save(KEYS.p,{});}} className="btn-ghost" style={{padding:"7px 13px",fontSize:12}}>Clear</button>
        </div>
      </div>

      {/* Day list â€” ReciMe style */}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
        {DAYS.map(day=>{
          const dayMeals=MEALS.map(meal=>({meal,recipe:get(day,meal)})).filter(m=>m.recipe||true);
          return(
            <div key={day} style={{background:"var(--cream)",borderRadius:"var(--r-lg)",border:"1px solid rgba(255,255,255,.85)",boxShadow:"var(--sh-xs)",overflow:"hidden"}}>
              <div style={{height:3,background:`linear-gradient(90deg,var(--moss),var(--sage))`}}/>
              <div style={{padding:"11px 14px 4px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span className="serif" style={{fontWeight:600,fontSize:15,color:"var(--forest)"}}>{day}</span>
                <button onClick={()=>setPicking({day,meal:MEALS[0]})} style={{background:"none",border:"none",color:"var(--sage)",fontSize:20,cursor:"pointer",lineHeight:1,padding:"0 2px"}}>+</button>
              </div>
              {MEALS.map(meal=>{
                const r=get(day,meal);
                if(!r) return(
                  <div key={meal} onClick={()=>setPicking({day,meal})} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 14px",cursor:"pointer",borderTop:"1px solid var(--sage-pale)",opacity:.5}}>
                    <div style={{width:36,height:36,borderRadius:8,background:"var(--sage-pale)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>+</div>
                    <div style={{fontSize:12,color:"var(--mist)",fontWeight:500}}>{meal}</div>
                  </div>
                );
                return(
                  <div key={meal} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 14px",borderTop:"1px solid var(--sage-pale)",cursor:"pointer"}} onClick={()=>setRecipeModal(r)}>
                    <div style={{width:44,height:44,borderRadius:10,overflow:"hidden",flexShrink:0,boxShadow:"var(--sh-xs)"}}><RImg recipe={r} style={{width:"100%",height:"100%"}}/></div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13,color:"var(--forest)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.title}</div>
                      <Chip label={meal} sm/>
                    </div>
                    <button onClick={e=>{e.stopPropagation();clear(day,meal);}} style={{background:"none",border:"none",color:"var(--sage-lt)",fontSize:18,cursor:"pointer",flexShrink:0,lineHeight:1}}>Ã—</button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Pick recipe sheet */}
      {picking&&(
        <Sheet onClose={()=>setPicking(null)}>
          <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
            <div style={{padding:"14px 18px 12px",flexShrink:0}}>
              <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:12}}>{picking.meal} Â· {picking.day}</div>
              <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                {MEALS.map(m=><button key={m} onClick={()=>setPicking(p=>({...p,meal:m}))} style={{flexShrink:0,background:picking.meal===m?"var(--forest)":"var(--cream)",color:picking.meal===m?"#fff":"var(--ink)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"4px 13px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase"}}>{m}</button>)}
              </div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipesâ€¦"
                style={{background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%"}}/>
            </div>
            <div style={{overflowY:"auto",padding:"0 16px 20px"}}>
              {searched.map(r=>(
                <div key={r.id} onClick={()=>assign(picking.day,picking.meal,r.id)} style={{display:"flex",alignItems:"center",gap:13,padding:"11px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}}>
                  <div style={{width:52,height:52,borderRadius:13,overflow:"hidden",flexShrink:0,boxShadow:"var(--sh-xs)"}}><RImg recipe={r} style={{width:"100%",height:"100%"}}/></div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14,color:"var(--forest)",lineHeight:1.3}}>{r.title}</div>
                    <div style={{display:"flex",gap:3,marginTop:3}}>{(r.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}</div>
                  </div>
                  <span style={{color:"var(--sage-lt)",fontSize:22}}>â€º</span>
                </div>
              ))}
              {searched.length===0&&<div style={{color:"var(--mist)",fontSize:14,textAlign:"center",paddingTop:30}}>No recipes found.</div>}
            </div>
          </div>
        </Sheet>
      )}

      {/* Grocery list sheet */}
      {showGrocery&&<GrocerySheet items={buildGroceryList()} onClose={()=>setShowGrocery(false)}/>}
      <RecipeModal recipe={recipeModal} onClose={()=>setRecipeModal(null)} onUpdate={r=>{if(onUpdate)onUpdate(r);setRecipeModal(r);}}/>
    </div>
  );
}

// â”€â”€â”€ GROCERY LIST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function GrocerySheet({items:initItems,onClose}){
  const[items,setItems]=useState(initItems);
  const[manualInput,setManualInput]=useState("");

  function toggle(id){setItems(is=>is.map(i=>i.id===id?{...i,checked:!i.checked}:i));}
  function remove(id){setItems(is=>is.filter(i=>i.id!==id));}
  function addManual(){
    if(!manualInput.trim())return;
    setItems(is=>[...is,{id:Date.now().toString(),text:manualInput.trim(),recipe:"Added manually",checked:false}]);
    setManualInput("");
  }

  const unchecked=items.filter(i=>!i.checked);
  const checked=items.filter(i=>i.checked);

  // Group by recipe
  const groups={};
  for(const item of unchecked){
    const g=item.recipe||"Other";
    if(!groups[g])groups[g]=[];
    groups[g].push(item);
  }

  return(
    <Sheet onClose={onClose} tall>
      <div style={{padding:"14px 18px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)"}}>Grocery List</div>
          <span style={{fontSize:12,color:"var(--mist)"}}>{unchecked.length} items left</span>
        </div>
        <div style={{fontSize:13,color:"var(--mist)",marginBottom:14}}>From this week's meal plan</div>

        {/* Add manual item */}
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input value={manualInput} onChange={e=>setManualInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addManual()} placeholder="Add itemâ€¦"
            style={{flex:1,background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:12,padding:"9px 13px",fontSize:14,outline:"none",color:"var(--ink)"}}/>
          <button onClick={addManual} className="btn-primary" style={{padding:"0 16px",borderRadius:12,fontSize:18}}>+</button>
        </div>

        {/* Grouped items */}
        {Object.entries(groups).map(([recipe,its])=>(
          <div key={recipe} style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>{recipe}</div>
            {its.map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--sage-pale)"}}>
                <button onClick={()=>toggle(item.id)} style={{width:22,height:22,borderRadius:"50%",border:"2px solid var(--sage)",background:"none",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                  {item.checked&&<div style={{width:10,height:10,borderRadius:"50%",background:"var(--moss)"}}/>}
                </button>
                <span style={{fontSize:14,color:"var(--ink)",flex:1,lineHeight:1.5}}>{item.text}</span>
                <button onClick={()=>remove(item.id)} style={{background:"none",border:"none",color:"var(--sage-lt)",fontSize:18,cursor:"pointer",lineHeight:1}}>Ã—</button>
              </div>
            ))}
          </div>
        ))}

        {checked.length>0&&(
          <div style={{marginTop:16}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--mist)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>Got it âœ“</div>
            {checked.map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--sage-pale)",opacity:.5}}>
                <button onClick={()=>toggle(item.id)} style={{width:22,height:22,borderRadius:"50%",border:"2px solid var(--sage)",background:"var(--sage)",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:"#fff"}}/>
                </button>
                <span style={{fontSize:14,color:"var(--mist)",flex:1,textDecoration:"line-through"}}>{item.text}</span>
              </div>
            ))}
          </div>
        )}

        {items.length===0&&<div style={{textAlign:"center",paddingTop:40,color:"var(--mist)",fontSize:14}}>No items. Add meals to your planner first.</div>}
      </div>
    </Sheet>
  );
}

// â”€â”€â”€ Tab bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TabBar({tab,setTab}){
  const tabs=[
    {id:"recipes",label:"Recipes",icon:a=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="13" y="3" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="3" y="13" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="13" y="13" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
      </svg>)},
    {id:"categories",label:"Categories",icon:a=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="13" y="3" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="3" y="13" width="18" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
      </svg>)},
    {id:"planner",label:"Planner",icon:a=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 0 7px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"all .15s"}}>
            {t.icon(a)}
            <span style={{fontSize:10,fontWeight:700,color:a?"var(--moss)":"var(--mist)",letterSpacing:"0.04em",textTransform:"uppercase"}}>{t.label}</span>
            {a&&<div style={{width:16,height:2.5,background:"linear-gradient(90deg,var(--moss),var(--sage))",borderRadius:2,marginTop:1}}/>}
          </button>
        );
      })}
    </div>
  );
}

// â”€â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Header({count}){
  return(
    <div style={{background:"linear-gradient(180deg,#243529 0%,#1A2E1E 100%)",paddingTop:"env(safe-area-inset-top)",flexShrink:0,boxShadow:"0 3px 16px rgba(15,24,17,.22)"}}>
      <div style={{padding:"12px 18px 13px",display:"flex",alignItems:"center",gap:11}}>
        <Logo size={36}/>
        <div>
          <div className="serif" style={{fontWeight:600,fontSize:21,color:"#FDFCF8",lineHeight:1,letterSpacing:"-0.01em"}}>Fork n Pantry</div>
          <div style={{fontSize:11,color:"var(--sage)",marginTop:2,letterSpacing:"0.05em",textTransform:"uppercase"}}>{count} recipe{count!==1?"s":""} saved</div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Root â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AppInner(){
  const[recipes,setRecipes]=useState([]);
  const[categories,setCategories]=useState([]);
  const[planner,setPlanner]=useState({});
  const[tab,setTab]=useState("recipes");
  const[sharedPrefill,setSharedPrefill]=useState("");
  const searchParams=useSearchParams();
  const router=useRouter();

  useEffect(()=>{
    setRecipes(load(KEYS.r));
    setCategories(load(KEYS.c));
    const p=localStorage.getItem(KEYS.p);
    try{const parsed=JSON.parse(p||"{}");setPlanner(Array.isArray(parsed)?{}:parsed);}catch{setPlanner({});}
    if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
    const shared=searchParams.get("shared");
    if(shared){setSharedPrefill(decodeURIComponent(shared));setTab("recipes");router.replace("/");}
  },[]);

  function addRecipe(r){const u=[r,...recipes];setRecipes(u);save(KEYS.r,u);}
  function deleteRecipe(id){const u=recipes.filter(r=>r.id!==id);setRecipes(u);save(KEYS.r,u);}
  function updateRecipe(r){const u=recipes.map(x=>x.id===r.id?r:x);setRecipes(u);save(KEYS.r,u);}

  return(
    <div style={{height:"100dvh",display:"flex",flexDirection:"column",background:"var(--linen)"}}>
      <Header count={recipes.length}/>
      {tab==="recipes"&&<RecipesTab recipes={recipes} onAdd={addRecipe} onDelete={deleteRecipe} onUpdate={updateRecipe} sharedPrefill={sharedPrefill} clearShared={()=>setSharedPrefill("")}/>}
      {tab==="categories"&&<CategoriesTab recipes={recipes} categories={categories} setCategories={setCategories} onUpdate={updateRecipe}/>}
      {tab==="planner"&&<PlannerTab recipes={recipes} planner={planner} setPlanner={setPlanner} onUpdate={updateRecipe}/>}
      <TabBar tab={tab} setTab={setTab}/>
    </div>
  );
}

export default function App(){return <Suspense><AppInner/></Suspense>;}

