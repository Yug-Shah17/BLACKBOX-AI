"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";

interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export function WorkspaceTabs({ items, value, onChange, label, children }: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: ReactNode;
}) {
  const id = useId();

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    document.getElementById(`${id}-tab-${items[next].id}`)?.focus();
    onChange(items[next].id);
  }

  return <>
    <div className="workspace-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => <button
        key={item.id}
        id={`${id}-tab-${item.id}`}
        type="button"
        role="tab"
        aria-selected={value === item.id}
        aria-controls={`${id}-panel`}
        tabIndex={value === item.id ? 0 : -1}
        onClick={() => onChange(item.id)}
        onKeyDown={event => navigate(event, index)}
        className={value === item.id ? "active" : ""}
      >{item.icon}{item.label}{item.count ? <span className="count">{item.count}</span> : null}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${value}`} tabIndex={0}>
      {children}
    </div>
  </>;
}
