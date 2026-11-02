import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const target=path.resolve('.sites-runtime/menu-import-verification');
await mkdir(target,{recursive:true});let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
const throws=(fn,pattern)=>{assert.throws(fn,pattern);checks++;};
const rejects=async(fn,pattern)=>{await assert.rejects(fn,pattern);checks++;};
try{
  for(const name of ['domain','demo','menu-import']){
    const source=await readFile('lib/'+name+'.ts','utf8');
    const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from "(\.\/[^\"]+)"/g,(_,name)=>`from "${name}.mjs"`);
    await writeFile(path.join(target,name+'.mjs'),code);
  }
  const {parseMenuRows,readMenuWorkbook,assertMenuWorkbookZip,MENU_IMPORT_COLUMNS:headers,MENU_IMPORT_MAX_BYTES}=await import(pathToFileURL(path.join(target,'menu-import.mjs')));
  const {sampleWorkspace,updateSample}=await import(pathToFileURL(path.join(target,'demo.mjs')));
  const {planMenuImport}=await import(pathToFileURL(path.join(target,'menu-import.mjs')));
  const {menuLine,lineWeightGrams}=await import(pathToFileURL(path.join(target,'domain.mjs')));
  const sheet=(...data)=>[{number:1,cells:[...headers]},...data.map((cells,index)=>({number:index+2,cells}))];
  const row=(patch={})=>{const cells=['New test dish','Snacks','',1.25,'piece','','','Yes'];for(const [index,value] of Object.entries(patch))cells[Number(index)]=value;return cells;};
  const arrayBuffer=buffer=>buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);

  let result=parseMenuRows(sheet(row()));
  check(!result.issues.length&&result.items.length===1,'A simple dish imports');
  check(result.items[0].data.priceCents===125&&result.items[0].data.active,'Typed price and Active are correct');
  check(parseMenuRows(sheet(row({3:0,7:''}))).items[0].data.priceCents===0,'A zero price is valid and blank Active defaults to Yes');
  check(parseMenuRows(sheet(row({3:'12.50'}))).items[0].data.priceCents===1250,'Plain decimal text is accepted');
  for(const price of ['',-1,1.234,1000001,'$12.00','1,000.00','abc',Infinity])check(parseMenuRows(sheet(row({3:price}))).issues.some(i=>i.field==='Price'),'Invalid prices are reported');
  for(const field of [0,1,4])check(parseMenuRows(sheet(row({[field]:''}))).issues.length>0,'Required fields cannot be blank');
  check(parseMenuRows(sheet(row({5:250,4:'kg'}))).issues.length>0,'A kilogram sale cannot also have a pack weight');
  check(parseMenuRows(sheet(row({5:-250,4:'box'}))).issues.length>0,'Negative pack weights are rejected');
  check(parseMenuRows(sheet(row({5:0,4:'box'}))).issues.length>0,'Zero pack weights are rejected');
  check(parseMenuRows(sheet(row({7:'maybe'}))).issues.some(i=>i.field==='Active'),'Invalid Active values are reported');
  check(parseMenuRows(sheet(row({7:false}))).items[0].data.active===false,'Excel boolean Active is accepted');
  check(parseMenuRows(sheet(row({3:{invalid:'formula'}}))).issues.some(i=>/Paste/.test(i.message)&&i.row===2),'Formula values are rejected with the correct row');
  check(parseMenuRows(sheet(row({3:{invalid:'value'}}))).issues.some(i=>/plain/.test(i.message)),'Excel errors/dates are not silently converted to prices');

  result=parseMenuRows(sheet(row({2:'250g box',4:'box',5:250,7:''}),row({2:'500g box',3:2.5,4:'box',5:500,6:'One description',7:'No'})));
  check(!result.issues.length&&result.items.length===1&&result.items[0].data.variations.length===2,'Rows group into one item with two variations');
  check(result.items[0].data.description==='One description'&&result.items[0].data.active===false,'Blank metadata inherits the group’s specified description and Active');
  check(result.items[0].data.variations[1].priceCents===250&&result.items[0].data.variations[1].packWeightGrams===500,'Each variation keeps its own price and weight');
  check(parseMenuRows(sheet(row(),row())).issues.some(i=>i.row===3),'Repeated plain items need variations or deduplication');
  check(parseMenuRows(sheet(row({2:'Small'}),row())).issues.some(i=>i.field==='Variation'),'Plain and variation rows cannot mix');
  check(parseMenuRows(sheet(row({2:'Small'}),row({2:' SMALL '}))).issues.some(i=>/different name/.test(i.message)),'Variation names are unique after trimming/case folding');
  check(parseMenuRows(sheet(row({2:'Small',6:'A'}),row({2:'Large',6:'B'}))).issues.some(i=>i.field==='Description'),'Conflicting descriptions are reported');
  check(parseMenuRows(sheet(row({2:'Small',7:'Yes'}),row({2:'Large',7:'No'}))).issues.some(i=>i.field==='Active'),'Conflicting Active settings are reported');
  check(parseMenuRows(sheet(...Array.from({length:41},(_,i)=>row({2:'Size '+i})))).issues.some(i=>/40 variations/.test(i.message)),'An item has at most 40 variations');
  check(parseMenuRows(sheet(row({0:' sweets ',1:'Group',2:'Small'}),row({0:'SWEETS',1:' group ',2:'Large'}))).items.length===1,'Item identity trims and folds case');

  check(parseMenuRows([{number:1,cells:[' Item name * ','FOOD GROUP','Price','Unit']},{number:2,cells:['Dish','Snacks',2,'portion']}]).items.length===1,'Required columns can be reordered and optional columns omitted');
  check(parseMenuRows([{number:1,cells:['Item name','Price','Unit']},{number:2,cells:['Dish',2,'portion']}]).issues.some(i=>/Food group/.test(i.message)),'Missing required headers are reported');
  check(parseMenuRows([{number:1,cells:[...headers,'ID']},{number:2,cells:row()}]).issues.length>0,'Unknown columns cannot silently discard data');
  check(parseMenuRows([{number:1,cells:[...headers,'Item name']},{number:2,cells:row()}]).issues.some(i=>/twice/.test(i.message)),'Duplicate headers are rejected');
  check(parseMenuRows([{number:1,cells:[...headers]},{number:2,cells:[...row(),'extra']}]).issues.some(i=>i.field==='Column I'),'Data outside the template is reported');
  result=parseMenuRows([{number:1,cells:[...headers]},{number:2,cells:['','','']},{number:5,cells:row()}]);
  check(result.rowCount===1&&result.items[0].rows[0]===5,'Blank rows are ignored and real Excel row numbers survive');
  throws(()=>parseMenuRows(sheet()),/No menu items/);
  throws(()=>parseMenuRows([{number:3,cells:row()}]),/first row/);
  throws(()=>parseMenuRows(sheet(...Array.from({length:501},(_,i)=>row({0:'Dish '+i})))),/500/);
  check(parseMenuRows(sheet(...Array.from({length:500},(_,i)=>row({0:'Dish '+i})))).items.length===500,'The supported 500-row boundary works');

  const template=await readFile('public/menu-import-template.xlsx');
  assertMenuWorkbookZip(arrayBuffer(template));checks++;
  await rejects(()=>readMenuWorkbook(arrayBuffer(template),'template.xlsx'),/No menu items/);
  await rejects(()=>readMenuWorkbook(arrayBuffer(template),'template.xls'),/\.xlsx/);
  throws(()=>assertMenuWorkbookZip(new ArrayBuffer(10)),/supported/);
  throws(()=>assertMenuWorkbookZip(new ArrayBuffer(MENU_IMPORT_MAX_BYTES+1)),/2 MB/);
  const oversize=Buffer.from(template);let footer=-1;
  for(let i=oversize.length-22;i>=0;i--)if(oversize.readUInt32LE(i)===0x06054b50){footer=i;break;}
  const central=oversize.readUInt32LE(footer+16);oversize.writeUInt32LE(21*1024*1024,central+24);
  throws(()=>assertMenuWorkbookZip(arrayBuffer(oversize)),/too much data/);
  const protectedZip=Buffer.from(template);protectedZip.writeUInt16LE(protectedZip.readUInt16LE(central+8)|1,central+8);
  throws(()=>assertMenuWorkbookZip(arrayBuffer(protectedZip)),/Password-protected/);

  const fixture=await readFile('scripts/fixtures/menu-import-valid.xlsx');
  result=await readMenuWorkbook(arrayBuffer(fixture),'fixture.xlsx');
  check(!result.issues.length&&result.rowCount===5&&result.items.length===4,'The real Excel fixture parses five rows into four items');
  const w=sampleWorkspace(),original=JSON.stringify(w),plan=planMenuImport(result,w.menuItems),fresh=plan.filter(item=>item.status==='new');
  check(fresh.length===3&&plan.filter(item=>item.status==='existing').length===1,'Existing menu items are skipped in the preview');
  const saved=updateSample(w,'importMenuItems',{items:fresh.map(item=>item.data)}).workspace;
  check(saved.menuItems.length===w.menuItems.length+3,'The batch adds exactly three new items');
  check(JSON.stringify(w)===original,'Import never mutates the input workspace');
  const stable=value=>JSON.stringify(Array.isArray(value)?value.toSorted((a,b)=>a.id.localeCompare(b.id)):value);
  for(const key of ['orders','payments','customers','categories','settings'])check(stable(saved[key])===stable(w[key]),'Import preserves '+key+' records');
  check(w.menuItems.every(old=>JSON.stringify(saved.menuItems.find(item=>item.id===old.id))===JSON.stringify(old)),'Existing menu prices, variations and metadata are untouched');
  const sweet=saved.menuItems.find(item=>item.name==='Upload QA sweets');
  check(sweet.variations.length===2&&sweet.variations[0].id!==sweet.variations[1].id,'Saved variations receive unique identities');
  check(lineWeightGrams({...menuLine(sweet,sweet.variations[0].id),quantity:20})===5000,'Imported 250g packs work in order/preparation calculations');
  check(saved.menuItems.find(item=>item.name==='Upload QA archived').active===false,'Archived import is preserved');
  throws(()=>updateSample(saved,'importMenuItems',{items:fresh.map(item=>item.data)}),/already on your menu/);
  const withDuplicates=updateSample(w,'importMenuItems',{items:[fresh[0].data,{...fresh[0].data,name:' '+fresh[0].data.name.toUpperCase()+' '}]}).workspace;
  check(withDuplicates.menuItems.length===w.menuItems.length+1,'The save layer also deduplicates the batch');
  throws(()=>updateSample(w,'importMenuItems',{items:[fresh[0].data,{...fresh[1].data,priceCents:-1}]}));
  check(JSON.stringify(w)===original,'An invalid later row cannot partly import a batch');
  throws(()=>updateSample(w,'importMenuItems',{items:[]}));
  const foreignId=updateSample(w,'importMenuItems',{items:[{...fresh[0].data,id:w.menuItems[0].id}]}).workspace;
  check(foreignId.menuItems.at(-1).id!==w.menuItems[0].id,'A supplied ID can never turn import into an update');
  const formula=await readFile('scripts/fixtures/menu-import-formula.xlsx');
  const rejected=await readMenuWorkbook(arrayBuffer(formula),'formula.xlsx');
  check(rejected.issues.some(i=>i.row===3&&i.field==='Price'&&/formula/.test(i.message)),'A real workbook formula is rejected even when it has a cached numeric result');
  console.log(JSON.stringify({result:'PASS',checks,scope:'Actual XLSX template/fixtures, variations, row errors, archive flags, duplicate prevention, atomic batch changes and order-history preservation. No live data writes.'}));
} finally {await rm(target,{recursive:true,force:true});}
