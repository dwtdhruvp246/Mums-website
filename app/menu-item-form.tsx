"use client";

import { useRef, useState, type FormEvent } from "react";
import { Check, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { type MenuItem, toCents, isWeightUnit } from "../lib/domain";

import { alphabetical } from "../lib/alphabetical";

type DraftVariation={key:number;id?:string;name:string;price:string;unit:string;weight:string};
const UNITS=["portion","tray","dozen","piece","kg","g","box","pack","bag","person"];

export default function MenuForm({item,currency,saving,onCancel,onSave}:{item?:MenuItem;currency:string;saving:boolean;onCancel:()=>void;onSave:(data:Record<string,unknown>)=>Promise<void>}){
  const [hasVariations,setHasVariations]=useState(!!item?.variations?.length);
  const [price,setPrice]=useState(item?(item.priceCents/100).toFixed(2):"");
  const [unit,setUnit]=useState(item?.unit??"portion");
  const [packWeight,setPackWeight]=useState(item?.packWeightGrams?String(item.packWeightGrams):"");
  const [rows,setRows]=useState<DraftVariation[]>(item?.variations?.map((v,key)=>({key,id:v.id,name:v.name,price:(v.priceCents/100).toFixed(2),unit:v.unit,weight:v.packWeightGrams?String(v.packWeightGrams):""}))??[]);
  const nextKey=useRef(rows.length);
  const [error,setError]=useState("");
  function update(key:number,field:"name"|"price"|"unit"|"weight",value:string){setRows(rows.map(row=>row.key===key?{...row,[field]:value,...(field==="unit"&&isWeightUnit(value)?{weight:""}:{})}:row));}
  function toggle(on:boolean){setHasVariations(on);if(on&&!rows.length)setRows([{key:nextKey.current++,name:"Standard",price,unit,weight:packWeight}]);}
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");
    try{const f=new FormData(event.currentTarget),variations=hasVariations?rows.map(v=>({id:v.id,name:v.name,priceCents:toCents(v.price),unit:v.unit,packWeightGrams:v.weight===""?undefined:Number(v.weight)})):[];
      if(hasVariations&&!variations.length)throw new Error("Add at least one variation.");
      void onSave({id:item?.id,name:f.get("name"),category:f.get("category"),description:f.get("description"),active:!f.has("archived"),priceCents:variations[0]?.priceCents??toCents(price),unit:variations[0]?.unit??unit,packWeightGrams:hasVariations?variations[0]?.packWeightGrams:packWeight===""?undefined:Number(packWeight),variations});
    }catch(e){setError(e instanceof Error?e.message:"Check the variation details.");}
  }
  return <form onSubmit={submit}>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="form-grid">
      <label className="field full"><span>Dish or item name *</span><input name="name" required maxLength={160} defaultValue={item?.name} placeholder="e.g. Paneer curry"/></label>
      <label className="field full"><span>Food group *</span><input name="category" list="food-groups" required maxLength={160} defaultValue={item?.category} placeholder="e.g. Mains"/><datalist id="food-groups">{alphabetical(["Snacks","Mains","Sides","Sweets","Meal boxes","Other"]).map(name=><option key={name} value={name}/>)}</datalist></label>
      <div className="variation-toggle full"><label className="toggle-label"><input type="checkbox" checked={hasVariations} onChange={e=>toggle(e.target.checked)}/> Offer sizes / variations</label><p>Give each size, flavour or combination its own price and selling unit.</p></div>
      {!hasVariations&&<><label className="field"><span>Sold per *</span><input required maxLength={30} list="menu-units" value={unit} onChange={e=>{setUnit(e.target.value);if(isWeightUnit(e.target.value))setPackWeight("");}}/></label><label className="field"><span>Price ({currency}) *</span><input type="number" required min="0" max="1000000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0.00"/></label>{!isWeightUnit(unit)&&<label className="field full"><span>Weight per {unit||"unit"} (g) · optional</span><input type="number" aria-label="Weight per unit in grams" min="0.001" max="1000000" step="0.001" value={packWeight} onChange={e=>setPackWeight(e.target.value)} placeholder="e.g. 250"/><small>For a 250g box, enter 250. Quantity on an order will be the number of boxes.</small></label>}</>}
      {hasVariations&&<section className="variation-editor full" aria-label="Menu item variations"><div className="variation-editor-heading"><h3>Sizes & variations</h3><span>{rows.length} / 40</span></div><p className="variation-example">For example: Small tray · mild, Large tray · hot, or 250g gift box. Add the weight below to calculate pack counts and total weight.</p>{rows.map((row,index)=><div className="variation-row" key={row.key}><label className="field variation-name"><span>Variation name *</span><input required aria-label={"Variation "+(index+1)+" name"} maxLength={120} value={row.name} onChange={e=>update(row.key,"name",e.target.value)} placeholder="e.g. Large tray · mild"/></label><label className="field"><span>Price ({currency}) *</span><input required aria-label={"Variation "+(index+1)+" price"} type="number" min="0" max="1000000" step="0.01" value={row.price} onChange={e=>update(row.key,"price",e.target.value)} placeholder="0.00"/></label><label className="field"><span>Sold per *</span><input required aria-label={"Variation "+(index+1)+" unit"} maxLength={30} list="menu-units" value={row.unit} onChange={e=>update(row.key,"unit",e.target.value)}/></label>{!isWeightUnit(row.unit)&&<label className="field variation-weight"><span>Weight per {row.unit||"unit"} (g) · optional</span><input aria-label={"Variation "+(index+1)+" pack weight"} type="number" min="0.001" max="1000000" step="0.001" value={row.weight} onChange={e=>update(row.key,"weight",e.target.value)} placeholder="e.g. 250"/></label>}<button className="icon-button danger-hover" type="button" aria-label={"Remove variation "+(index+1)} disabled={rows.length===1||saving} onClick={()=>setRows(rows.filter(r=>r.key!==row.key))}><Trash2 size={16}/></button></div>)}<button className="button secondary small-button" type="button" disabled={rows.length>=40||saving} onClick={()=>setRows([...rows,{key:nextKey.current++,name:"",price:"",unit:rows.at(-1)?.unit??unit,weight:""}])}><Plus size={15}/> Add variation</button></section>}
      <datalist id="menu-units">{alphabetical(UNITS).map(name=><option key={name} value={name}/>)}</datalist>
      <label className="field full"><span>Description</span><textarea name="description" defaultValue={item?.description} maxLength={3000} rows={3} placeholder="A short description of your dish"/></label>
      {item&&<label className="toggle-label full"><input name="archived" type="checkbox" defaultChecked={!item.active}/> Archive this item</label>}
    </div>
    <p className="form-hint">Menu changes apply to future orders. Saved orders keep their original variation and price.</p>
    <div className="form-actions"><span className="flex-spacer"/><button className="button secondary" type="button" onClick={onCancel} disabled={saving}>Cancel</button><button className="button primary" type="submit" disabled={saving}>{saving?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>} {saving?"Saving…":"Save menu item"}</button></div>
  </form>;
}
