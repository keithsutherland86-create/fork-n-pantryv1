"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEYS = { r:"fnp_r4", c:"fnp_c3", p:"fnp_p3", g:"fnp_gl", s:"fnp_sl" };
const load = k => { try { const v = JSON.parse(localStorage.getItem(k)||"null"); return v || []; } catch { return []; } };
const save = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

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
const TPAL={
  breakfast:["#FEF3C7","#92400E"],lunch:["#D1FAE5","#065F46"],dinner:["#EDE9FE","#4C1D95"],
  dessert:["#FCE7F3","#831843"],snack:["#DCFCE7","#14532D"],vegetarian:["#D1FAE5","#14532D"],
  vegan:["#BBF7D0","#14532D"],chicken:["#FEF3C7","#78350F"],pasta:["#FEE2E2","#7F1D1D"],
  soup:["#D1FAE5","#064E3B"],beef:["#FEE2E2","#7F1D1D"],fish:["#DBEAFE","#1E3A5F"],
  salad:["#DCFCE7","#14532D"],quick:["#EDE9FE","#3B0764"],seafood:["#DBEAFE","#1E3A5F"],
};
const tb=t=>{const k=Object.keys(TPAL).find(k=>(t||"").toLowerCase().includes(k));return k?TPAL[k][0]:"var(--sage-pale)";};
const tf=t=>{const k=Object.keys(TPAL).find(k=>(t||"").toLowerCase().includes(k));return k?TPAL[k][1]:"var(--sage)";};
const CAT_COLORS=["#2D5441","#7C5228","#1E3A5F","#5C1A1A","#1A4A4A","#3B0764","#3A5C0F","#7C5C1A"];
const MEALS=["Breakfast","Lunch","Dinner","Snack"];
const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ─── Tag style ────────────────────────────────────────────────────────────────
const TAG_STYLE={
  background:"var(--sage-pale)",color:"var(--sage)",border:"1px solid var(--mist)",
  borderRadius:100,fontSize:10,fontWeight:600,padding:"2px 9px",
  letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap",
  display:"inline-block",
};

// ─── Aggregate ingredients ────────────────────────────────────────────────────
function parseIngredientText(text){
  const unitAliases={
    grams:"g",gram:"g",g:"g",kg:"kg",kilograms:"kg",kilogram:"kg",
    oz:"oz",ounce:"oz",ounces:"oz",lb:"lb",pound:"lb",pounds:"lb",lbs:"lb",
    ml:"ml",millilitre:"ml",millilitres:"ml",milliliter:"ml",milliliters:"ml",
    l:"L",litre:"L",litres:"L",liter:"L",liters:"L",
    tsp:"tsp",teaspoon:"tsp",teaspoons:"tsp",
    tbsp:"tbsp",tablespoon:"tbsp",tablespoons:"tbsp",
    cup:"cup",cups:"cup","fl oz":"fl oz",
  };
  const m=text.trim().match(/^([⅛¼⅓½⅔¾]|\d+(?:[./]\d+)?(?:\s*[⅛¼⅓½⅔¾])?)\s*([a-zA-Z]+(?:\s+oz)?)?\s+(.+)$/);
  if(!m)return{amount:0,unit:null,name:text.trim()};
  const rawAmt=m[1];
  let amount=0;
  const frMap={"⅛":1/8,"¼":1/4,"⅓":1/3,"½":1/2,"⅔":2/3,"¾":3/4};
  if(frMap[rawAmt])amount=frMap[rawAmt];
  else if(rawAmt.includes("/"))amount=parseFloat(rawAmt.split("/")[0])/parseFloat(rawAmt.split("/")[1]);
  else amount=parseFloat(rawAmt)||0;
  const rawUnit=(m[2]||"").toLowerCase().trim();
  const unit=unitAliases[rawUnit]||null;
  const name=unit?m[3].trim():(m[2]?m[2]+" "+m[3]:m[3]).trim();
  return{amount,unit:unit||null,name};
}

