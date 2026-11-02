import { type LineItem, quantityLabel, lineWeightGrams, weightLabel } from "../lib/domain";

export default function ItemQuantity({item}:{item:Pick<LineItem,"quantity"|"unit"|"packWeightGrams">}){
  return <span className={"item-quantity "+(item.packWeightGrams?"packed-quantity":"")}><strong>{quantityLabel(item)}</strong>{!!item.packWeightGrams&&<small>{weightLabel(lineWeightGrams(item))} total</small>}</span>;
}
