import { MENU_IMPORT_LIMIT, menuIdentity, menuSchema, type MenuItem } from "./domain";

export const MENU_IMPORT_COLUMNS=["Item name","Food group","Variation","Price","Unit","Pack weight (g)","Description","Active"] as const;
export const MENU_IMPORT_MAX_BYTES=2*1024*1024;
const KEYS=["name","category","variation","price","unit","packWeight","description","active"] as const;
type Field=typeof KEYS[number];
export type NewMenuItem={name:string;category:string;priceCents:number;unit:string;packWeightGrams?:number;description:string;active:boolean;variations:{name:string;priceCents:number;unit:string;packWeightGrams?:number}[]};
export type MenuImportIssue={row:number;field:string;message:string};
export type MenuImportItem={data:NewMenuItem;rows:number[]};
export type MenuImportResult={items:MenuImportItem[];issues:MenuImportIssue[];rowCount:number};
export type MenuSheetRow={number:number;cells:unknown[]};
const blank=(value:unknown)=>value===undefined||value===null||(typeof value==="string"&&!value.trim());
const text=(value:unknown)=>blank(value)?"":String(value).trim();
const normalHeader=(value:unknown)=>text(value).toLowerCase().replace(/\s+/g," ").replace(/\s*\*$/,"");
const fieldLabel=(key:Field)=>MENU_IMPORT_COLUMNS[KEYS.indexOf(key)];
function columnLabel(index:number){let result="";for(let n=index+1;n;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;}

/** Read values only: workbook formulas, hyperlinks and formatting are never executed. */
export async function readMenuWorkbook(buffer:ArrayBuffer,fileName:string):Promise<MenuImportResult>{
  if(!/\.xlsx$/i.test(fileName))throw new Error("Choose an Excel .xlsx file using the menu template.");
  assertMenuWorkbookZip(buffer);
  const Excel=(await import("exceljs")).default;
  const workbook=new Excel.Workbook();
  try{
    await workbook.xlsx.load(await normalizeWorkbookNamespaces(buffer) as Parameters<typeof workbook.xlsx.load>[0],{
      // Only cell values are needed. Skipping validations also avoids expanding
      // arbitrary validation ranges from an uploaded workbook.
      ignoreNodes:["dataValidations","drawing","picture","conditionalFormatting","extLst","tableParts","mergeCells","sheetProtection","autoFilter","rowBreaks","pageSetup","headerFooter","printOptions","pageMargins","sheetViews"]
    });
  }catch{throw new Error("This workbook could not be read. Save it as a normal .xlsx file using the template and try again.");}
  const sheet=workbook.worksheets.find(sheet=>sheet.name.trim().toLowerCase()==="menu items");
  if(!sheet)throw new Error('The "Menu items" sheet is missing. Download the template and enter your items on that sheet.');
  if(sheet.rowCount>10000)throw new Error("The worksheet is too large. Copy up to 500 menu rows into a fresh template.");
  const rows:MenuSheetRow[]=[];
  sheet.eachRow({includeEmpty:false},(row,number)=>{
    const cells:unknown[]=[];
    row.eachCell({includeEmpty:false},(cell,column)=>{
      if(column>32)throw new Error("Remove extra columns and use the headings in the menu template.");
      const value=cell.value;
      if(value&&typeof value==="object"){
        if("formula" in value||"sharedFormula" in value)cells[column-1]={invalid:"formula"};
        else if("richText" in value)cells[column-1]=value.richText.map(run=>run.text).join("");
        else if("text" in value)cells[column-1]=value.text;
        else cells[column-1]={invalid:"value"};
      }else cells[column-1]=value;
    });
    if(cells.some(value=>!blank(value)))rows.push({number,cells});
    if(rows.filter(row=>row.number!==1).length>MENU_IMPORT_LIMIT)throw new Error("Import up to 500 nonblank rows, including variations, at a time.");
  });
  return parseMenuRows(rows);
}

// Some Excel-compatible exporters use explicit SpreadsheetML tag prefixes.
// ExcelJS expects unprefixed element names. Normalize only the known namespace
// in a temporary in-memory copy; cell contents and the uploaded file stay intact.
async function normalizeWorkbookNamespaces(buffer:ArrayBuffer){
  const JSZip=(await import("jszip")).default,zip=await JSZip.loadAsync(buffer);
  let changed=false;
  for(const entry of Object.values(zip.files)){
    if(entry.dir||!/^xl\/(?:workbook|styles|sharedStrings|worksheets\/[^/]+|tables\/[^/]+)\.xml$/.test(entry.name))continue;
    let xml=await entry.async("string");
    const prefixes=[...xml.matchAll(/xmlns:([A-Za-z_][\w.-]*)=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/g)].map(match=>match[1]);
    for(const prefix of prefixes){
      const escaped=prefix.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      xml=xml.replace(new RegExp(`(<\\/?)(?:${escaped}):`,"g"),"$1");
    }
    if(prefixes.length){zip.file(entry.name,xml);changed=true;}
  }
  return changed?zip.generateAsync({type:"arraybuffer"}):buffer;
}

/** Bound ZIP size before Excel parsing. XLSX is a ZIP container, not an executable. */
export function assertMenuWorkbookZip(buffer:ArrayBuffer){
  if(buffer.byteLength>MENU_IMPORT_MAX_BYTES)throw new Error("Choose an .xlsx file smaller than 2 MB with up to 500 rows.");
  const view=new DataView(buffer),invalid=()=>new Error("This is not a supported .xlsx workbook. Save a fresh copy using the template.");
  if(view.byteLength<22)throw invalid();
  let end=-1;
  for(let i=view.byteLength-22;i>=Math.max(0,view.byteLength-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===view.byteLength){end=i;break;}
  if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true))throw invalid();
  const count=view.getUint16(end+10,true),length=view.getUint32(end+12,true),start=view.getUint32(end+16,true);
  if(!count||count>1024||count!==view.getUint16(end+8,true)||start+length>end)throw invalid();
  let position=start,total=0;const names=new Set<string>();
  for(let i=0;i<count;i++){
    if(position+46>start+length||view.getUint32(position,true)!==0x02014b50)throw invalid();
    if(view.getUint16(position+8,true)&1)throw new Error("Password-protected workbooks are not supported. Save an unprotected .xlsx copy.");
    total+=view.getUint32(position+24,true);
    if(total>20*1024*1024)throw new Error("This workbook expands to too much data. Use a fresh template with up to 500 rows.");
    const nameLength=view.getUint16(position+28,true),extra=view.getUint16(position+30,true),comment=view.getUint16(position+32,true);
    const next=position+46+nameLength+extra+comment;if(next>start+length)throw invalid();
    const name=new TextDecoder().decode(new Uint8Array(buffer,position+46,nameLength));names.add(name);
    if(name.toLowerCase().endsWith("vbaproject.bin"))throw new Error("Use an .xlsx workbook saved without macros.");
    position=next;
  }
  if(!names.has("xl/workbook.xml")||!names.has("[Content_Types].xml"))throw invalid();
}

