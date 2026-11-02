"use client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Check, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Upload, X } from "lucide-react";
import { money, weightLabel, type MenuItem } from "../lib/domain";
import { MENU_IMPORT_MAX_BYTES, planMenuImport, readMenuWorkbook, type MenuImportResult, type NewMenuItem } from "../lib/menu-import";

export default function MenuBulkImport({items,currency,saving,saveError,onImport}:{items:MenuItem[];currency:string;saving:boolean;saveError:string;onImport:(items:NewMenuItem[])=>Promise<boolean>}){
  const input=useRef<HTMLInputElement>(null),readVersion=useRef(0),submitting=useRef(false);
  const [reading,setReading]=useState(false),[fileName,setFileName]=useState(""),[fileError,setFileError]=useState("");
  const [result,setResult]=useState<MenuImportResult|null>(null),[failed,setFailed]=useState(false);
  const [success,setSuccess]=useState<{added:number;skipped:number;archived:number}|null>(null);
  const plan=useMemo(()=>result?planMenuImport(result,items):[],[result,items]);
  const newItems=plan.filter(item=>item.status==="new"),skipped=plan.length-newItems.length;
  useEffect(()=>()=>{readVersion.current++;},[]);

  async function chooseFile(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value="";if(!file)return;
    const version=++readVersion.current;setReading(true);setFileName(file.name);setFileError("");setResult(null);setFailed(false);setSuccess(null);
    try{
      if(file.size>MENU_IMPORT_MAX_BYTES)throw new Error("Choose an .xlsx file smaller than 2 MB with up to 500 rows.");
      const parsed=await readMenuWorkbook(await file.arrayBuffer(),file.name);
      if(readVersion.current===version)setResult(parsed);
    }catch(error){if(readVersion.current===version)setFileError(error instanceof Error?error.message:"This file could not be read. Try a fresh copy of the template.");}
    finally{if(readVersion.current===version)setReading(false);}
  }
  function clear(){readVersion.current++;setResult(null);setFileName("");setFileError("");setFailed(false);}
  async function confirm(){
    if(submitting.current||reading||saving||!result||result.issues.length||!newItems.length)return;
    submitting.current=true;setFailed(false);
    const summary={added:newItems.length,skipped,archived:newItems.filter(item=>!item.data.active).length};
    try{
      if(await onImport(newItems.map(item=>item.data))){clear();setSuccess(summary);}
      else setFailed(true);
    }catch{setFailed(true);}
    finally{submitting.current=false;}
  }

  return <section className="panel menu-import-panel" aria-label="Excel bulk menu import">
    <div className="menu-import-header"><div className="menu-import-heading"><span className="icon-soft"><FileSpreadsheet size={21}/></span><div><h2>Add menu items from Excel</h2><p>Fill the template, upload it and review your items. Sizes and variations are supported.</p></div></div>
      <div className="menu-import-actions"><a className="button secondary" href="./menu-import-template.xlsx" download="Catering-Desk-Menu-Template.xlsx"><Download size={16}/> Download template</a><button className="button primary" type="button" disabled={reading||saving} onClick={()=>input.current?.click()}>{reading?<LoaderCircle size={16} className="spin"/>:<Upload size={16}/>} {reading?"Reading Excel…":"Upload Excel"}</button><input ref={input} hidden type="file" accept=".xlsx" aria-label="Choose menu Excel file" onChange={event=>void chooseFile(event)}/></div>
    </div>
    <p className="menu-import-help">Up to 500 rows per file. Prices use {currency}. Items with the same name and food group already in your menu are skipped.</p>
    {reading&&<p className="menu-import-file" role="status">Reading {fileName}…</p>}
    {fileError&&<div className="form-error menu-import-error" role="alert"><strong>{fileName}</strong><p>{fileError}</p></div>}
    {success&&<div className="menu-import-success" role="status"><CheckCircle2 size={20}/><div><strong>{success.added} menu {success.added===1?"item":"items"} imported</strong><p>{success.skipped?`${success.skipped} existing ${success.skipped===1?"item was":"items were"} skipped. `:""}{success.archived?`${success.archived} imported ${success.archived===1?"item is":"items are"} archived.`:"Your menu is up to date."}</p></div></div>}
    {result&&<div className="menu-import-review">
      <div className="menu-import-review-heading"><div><h3>Review your import</h3><p className="menu-import-file">{fileName} · {result.rowCount} {result.rowCount===1?"row":"rows"} checked</p></div><button className="text-button" type="button" onClick={clear} disabled={saving}><X size={14}/> Clear file</button></div>
      <div className="menu-import-counts" aria-live="polite"><span><strong>{newItems.length}</strong> new {newItems.length===1?"item":"items"}</span><span><strong>{skipped}</strong> already in menu</span><span className={result.issues.length?"has-issues":""}><strong>{result.issues.length}</strong> {result.issues.length===1?"issue":"issues"}</span></div>
      {result.issues.length>0&&<div className="menu-import-issues"><p role="alert"><strong>Fix these rows in Excel and upload the file again.</strong>{result.issues.length>30?` Showing the first 30 of ${result.issues.length} issues.`:""}</p><div className="menu-import-scroll issue-scroll"><table className="menu-import-table"><thead><tr><th>Row</th><th>Column</th><th>What to fix</th></tr></thead><tbody>{result.issues.slice(0,30).map((issue,index)=><tr key={index}><td>{issue.row}</td><td>{issue.field}</td><td>{issue.message}</td></tr>)}</tbody></table></div></div>}
      {plan.length>0&&<div className="menu-import-scroll"><table className="menu-import-table"><thead><tr><th>Item / food group</th><th>Price / variations</th><th>Import</th></tr></thead><tbody>{plan.map(item=><tr key={item.rows.join(",")}><td><strong>{item.data.name}</strong><small>{item.data.category} · Excel {item.rows.length===1?"row":"rows"} {item.rows.join(", ")}</small>{item.status==="new"&&!item.data.active&&<span className="menu-import-status archived">Archived</span>}</td><td>{item.status==="existing"?<span>Existing item kept</span>:item.data.variations.length?<div className="menu-import-options">{item.data.variations.map(variation=><div key={variation.name}><strong>{variation.name}</strong><span>{money(variation.priceCents,currency)} / {variation.unit}{variation.packWeightGrams?" · "+weightLabel(variation.packWeightGrams)+" each":""}</span></div>)}</div>:<><span>{money(item.data.priceCents,currency)} / {item.data.unit}</span>{item.data.packWeightGrams&&<small>{weightLabel(item.data.packWeightGrams)} per {item.data.unit}</small>}</>}</td><td><span className={"menu-import-status "+(item.status==="new"?"new":"existing")}>{item.status==="new"?"New item":"Skip existing"}</span></td></tr>)}</tbody></table></div>}
      {failed&&<div className="form-error menu-import-error" role="alert">{saveError||"The import could not be saved. Check your connection and try again."}</div>}
      <div className="menu-import-confirm"><p>{result.issues.length?"Correct the issues above to enable importing.":newItems.length?"Review the names, prices and variations, then import your new items.":"All items in this file are already on your menu."}</p><button className="button primary" type="button" disabled={reading||saving||Boolean(result.issues.length)||!newItems.length} onClick={()=>void confirm()}>{saving?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>} {saving?"Importing…":`Import ${newItems.length} ${newItems.length===1?"item":"items"}`}</button></div>
    </div>}
  </section>;
}
