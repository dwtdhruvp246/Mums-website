const collator=new Intl.Collator("en",{sensitivity:"base",numeric:true});

/** Sort display labels without changing the stored records or selections. */
export function alphabetical<T>(items:readonly T[],label:(item:T)=>string=String):T[]{
  return [...items].sort((a,b)=>collator.compare(label(a).trim(),label(b).trim()));
}
