import type { ReactNode } from "react";
import { CookingPot } from "lucide-react";
import { type Order, aggregateItems, aggregateWeights, lineLabel, prepKey, unitLabel, weightLabel } from "../lib/domain";
import ItemQuantity from "./item-quantity";

const q=(n:number)=>new Intl.NumberFormat("en-GB",{maximumFractionDigits:3}).format(n);

export default function PreparationTotals({orders,scope,footer}:{orders:Order[];scope?:string;footer?:ReactNode}){
  const included=orders.filter(order=>order.status!=="Cancelled"),items=aggregateItems(included),weights=aggregateWeights(included);
  const units=new Map<string,number>();
  for(const item of items)units.set(item.unit,Math.round(((units.get(item.unit)??0)+item.quantity)*1000)/1000);

  return <aside className="panel prep-summary" aria-label="Preparation totals">
    <div className="panel-heading"><div><span className="section-kicker">KITCHEN CHECKLIST</span><h2>Preparation totals</h2><p>{items.length} packing {items.length===1?"line":"lines"} across {included.length} {included.length===1?"order":"orders"}</p>{scope&&<p className="prep-scope">{scope}</p>}</div><span className="prep-header-icon"><CookingPot size={23}/></span></div>
    {items.length?<>
      <div className="total-item-list">{items.map(item=><div className="total-item" key={prepKey(item)}><div><strong>{lineLabel(item)}</strong><span>{item.orderCount} {item.orderCount===1?"order":"orders"}</span></div><ItemQuantity item={item}/></div>)}</div>
      <div className="unit-breakdown"><h3>Pack / unit counts</h3>{[...units.entries()].map(([unit,n])=><div key={unit}><span>{unitLabel(unit,n)}</span><strong>{q(n)}</strong></div>)}</div>
      {weights.length>0&&<div className="weight-breakdown"><h3>Total weight by dish</h3><p>Includes loose quantities and the contents of packs.</p>{weights.map(row=><div key={row.name}><span>{row.name}</span><strong>{weightLabel(row.grams)}</strong></div>)}</div>}
    </>:<div className="prep-empty"><CookingPot size={32}/><p>{scope?"No quantities to prepare for the matching orders.":"Your combined item quantities will appear here."}</p></div>}
    {footer}
  </aside>;
}