export function parseMenuRows(rows:MenuSheetRow[]):MenuImportResult{
  const header=rows.find(row=>row.number===1),dataRows=rows.filter(row=>row.number!==1&&row.cells.some(value=>!blank(value)));
  if(!header)throw new Error("Keep the template headings on the first row of the Menu items sheet.");
  if(dataRows.length>MENU_IMPORT_LIMIT)throw new Error("Import up to 500 nonblank rows, including variations, at a time.");
  const issues:MenuImportIssue[]=[],items:MenuImportItem[]=[],columns=new Map<Field,number>();
  const issue=(row:number,field:string,message:string)=>issues.push({row,field,message});
  header.cells.forEach((value,index)=>{
    if(blank(value))return;
    const match=MENU_IMPORT_COLUMNS.findIndex(name=>normalHeader(name)===normalHeader(value));
    if(match<0){issue(1,"Headings",`Unknown heading in column ${columnLabel(index)}. Keep the headings from the template.`);return;}
    const key=KEYS[match];if(columns.has(key))issue(1,fieldLabel(key),"This heading appears twice. Keep one column for each field.");else columns.set(key,index);
  });
  for(const key of ["name","category","price","unit"] as const)if(!columns.has(key))issue(1,"Headings",`The ${fieldLabel(key)} column is missing.`);
  if(issues.length)return {items,issues,rowCount:dataRows.length};
  if(!dataRows.length)throw new Error('No menu items were found. Fill the "Menu items" sheet. The guide examples are not imported.');
  type ParsedRow={number:number;name:string;category:string;variation:string;priceCents:number;unit:string;packWeightGrams?:number;description:string;active?:boolean};
  const groups=new Map<string,ParsedRow[]>(),used=new Set(columns.values());
  for(const row of dataRows){
    const before=issues.length;
    row.cells.forEach((value,index)=>{
      if(blank(value))return;
      const key=[...columns].find(([,column])=>column===index)?.[0];
      if(!used.has(index))issue(row.number,`Column ${columnLabel(index)}`,"Remove data outside the template columns.");
      else if(typeof value==="object")issue(row.number,key?fieldLabel(key):"Cell",(value as {invalid?:string}).invalid==="formula"?"Paste the formula result as a value before uploading.":"Use a plain text or number value in this cell.");
    });
    if(issues.length!==before)continue;
    const get=(key:Field)=>row.cells[columns.get(key)??-1];
    const name=text(get("name")),category=text(get("category")),variation=text(get("variation")),unit=text(get("unit")),description=text(get("description"));
    const number=(key:Field,optional=false)=>{
      const value=get(key);if(optional&&blank(value))return undefined;
      if(blank(value)||(typeof value!=="number"&&(typeof value!=="string"||!/^\d+(?:\.\d+)?$/.test(value.trim())))){
        issue(row.number,fieldLabel(key),"Enter a plain number without a currency symbol.");return undefined;
      }
      const result=Number(value);if(!Number.isFinite(result)){issue(row.number,fieldLabel(key),"Enter a valid number.");return undefined;}return result;
    };
    const price=number("price"),packWeightGrams=number("packWeight",true);
    if(price!==undefined&&(price<0||price>1000000||Math.abs(price*100-Math.round(price*100))>0.000001))issue(row.number,"Price","Use a price from 0 to 1,000,000, with up to two decimal places.");
    const activeValue=get("active");let active:boolean|undefined;
    if(!blank(activeValue)){
      const value=text(activeValue).toLowerCase();
      if(["yes","true","1"].includes(value))active=true;
      else if(["no","false","0"].includes(value))active=false;
      else issue(row.number,"Active","Use Yes or No, or leave this blank for Yes.");
    }
    if(!name)issue(row.number,"Item name","Enter an item name.");
    if(!category)issue(row.number,"Food group","Enter a food group, such as Sweets or Snacks.");
    if(!unit)issue(row.number,"Unit","Enter a unit, such as box, kg or portion.");
    if(issues.length!==before)continue;
    const parsed:ParsedRow={number:row.number,name,category,variation,unit,priceCents:Math.round(price!*100),packWeightGrams,description,active};
    const key=menuIdentity(parsed),group=groups.get(key)??[];group.push(parsed);groups.set(key,group);
  }
  for(const group of groups.values()){
    const before=issues.length,first=group[0],hasVariations=group.some(row=>Boolean(row.variation));
    if(group.length>1&&!hasVariations)issue(group[1].number,"Variation","This item appears more than once. Name each variation, or keep a single row for an item without variations.");
    if(hasVariations){
      if(group.length>40)issue(first.number,"Variation","Use up to 40 variations for one item.");
      const seen=new Set<string>();
      for(const row of group){
        if(!row.variation)issue(row.number,"Variation","Name the variation on every row for this item.");
        else if(seen.has(row.variation.toLowerCase()))issue(row.number,"Variation","Give each variation a different name.");
        seen.add(row.variation.toLowerCase());
      }
    }
    const description=group.find(row=>row.description)?.description??"",active=group.find(row=>row.active!==undefined)?.active??true;
    for(const row of group){
      if(row.description&&row.description!==description)issue(row.number,"Description","Use the same description for this item, or leave repeated descriptions blank.");
      if(row.active!==undefined&&row.active!==active)issue(row.number,"Active","Use the same Active setting for this item, or leave repeated settings blank.");
    }
    if(issues.length!==before)continue;
    const candidate={name:first.name,category:first.category,priceCents:first.priceCents,unit:first.unit,packWeightGrams:first.packWeightGrams,description,active,
      variations:hasVariations?group.map(row=>({name:row.variation,priceCents:row.priceCents,unit:row.unit,packWeightGrams:row.packWeightGrams})):[]};
    const validated=menuSchema.safeParse(candidate);
    if(!validated.success){
      for(const error of validated.error.issues){
        const variant=error.path[0]==="variations"&&typeof error.path[1]==="number"?group[error.path[1]]:undefined;
        const key=String(error.path.at(-1)??"");const field=key==="priceCents"?"Price":key==="packWeightGrams"||error.message.startsWith("For packs")?"Pack weight (g)":key==="category"?"Food group":key==="unit"?"Unit":key==="description"?"Description":variant?"Variation":"Item name";
        issue(variant?.number??first.number,field,error.message);
      }
    }else items.push({data:validated.data,rows:group.map(row=>row.number)});
  }
  items.sort((a,b)=>a.data.name.localeCompare(b.data.name,"en",{numeric:true,sensitivity:"base"})||a.data.category.localeCompare(b.data.category));
  issues.sort((a,b)=>a.row-b.row);
  return {items,issues,rowCount:dataRows.length};
}

export function planMenuImport(result:MenuImportResult,existing:MenuItem[]){
  const known=new Set(existing.map(menuIdentity));
  return result.items.map(item=>({...item,status:known.has(menuIdentity(item.data))?"existing" as const:"new" as const}));
}
