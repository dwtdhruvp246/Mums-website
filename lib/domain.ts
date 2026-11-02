import { z } from "zod";
export const STATUSES = ["New", "Confirmed", "Preparing", "Ready", "Completed", "Cancelled"] as const;
export type Status = typeof STATUSES[number];
export const METHODS = ["Cash", "Bank transfer", "EcoCash", "Card", "Other"] as const;
export const CURRENCIES = ["USD", "ZAR", "ZWG", "GBP", "EUR", "INR"] as const;
export type BusinessSettings = {businessName:string; currency:string; phone:string; address:string};
export type Customer = {id:string; name:string; phone:string; email:string; address:string; notes:string; createdAt:string};
export type Category = {id:string; name:string; description:string; color:"gold"|"rose"|"sage"|"blue"|"lavender"; active:boolean};
export type MenuVariation = {id:string; name:string; priceCents:number; unit:string; packWeightGrams?:number};
export type MenuItem = {id:string; name:string; category:string; priceCents:number; unit:string; packWeightGrams?:number; variations?:MenuVariation[]; description:string; active:boolean; createdAt:string};
export type LineItem = {name:string; quantity:number; unit:string; priceCents:number; menuItemId?:string; variationId?:string; variationName?:string; packWeightGrams?:number};
export type Order = {id:string; orderNumber:string; customerId:string; categoryId?:string; date:string; time:string; fulfilment:"Collection"|"Delivery"; address:string; occasion:string; notes:string; status:Status; items:LineItem[]; discountCents:number; deliveryFeeCents:number; totalCents:number; createdAt:string};
export type Payment = {id:string; orderId:string; amountCents:number; method:string; date:string; note:string; createdAt:string};
export type Workspace = {settings:BusinessSettings; categories:Category[]; customers:Customer[]; menuItems:MenuItem[]; orders:Order[]; payments:Payment[]};
export const MENU_IMPORT_LIMIT=500;
export function menuIdentity(item:Pick<MenuItem,"name"|"category">){return JSON.stringify([item.name.trim().toLowerCase(),item.category.trim().toLowerCase()]);}
export const DEFAULT_SETTINGS:BusinessSettings = {businessName:"My Catering Kitchen",currency:"USD",phone:"",address:""};
export const emptyWorkspace = ():Workspace => ({settings:{...DEFAULT_SETTINGS},categories:[],customers:[],menuItems:[],orders:[],payments:[]});
const short=z.string().trim().max(160),note=z.string().trim().max(3000).default(""),optionalId=z.string().uuid().optional(),cents=z.number().int().min(0).max(100_000_000);
const packWeight=z.number().finite().gt(0,"Enter a weight above zero or leave it blank").max(1_000_000).optional();
export const isWeightUnit=(unit:string)=>["kg","kilogram","kilograms","g","gram","grams"].includes(unit.trim().toLowerCase());
function checkPackUnit(item:{unit:string;packWeightGrams?:number},ctx:z.RefinementCtx){if(item.packWeightGrams!==undefined&&isWeightUnit(item.unit))ctx.addIssue({code:"custom",message:"For packs, use a unit such as box or pack. Leave pack weight blank for items sold by kg or g."});}
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;},"Enter a valid date");
export const customerSchema=z.object({id:optionalId,name:short.min(1,"Enter the customer’s name"),phone:z.string().trim().max(60).default(""),email:z.string().trim().max(200).email("Enter a valid email address").or(z.literal("")).default(""),address:z.string().trim().max(600).default(""),notes:note});
export const categorySchema=z.object({id:optionalId,name:short.min(1,"Enter a category name"),description:note,color:z.enum(["gold","rose","sage","blue","lavender"]).default("sage"),active:z.boolean().default(true)});
export const menuVariationSchema=z.object({id:optionalId,name:short.min(1,"Name each variation").max(120),priceCents:cents,unit:short.min(1,"Choose a unit for each variation").max(30),packWeightGrams:packWeight}).superRefine(checkPackUnit);
export const menuSchema=z.object({id:optionalId,name:short.min(1),category:short.min(1),priceCents:cents,unit:short.min(1).max(30),packWeightGrams:packWeight,variations:z.array(menuVariationSchema).max(40).default([]),description:note,active:z.boolean().default(true)}).superRefine((m,ctx)=>{
  if(!m.variations.length)checkPackUnit(m,ctx);
  const names=new Set<string>(),ids=new Set<string>();
  for(const v of m.variations){const name=v.name.toLowerCase();if(names.has(name))ctx.addIssue({code:"custom",message:"Give each variation a different name."});names.add(name);if(v.id){if(ids.has(v.id))ctx.addIssue({code:"custom",message:"Each variation must have its own ID."});ids.add(v.id);}}
});
export const lineSchema=z.object({name:short.min(1),quantity:z.number().finite().gt(0).max(100_000).transform(v=>Math.round(v*1000)/1000).refine(v=>v>0),unit:short.min(1).max(30),priceCents:cents,menuItemId:optionalId,variationId:optionalId,variationName:short.min(1).max(120).optional(),packWeightGrams:packWeight}).superRefine(checkPackUnit);
export const orderSchema=z.object({id:optionalId,customerId:z.string().uuid().optional(),categoryId:z.string().uuid().optional(),customerDetails:customerSchema.omit({id:true}).optional(),newCustomer:customerSchema.omit({id:true}).optional(),date,time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),fulfilment:z.enum(["Collection","Delivery"]),address:z.string().trim().max(600).default(""),occasion:short.default(""),notes:note,items:z.array(lineSchema).min(1).max(60),discountCents:cents.default(0),deliveryFeeCents:cents.default(0)}).superRefine((o,ctx)=>{
  if(!o.customerId&&!o.newCustomer)ctx.addIssue({code:"custom",message:"Select or add a customer"});
  if(o.fulfilment==="Delivery"&&!o.address.trim())ctx.addIssue({code:"custom",message:"Enter the delivery address"});
  if(o.discountCents>subtotal(o.items))ctx.addIssue({code:"custom",message:"Discount cannot exceed the items total"});
  if(orderTotal(o)>10_000_000_000)ctx.addIssue({code:"custom",message:"The order total is too large"});
});
export const paymentSchema=z.object({orderId:z.string().uuid(),amountCents:cents.gt(0,"Enter an amount above zero"),method:z.enum(METHODS),date,note});
export const settingsSchema=z.object({businessName:short.min(1),currency:z.enum(CURRENCIES),phone:z.string().trim().max(60).default(""),address:z.string().trim().max(600).default("")});
export function subtotal(items:LineItem[]){return items.reduce((s,i)=>s+Math.round(i.quantity*i.priceCents),0);}
export function orderTotal(o:{items:LineItem[];discountCents:number;deliveryFeeCents:number}){return subtotal(o.items)-o.discountCents+o.deliveryFeeCents;}
export function paidFor(orderId:string,payments:Payment[]){return payments.filter(p=>p.orderId===orderId).reduce((s,p)=>s+p.amountCents,0);}
export function balanceFor(o:Order,payments:Payment[]){return Math.max(0,o.totalCents-paidFor(o.id,payments));}
export function activeOrder(o:Order){return o.status!=="Completed"&&o.status!=="Cancelled";}
export function ordersOnDate(w:Workspace,date:string,categoryId="All"){return w.orders.filter(o=>o.date===date&&o.status!=="Cancelled"&&(categoryId==="All"||o.categoryId===categoryId)).sort((a,b)=>a.time.localeCompare(b.time));}
export function lineLabel(item:Pick<LineItem,"name"|"variationName">){return item.name+(item.variationName?" — "+item.variationName:"");}
const quantityNumber=(n:number)=>new Intl.NumberFormat("en-GB",{maximumFractionDigits:3}).format(n);
export function unitLabel(unit:string,n:number){return n===1||isWeightUnit(unit)?unit:unit==="box"?"boxes":unit.endsWith("s")?unit:unit+"s";}
export function weightLabel(grams:number){return quantityNumber(grams>=1000?grams/1000:grams)+(grams>=1000?"kg":"g");}
export function quantityLabel(item:Pick<LineItem,"quantity"|"unit"|"packWeightGrams">){return quantityNumber(item.quantity)+(item.packWeightGrams?" × "+weightLabel(item.packWeightGrams):"")+" "+unitLabel(item.unit,item.quantity);}
export function lineWeightGrams(item:Pick<LineItem,"quantity"|"unit"|"packWeightGrams">){const unit=item.unit.trim().toLowerCase();return item.packWeightGrams?item.quantity*item.packWeightGrams:["kg","kilogram","kilograms"].includes(unit)?item.quantity*1000:["g","gram","grams"].includes(unit)?item.quantity:0;}
export function lineSummary(item:LineItem){return lineLabel(item)+" · "+quantityLabel(item)+(item.packWeightGrams?" · "+weightLabel(lineWeightGrams(item))+" total":"");}
export function prepKey(item:LineItem){return JSON.stringify([item.name.trim().toLowerCase(),item.variationName?.trim().toLowerCase()??"",item.unit.trim().toLowerCase(),item.packWeightGrams??null]);}
export function aggregateWeights(orders:Order[]){const groups=new Map<string,{name:string;grams:number}>();for(const order of orders)for(const item of order.items){const grams=lineWeightGrams(item);if(!grams)continue;const key=item.name.trim().toLowerCase(),row=groups.get(key)??{name:item.name,grams:0};row.grams=Math.round((row.grams+grams)*1000)/1000;groups.set(key,row);}return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));}
export function menuLine(item:MenuItem,variationId?:string):LineItem{
  if(!item.active)throw new Error("This menu item is archived.");
  const variation=item.variations?.find(v=>v.id===variationId);
  if(item.variations?.length&&!variation)throw new Error("Choose a size or variation first.");
  if(variationId&&!variation)throw new Error("This variation is no longer available.");
  return {name:item.name,menuItemId:item.id,quantity:1,unit:variation?.unit??item.unit,priceCents:variation?.priceCents??item.priceCents,packWeightGrams:variation?variation.packWeightGrams:item.packWeightGrams,...(variation?{variationId:variation.id,variationName:variation.name}:{})};
}
export function aggregateItems(orders:Order[]){
  const groups=new Map<string,LineItem & {orderIds:Set<string>}>();
  for(const order of orders)for(const item of order.items){const key=prepKey(item);let row=groups.get(key);if(!row){row={...item,quantity:0,orderIds:new Set()};groups.set(key,row);}row.quantity=Math.round((row.quantity+item.quantity)*1000)/1000;row.orderIds.add(order.id);}
  return [...groups.values()].map(({orderIds,...item})=>({...item,orderCount:orderIds.size})).sort((a,b)=>lineLabel(a).localeCompare(lineLabel(b)));
}
export function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
export function shiftDate(s:string,days:number){const d=new Date(s+"T12:00:00");d.setDate(d.getDate()+days);return localDate(d);}
export function prettyDate(s:string,opts:Intl.DateTimeFormatOptions={day:"numeric",month:"short"}){return new Date(s+"T12:00:00").toLocaleDateString("en-GB",opts);}
export function money(value:number,currency:string){return new Intl.NumberFormat("en-US",{style:"currency",currency,currencyDisplay:"code",minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100);}
export function toCents(value:FormDataEntryValue|null){const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error("Enter a valid amount");return Math.round(n*100);}
export function csvCell(value:unknown){const s=String(value??"");const safe=/^[=+\-@\t\r]/.test(s)?"'"+s:s;return '"'+safe.replaceAll('"','""')+'"';}
