import { CookingPot, Pencil, Plus } from "lucide-react";
import { type MenuItem, money, weightLabel } from "../lib/domain";

import { alphabetical } from "../lib/alphabetical";

export default function MenuCard({item,index,currency,onEdit}:{item:MenuItem;index:number;currency:string;onEdit:()=>void}){
  const variations=alphabetical(item.variations??[],v=>v.name);
  return <article className={"menu-card "+(!item.active?"archived":"")}>
    <div className={"menu-card-art tone-"+index%3}><CookingPot size={34} strokeWidth={1.1}/><span className="category-tag" title={item.category}>{item.category}</span>{!item.active&&<span className="archived-tag">Archived</span>}</div>
    <div className="menu-card-body"><div className="menu-card-title"><h3>{item.name}</h3><button className="icon-button" onClick={onEdit} aria-label={"Edit "+item.name}><Pencil size={15}/></button></div><p>{item.description||"Made with care, ready for your next order."}</p>
      {variations.length?<><div className="menu-variation-count">{variations.length} {variations.length===1?"variation":"sizes / variations"}</div><ul className="menu-variation-list">{variations.slice(0,3).map(v=><li key={v.id}><span>{v.name}{v.packWeightGrams&&<small className="menu-pack-weight">{weightLabel(v.packWeightGrams)} per {v.unit}</small>}</span><span><strong>{money(v.priceCents,currency)}</strong><small>/ {v.unit}</small></span></li>)}</ul>{variations.length>3&&<button className="text-button menu-variation-more" onClick={onEdit}>View all {variations.length} variations</button>}</>:<><div className="menu-card-price"><strong>{money(item.priceCents,currency)}</strong><span>/ {item.unit}</span></div>{item.packWeightGrams&&<p className="menu-pack-weight">{weightLabel(item.packWeightGrams)} per {item.unit}</p>}<button className="text-button add-variations" onClick={onEdit}><Plus size={13}/> Add sizes / variations</button></>}
    </div>
  </article>;
}