function aggregateIngredients(items){
  const groups=new Map();
  for(const item of items){
    const{amount,unit,name}=parseIngredientText(item.text);
    const key=`${name.toLowerCase()}||${unit||"none"}`;
    if(groups.has(key)){const g=groups.get(key);g.amount+=amount;g.items.push(item);}
    else{groups.set(key,{amount,unit,name,items:[item],recipe:item.recipe});}
  }
  const result=[];
  for(const[,g]of groups){
    let text;
    if(g.amount===0)text=g.name;
    else{const dispAmt=fmtN(g.amount);text=g.unit?`${dispAmt} ${g.unit} ${g.name}`:`${dispAmt} ${g.name}`;}
    const recipes=[...new Set(g.items.map(i=>i.recipe))].join(", ");
    result.push({id:g.items[0].id,text:text.trim(),recipe:recipes,checked:g.items[0].checked});
  }
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Chip({label,sm,onRemove}){
  return(
    <span style={{...TAG_STYLE,background:tb(label),color:tf(label),fontSize:sm?10:11,padding:sm?"2px 8px":"3px 10px",display:"inline-flex",alignItems:"center",gap:4}}>
      {label}{onRemove&&<span onClick={e=>{e.stopPropagation();onRemove();}} style={{cursor:"pointer",opacity:.6,fontSize:12,lineHeight:1}}>×</span>}
    </span>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({size=36}){
  return(
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lgbg3" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2D5441"/>
          <stop offset="100%" stopColor="#1A3028"/>
        </linearGradient>
        <linearGradient id="lgsh3" x1="0" y1="0" x2="0" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity=".2"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="lgjar3" x1="28" y1="24" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C8DDD3" stopOpacity=".95"/>
          <stop offset="100%" stopColor="#7AB89A" stopOpacity=".8"/>
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#lgbg3)"/>
      <rect x="1" y="1" width="46" height="46" rx="12" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1"/>
      <rect width="48" height="22" rx="13" fill="url(#lgsh3)"/>
      {/* Fork */}
      <line x1="10.5" y1="8" x2="10.5" y2="17" stroke="#FAF7F2" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="13.5" y1="8" x2="13.5" y2="17" stroke="#FAF7F2" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="16.5" y1="8" x2="16.5" y2="17" stroke="#FAF7F2" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M10.5 17 Q10.5 22.5 13.5 23.5 Q16.5 22.5 16.5 17" fill="none" stroke="#FAF7F2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="13.5" y1="23.5" x2="13.5" y2="41" stroke="#FAF7F2" strokeWidth="1.7" strokeLinecap="round"/>
      {/* Star */}
      <path d="M23.5 22 L24.2 24.2 L26.5 24.2 L24.7 25.6 L25.4 27.8 L23.5 26.4 L21.6 27.8 L22.3 25.6 L20.5 24.2 L22.8 24.2 Z" fill="#FAF7F2" opacity=".7"/>
      {/* Jar */}
      <rect x="29" y="27" width="11" height="13" rx="3" fill="url(#lgjar3)"/>
      <rect x="28" y="22" width="13" height="6" rx="2.5" fill="#C8DDD3" opacity=".9"/>
      <rect x="31" y="28.5" width="3" height="6.5" rx="1.5" fill="white" opacity=".2"/>
    </svg>
  );
}

// ─── Recipe image ─────────────────────────────────────────────────────────────
function RImg({recipe,style:st={},className=""}){
  const[err,setErr]=useState(false);
  const[loaded,setLoaded]=useState(false);
  useEffect(()=>{setErr(false);setLoaded(false);},[recipe?.ogImage]);
  if(recipe?.ogImage&&!err)return(
    <div style={{position:"relative",overflow:"hidden",...st}} className={className}>
      {!loaded&&<div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 30% 30%,${tb(recipe.tags?.[0])},var(--parchment))`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"min(42px,38%)"}}>{recipe.emoji||"🍽️"}</div>}
      <img src={recipe.ogImage} alt="" onError={()=>setErr(true)} onLoad={()=>setLoaded(true)}
        style={{width:"100%",height:"100%",objectFit:"cover",transition:"opacity .3s",opacity:loaded?1:0,display:"block"}}/>
    </div>
  );
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",background:`radial-gradient(ellipse at 30% 30%,${tb(recipe?.tags?.[0])},var(--parchment) 70%)`,fontSize:"min(42px,38%)",overflow:"hidden",...st}} className={className}>
      {recipe?.emoji||"🍽️"}
    </div>
  );
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────
function Sheet({children,onClose,tall}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(10,20,15,.55)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",zIndex:400,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--white)",borderRadius:"28px 28px 0 0",width:"100%",maxHeight:tall?"92vh":"88vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 48px rgba(0,0,0,0.12)",paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div style={{width:36,height:4,background:"var(--mist)",borderRadius:2,margin:"12px auto 0",flexShrink:0}}/>
        <div style={{overflowY:"auto",flex:1}}>{children}</div>
      </div>
    </div>
  );
}

// ─── Nutrition ring ───────────────────────────────────────────────────────────
function NutritionRing({nutrition,servings,base}){
  if(!nutrition?.calories)return null;
  const scale=servings/(base||4);
  const cal=Math.round((nutrition.calories||0)*scale);
  const pro=Math.round((nutrition.protein||0)*scale);
  const carb=Math.round((nutrition.carbs||0)*scale);
  const fat=Math.round((nutrition.fat||0)*scale);
  const total=(pro*4)+(carb*4)+(fat*9)||1;
  const proP=(pro*4/total)*100,carbP=(carb*4/total)*100,fatP=(fat*9/total)*100;
  const r=42,cx=50,cy=50,circ=2*Math.PI*r;
  const segments=[
    {pct:proP/100,color:"#A78BFA",label:"Protein",val:pro,unit:"g"},
    {pct:carbP/100,color:"#FCD34D",label:"Carbs",val:carb,unit:"g"},
    {pct:fatP/100,color:"#6EE7B7",label:"Fat",val:fat,unit:"g"},
  ];
  let offset=0;
  const arcs=segments.map(seg=>{
    const dash=seg.pct*circ,gap=circ-dash;
    const el=<circle key={seg.label} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="14" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset*circ} strokeLinecap="round" style={{transform:"rotate(-90deg)",transformOrigin:"50% 50%"}}/>;
    offset+=seg.pct;return el;
  });
  return(
    <div style={{background:"var(--sage-pale)",borderRadius:"var(--r-lg)",padding:"16px",border:"1px solid var(--mist)",boxShadow:"var(--sh-xs)",marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--pine)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Nutrition per serving</div>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <div style={{position:"relative",width:100,height:100,flexShrink:0}}>
          <svg width="100" height="100" viewBox="0 0 100 100">{arcs}</svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontFamily:"var(--font-disp)",fontSize:22,fontWeight:600,color:"var(--forest)",lineHeight:1}}>{cal}</span>
            <span style={{fontSize:10,color:"var(--dust)",fontWeight:600}}>cal</span>
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

// ─── Recipe card ──────────────────────────────────────────────────────────────
function RecipeCard({recipe,onOpen,onDelete,onToggleFav}){
  const src=recipe.source||(recipe.url?(()=>{try{return new URL(recipe.url).hostname.replace("www.","");}catch{return"";}})():"");
  return(
    <div onClick={()=>onOpen(recipe)}
      style={{background:"var(--white)",borderRadius:20,boxShadow:"0 2px 12px rgba(0,0,0,0.07),0 1px 2px rgba(0,0,0,0.04)",overflow:"hidden",cursor:"pointer",transition:"transform .2s,box-shadow .2s",marginBottom:14,border:"1px solid rgba(0,0,0,0.04)"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 28px rgba(0,0,0,0.11),0 2px 6px rgba(0,0,0,0.05)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.07),0 1px 2px rgba(0,0,0,0.04)";}}>
      <div style={{height:200,position:"relative"}}>
        <RImg recipe={recipe} style={{width:"100%",height:"100%"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 50%,rgba(10,20,15,.7))"}}/>
        {src&&<div style={{position:"absolute",bottom:10,left:14,fontSize:10,color:"rgba(255,255,255,.8)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>{src}</div>}
        <button onClick={e=>{e.stopPropagation();onDelete(recipe.id);}} style={{position:"absolute",top:10,right:10,background:"rgba(10,20,15,.5)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",borderRadius:"50%",width:30,height:30,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>×</button>
        {onToggleFav&&<button onClick={e=>{e.stopPropagation();onToggleFav(recipe.id);}} style={{position:"absolute",top:10,left:10,background:"rgba(10,20,15,.5)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",borderRadius:"50%",width:30,height:30,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>{recipe.fav?"❤️":"🤍"}</button>}
        {recipe.nutrition?.calories>0&&(
          <div style={{position:"absolute",top:10,left:onToggleFav?48:10,background:"rgba(10,20,15,.55)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.2)",borderRadius:20,padding:"3px 10px",fontSize:11,color:"#fff",fontWeight:700}}>{recipe.nutrition.calories} cal</div>
        )}
      </div>
      <div style={{padding:"14px 16px 14px"}}>
        <div className="serif" style={{fontWeight:500,fontSize:19,color:"var(--ink)",lineHeight:1.25,marginBottom:8}}>{recipe.title||"Untitled"}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          {(recipe.tags||[]).slice(0,3).map(t=><Chip key={t} label={t} sm/>)}
          <div style={{marginLeft:"auto",display:"flex",gap:10,color:"var(--dust)",fontSize:11,fontWeight:500}}>
            {recipe.servings&&<span>{recipe.servings} srv</span>}
            {recipe.prepTime&&<span>{recipe.prepTime}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Compact card ─────────────────────────────────────────────────────────────
function MiniCard({recipe,onOpen,onRemove}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--sage-pale)",cursor:"pointer"}} onClick={()=>onOpen&&onOpen(recipe)}>
      <div style={{width:52,height:52,borderRadius:12,overflow:"hidden",flexShrink:0,boxShadow:"var(--sh-xs)"}}>
        <RImg recipe={recipe} style={{width:"100%",height:"100%"}}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:600,fontSize:14,color:"var(--ink)",lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{recipe.title}</div>
        <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
          {(recipe.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}
        </div>
      </div>
      {onRemove&&<button onClick={e=>{e.stopPropagation();onRemove();}} style={{background:"none",border:"none",color:"var(--mist)",fontSize:20,cursor:"pointer",padding:"0 4px",flexShrink:0,lineHeight:1}}>×</button>}
    </div>
  );
}

// ─── Scaler bar ───────────────────────────────────────────────────────────────
function ScalerBar({servings,setServings,base,unit,setUnit}){
  const scale=servings/base;
  return(
    <div style={{background:"var(--sage-pale)",borderRadius:"var(--r-md)",padding:"12px 14px",marginBottom:16,border:"1px solid var(--mist)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:600,color:"var(--forest)"}}>Servings</span>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setServings(s=>Math.max(1,s-1))} style={{width:30,height:30,borderRadius:"50%",border:"none",background:"linear-gradient(145deg,var(--mist),var(--mint))",color:"var(--forest)",fontSize:17,cursor:"pointer",fontWeight:700,boxShadow:"var(--sh-xs)"}}>-</button>
          <span className="serif" style={{fontSize:20,fontWeight:600,color:"var(--forest)",minWidth:26,textAlign:"center"}}>{servings}</span>
          <button onClick={()=>setServings(s=>s+1)} style={{width:30,height:30,borderRadius:"50%",border:"none",background:"linear-gradient(145deg,var(--mist),var(--mint))",color:"var(--forest)",fontSize:17,cursor:"pointer",fontWeight:700,boxShadow:"var(--sh-xs)"}}>+</button>
        </div>
        {scale!==1&&<span style={{fontSize:11,color:"var(--dust)",background:"var(--white)",borderRadius:6,padding:"2px 7px",border:"1px solid var(--mist)"}}>{scale>1?`×${fmtN(scale)}`:`÷${fmtN(1/scale)}`}</span>}
      </div>
      <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.5)",borderRadius:10,padding:3}}>
        {["original","metric","imperial"].map(u=>(
          <button key={u} onClick={()=>setUnit(u)} style={{flex:1,padding:"6px 0",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,textTransform:"capitalize",background:u===unit?"var(--pine)":"transparent",color:u===unit?"#fff":"var(--dust)",boxShadow:u===unit?"var(--sh-xs)":"none",transition:"all .15s"}}>
            {u==="original"?"Original":u==="metric"?"Metric":"Imperial"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Cook Mode ────────────────────────────────────────────────────────────────
function CookMode({recipe,onClose}){
  const[step,setStep]=useState(0);
  const steps=recipe.steps||[];
  const total=steps.length;
  const wakeLockRef=useRef(null);
  useEffect(()=>{
    (async()=>{try{wakeLockRef.current=await navigator.wakeLock?.request("screen");}catch{}})();
    return()=>{try{wakeLockRef.current?.release();}catch{}};
  },[]);
  if(total===0)return null;
  const pct=Math.round((step/total)*100);
  return(
    <div style={{position:"fixed",inset:0,background:"var(--forest)",zIndex:700,display:"flex",flexDirection:"column",paddingTop:"env(safe-area-inset-top)",paddingBottom:"calc(24px + env(safe-area-inset-bottom))"}}>
      <button onClick={onClose} style={{position:"absolute",top:"calc(env(safe-area-inset-top) + 14px)",right:18,background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",borderRadius:"50%",width:36,height:36,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>×</button>
      <div style={{padding:"18px 60px 14px 20px",flexShrink:0}}>
        <div style={{fontSize:12,color:"rgba(255,255,255,.5)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{recipe.title}</div>
        <div style={{background:"rgba(255,255,255,.15)",borderRadius:4,height:4,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,var(--mint),var(--mist))",borderRadius:4,transition:"width .4s"}}/>
        </div>
        <div style={{marginTop:5,fontSize:11,color:"rgba(255,255,255,.4)"}}>{pct}% complete</div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 28px",textAlign:"center"}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,.45)",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:16}}>Step {step+1} of {total}</div>
        <div className="serif" style={{fontSize:26,fontWeight:500,color:"#FDFCFA",lineHeight:1.6,maxWidth:480}}>{steps[step]}</div>
      </div>
      <div style={{padding:"0 24px",display:"flex",gap:14,flexShrink:0}}>
        <button onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0} style={{flex:1,padding:"15px 0",borderRadius:"var(--r-md)",border:"1.5px solid rgba(255,255,255,.2)",background:"transparent",color:"rgba(255,255,255,.7)",fontSize:15,fontWeight:600,cursor:step===0?"default":"pointer",opacity:step===0?0.35:1,transition:"opacity .15s",fontFamily:"var(--font-ui)"}}>Prev</button>
        {step<total-1
          ?<button onClick={()=>setStep(s=>s+1)} style={{flex:2,padding:"15px 0",borderRadius:"var(--r-md)",border:"none",background:"linear-gradient(160deg,var(--pine),var(--forest))",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 16px rgba(26,48,40,0.4)",fontFamily:"var(--font-ui)"}}>Next Step</button>
          :<button onClick={onClose} style={{flex:2,padding:"15px 0",borderRadius:"var(--r-md)",border:"none",background:"linear-gradient(160deg,var(--pine),var(--forest))",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 16px rgba(26,48,40,0.4)",fontFamily:"var(--font-ui)"}}>Done!</button>
        }
      </div>
    </div>
  );
}

// ─── Timer helpers ────────────────────────────────────────────────────────────
function parseTimeSecs(str){
  if(!str)return 0;
  const s=str.toLowerCase();
  let total=0;
  const h=s.match(/(\d+)\s*h(?:r|our|ours)?/);
  const m=s.match(/(\d+)\s*m(?:in|ins|inute|inutes)?/);
  const sec=s.match(/(\d+)\s*s(?:ec|ecs|econd|econds)?/);
  if(h)total+=parseInt(h[1])*3600;
  if(m)total+=parseInt(m[1])*60;
  if(sec)total+=parseInt(sec[1]);
  if(!h&&!m&&!sec){const n=parseInt(s);if(n)total=n*60;}
  return total;
}
function fmtTime(secs){
  const m=Math.floor(secs/60),s=secs%60;
  return`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({msg,visible}){
  if(!visible)return null;
  return(
    <div style={{position:"fixed",bottom:"calc(80px + env(safe-area-inset-bottom))",left:"50%",transform:"translateX(-50%)",background:"rgba(26,48,40,.95)",color:"#fff",borderRadius:50,padding:"10px 22px",fontSize:13,fontWeight:600,zIndex:9999,boxShadow:"var(--sh-lg)",whiteSpace:"nowrap",pointerEvents:"none",transition:"opacity .3s"}}>
      {msg}
    </div>
  );
}
