import { Check } from "lucide-react";
import { prettyDate, summarizeOrderCategories, type Category, type Order } from "../lib/domain";

type Props = {
  orders: readonly Order[];
  categories: readonly Category[];
  selected: string;
  onSelect: (id: string) => void;
};

export default function OrderCategoryBoxes({ orders, categories, selected, onSelect }: Props) {
  const options: { id: string; count: number; firstOrder?: Order }[] = [
    { id: "All", count: orders.length },
    ...summarizeOrderCategories(orders),
  ];
  if (!options.some(option => option.id === selected)) {
    options.push({ id: selected, count: 0 });
  }

  return (
    <div className="order-category-boxes" role="group" aria-label="Filter orders by category">
      {options.map(({ id, count, firstOrder }) => {
        const name = id === "All" ? "All" : categories.find(category => category.id === id)?.name ?? "Uncategorised";
        return (
          <button key={id} type="button" className="order-category-box" aria-pressed={id === selected} onClick={() => onSelect(id)}>
            <span className="order-category-box-title">
              <strong>{name}</strong>
              {id === selected && <Check size={15} aria-hidden="true" />}
            </span>
            <span className="order-category-box-count">{count} {count === 1 ? "order" : "orders"}</span>
            {firstOrder && <span className="order-category-box-due">{prettyDate(firstOrder.date)} · {firstOrder.time}</span>}
          </button>
        );
      })}
    </div>
  );
}
