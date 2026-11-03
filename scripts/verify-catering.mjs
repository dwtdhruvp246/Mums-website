import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir,rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const target=path.resolve('.sites-runtime/demo-verification');await mkdir(target,{recursive:true});
try {
for(const name of ['domain','demo']){let code=ts.transpileModule(await readFile('lib/'+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;code=code.replace('from "./domain"','from "./domain.mjs"');await writeFile(path.join(target,name+'.mjs'),code);}
const {sampleWorkspace,updateSample}=await import(pathToFileURL(path.join(target,'demo.mjs')));
const {ordersOnDate,summarizeOrderCategories,aggregateItems,localDate,shiftDate,balanceFor,orderTotal,menuLine,lineLabel,menuSchema,quantityLabel,lineWeightGrams,lineSchema,aggregateWeights}=await import(pathToFileURL(path.join(target,'domain.mjs')));
let checks=0,w=sampleWorkspace();function check(value,label){assert.ok(value,label);checks++;}
const today=localDate(),diwali=w.categories.find(c=>c.name==='Diwali').id;
const wedding=w.categories.find(c=>c.name==='Weddings').id;
const uncategorised={...w.orders[0],categoryId:undefined,date:today,time:'10:00'};
const categoryOrders=[
  {...w.orders[0],categoryId:diwali,date:shiftDate(today,1),time:'08:00'},
  {...w.orders[0],categoryId:wedding,date:today,time:'15:00'},
  uncategorised,
  {...w.orders[0],categoryId:wedding,date:today,time:'09:00'},
];
const categorySummary=summarizeOrderCategories(categoryOrders);
check(categorySummary.map(group=>group.id).join('|')===[wedding,'',diwali].join('|'),'Category boxes sort by earliest due date and time, including uncategorised orders');
check(categorySummary[0].count===2&&categorySummary[0].firstOrder.time==='09:00','Category count and earliest time include all orders in the group');
check(ordersOnDate({...w,orders:categoryOrders},today,'')[0]===uncategorised,'The dashboard can filter older uncategorised orders');
check(w.categories.length===5,'Five editable occasion categories');check(w.customers.length===6,'Sample customers');check(ordersOnDate(w,today).length===4,'Dashboard selects today only');check(ordersOnDate(w,shiftDate(today,1)).length===2,'Changing date selects different orders');check(ordersOnDate(w,today,diwali).length===3,'Date and category filters combine');
let items=aggregateItems(ordersOnDate(w,today));check(items.find(i=>i.name==='Kaju katli'&&i.variationName==='By weight').quantity===3,'Loose sweets kilograms correctly combined');check(items.find(i=>i.name==='Vegetable samosas').quantity===50,'Snack pieces correctly combined');check(items.find(i=>i.name==='Kaju katli'&&i.variationName==='By weight').orderCount===2,'Distinct contributing orders counted');
const mixed=structuredClone(w.orders[0]);mixed.items=[{name:'Same name',quantity:1,unit:'kg',priceCents:100},{name:'Same name',quantity:3,unit:'piece',priceCents:100}];check(aggregateItems([mixed]).length===2,'Different units are never added together');
let r=updateSample(w,'saveCategory',{data:{name:'Christmas',description:'Festive orders',color:'gold',active:true}});w=r.workspace;const categoryId=r.changedId;check(w.categories.some(c=>c.id===categoryId),'New category saved');
r=updateSample(w,'saveCategory',{data:{...w.categories.find(c=>c.id===categoryId),name:'Christmas orders'}});w=r.workspace;check(w.categories.find(c=>c.id===categoryId).name==='Christmas orders','Category renamed without losing identity');
assert.throws(()=>updateSample(w,'saveCategory',{data:{name:'Diwali',color:'sage',active:true}}));checks++;
assert.throws(()=>updateSample(w,'deleteCategory',{id:diwali}));checks++;
r=updateSample(w,'saveCustomer',{data:{name:'New sample person',phone:'',email:'',address:'',notes:''}});w=r.workspace;const customerId=r.changedId;check(w.customers.find(c=>c.id===customerId).phone==='','Customer phone is optional');
const order={categoryId,customerId,date:shiftDate(today,2),time:'10:30',fulfilment:'Collection',address:'',occasion:'Test event',notes:'Sample',items:[{name:'Kaju katli',quantity:1.5,unit:'kg',priceCents:3000}],discountCents:0,deliveryFeeCents:0};
r=updateSample(w,'saveOrder',{data:order});w=r.workspace;const orderId=r.changedId;check(ordersOnDate(w,order.date,categoryId).some(o=>o.id===orderId),'New order appears under selected date and category');check(w.orders.find(o=>o.id===orderId).totalCents===4500,'Fractional quantities give correct price');
r=updateSample(w,'saveOrder',{data:{...order,id:orderId,customerDetails:{name:'New sample person',phone:'Test phone',email:'sample@example.com',address:'Sample address',notes:''}}});w=r.workspace;check(w.customers.find(c=>c.id===customerId).phone==='Test phone','Edited contact details saved to customer');check(w.customers.length===7,'Selecting existing customer does not duplicate person');
r=updateSample(w,'saveCategory',{data:{...w.categories.find(c=>c.id===categoryId),name:'Holiday orders'}});w=r.workspace;check(w.orders.find(o=>o.id===orderId).categoryId===categoryId,'Renamed category keeps its orders');
r=updateSample(w,'recordPayment',{data:{orderId,amountCents:1500,method:'Cash',date:today,note:'Test deposit'}});w=r.workspace;check(balanceFor(w.orders.find(o=>o.id===orderId),w.payments)===3000,'Deposit reduces balance');assert.throws(()=>updateSample(w,'recordPayment',{data:{orderId,amountCents:3001,method:'Cash',date:today,note:''}}));checks++;
const before=JSON.stringify(w);assert.throws(()=>updateSample(w,'saveOrder',{data:{...order,id:orderId,items:[{name:'Test',quantity:1,unit:'piece',priceCents:1}]}}));checks++;check(JSON.stringify(w)===before,'Rejected edits do not partly change the workspace');
r=updateSample(w,'setStatus',{id:orderId,status:'Cancelled'});w=r.workspace;check(!ordersOnDate(w,order.date,categoryId).some(o=>o.id===orderId),'Cancelled orders excluded from dashboard totals');
r=updateSample(w,'saveCategory',{data:{...w.categories.find(c=>c.id===categoryId),active:false}});w=r.workspace;check(w.categories.find(c=>c.id===categoryId).active===false,'Category can be archived');assert.throws(()=>updateSample(w,'saveOrder',{data:order}));checks++;
r=updateSample(w,'saveOrder',{data:{...order,categoryId:diwali,customerId:undefined,newCustomer:{name:'Typed new name',phone:'',email:'',address:'',notes:''}}});w=r.workspace;check(w.customers.some(c=>c.name==='Typed new name'),'Manual name creates a reusable customer');
const packed=sampleWorkspace().orders.find(o=>o.orderNumber==='CD-0101').items[0];
check(packed.quantity===20&&packed.packWeightGrams===250&&lineWeightGrams(packed)===5000,'Twenty 250g packs retain the pack count and calculate 5kg');
check(quantityLabel(packed)==='20 × 250g boxes','Packed quantity label shows count, individual weight and unit');
check(aggregateWeights(ordersOnDate(sampleWorkspace(),today)).find(i=>i.name==='Kaju katli').grams===8000,'Dish weight includes loose quantities and pack contents without double counting');
const packGroup={...sampleWorkspace().orders[0],items:[{...packed,quantity:20},{...packed,quantity:2},{...packed,quantity:3,packWeightGrams:500}]};
const packPrep=aggregateItems([packGroup]);check(packPrep.length===2&&packPrep.find(i=>i.packWeightGrams===250).quantity===22,'Same size packs combine while different pack weights stay separate');
check(lineWeightGrams({quantity:250,unit:'g'})===250&&lineWeightGrams({quantity:1.25,unit:'kg'})===1250,'Loose grams and kilograms convert consistently');
check(lineWeightGrams({quantity:20,unit:'piece'})===0,'No weight is invented for ordinary counted items');
check(!lineSchema.safeParse({...packed,packWeightGrams:0}).success&&!lineSchema.safeParse({...packed,packWeightGrams:-250}).success,'Zero and negative pack weights are rejected');
check(!lineSchema.safeParse({...packed,unit:'kg'}).success,'Pack metadata cannot double-count a kilogram quantity');
const legacyMenu={...w.menuItems[0],variations:undefined};check(menuLine(legacyMenu).priceCents===legacyMenu.priceCents&&!menuLine(legacyMenu).variationName,'Existing single-price menus still work without migration');
r=updateSample(w,'saveMenuItem',{data:{name:'Test sweet box',category:'Sweets',priceCents:0,unit:'portion',description:'Sample variations',active:true,variations:[{name:'Small box',priceCents:1250,unit:'box',packWeightGrams:250},{name:'Large box',priceCents:2000,unit:'box',packWeightGrams:500}]}});w=r.workspace;
const variantMenu=w.menuItems.find(i=>i.id===r.changedId),[small,large]=variantMenu.variations;
check(small.id!==large.id&&Boolean(small.id&&large.id),'New variations receive distinct saved identities');
check(variantMenu.priceCents===1250&&variantMenu.unit==='box','Variation menu fallback follows its first option');
check(menuLine(variantMenu,large.id).priceCents===2000&&menuLine(variantMenu,large.id).unit==='box'&&menuLine(variantMenu,large.id).packWeightGrams===500,'Selecting a variation uses that option’s own price and unit');
assert.throws(()=>menuLine(variantMenu));checks++;assert.throws(()=>menuLine(variantMenu,'missing'));checks++;assert.throws(()=>menuLine({...variantMenu,active:false},small.id));checks++;
check(!menuSchema.safeParse({...variantMenu,variations:[small,{...large,name:' SMALL BOX '}]}).success,'Duplicate variation names are rejected after trimming');
check(!menuSchema.safeParse({...variantMenu,variations:[small,{...large,id:small.id}]}).success,'Duplicate variation identities are rejected');
check(!menuSchema.safeParse({...variantMenu,variations:[{...small,priceCents:-1}]}).success,'Negative variation prices are rejected');
const variantLines=[{...menuLine(variantMenu,small.id),quantity:2},{...menuLine(variantMenu,large.id),quantity:3}];
r=updateSample(w,'saveOrder',{data:{...order,categoryId:diwali,items:variantLines}});w=r.workspace;const variantOrder=w.orders.find(o=>o.id===r.changedId),variantSnapshot=JSON.stringify(variantOrder.items);
check(variantOrder.totalCents===8500,'Different option prices and quantities calculate one correct order total');
const variantPrep=aggregateItems([variantOrder]);check(variantPrep.length===2&&variantPrep.find(i=>i.variationId===small.id).quantity===2&&variantPrep.find(i=>i.variationId===large.id).quantity===3,'Preparation keeps different sizes separate even when their base dish and unit match');
check(lineLabel(variantOrder.items[1])==='Test sweet box — Large box','Order, print and export labels include the saved variation name');
r=updateSample(w,'saveMenuItem',{data:{...variantMenu,name:'Renamed sweet box',variations:[{...small,name:'Mini box',priceCents:1500,packWeightGrams:300}]}});w=r.workspace;
check(JSON.stringify(w.orders.find(o=>o.id===variantOrder.id).items)===variantSnapshot,'Renaming, repricing and removing menu options does not alter old orders');
r=updateSample(w,'saveOrder',{data:{...variantOrder,notes:'Keep original options'}});w=r.workspace;
check(JSON.stringify(w.orders.find(o=>o.id===variantOrder.id).items)===variantSnapshot,'Editing an old order preserves a removed option and its original price');
const loaded=JSON.parse(JSON.stringify(w));check(loaded.orders.length===w.orders.length&&loaded.categories.length===w.categories.length,'Preview data round-trips through browser storage format');check(loaded.orders.find(o=>o.id===variantOrder.id).items[1].variationName==='Large box','Saved variations survive a browser storage round trip');check(sampleWorkspace().customers.length===6,'Reset regenerates the original dummy records');
console.log(JSON.stringify({result:'PASS',checks,scope:'Sample data, categories, customers, date filters, variations, separate preparation totals, order history and payments. No database writes.'}));
} finally {await rm(target,{recursive:true,force:true});}
