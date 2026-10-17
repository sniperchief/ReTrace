"use client";

import { ReceiptIcon } from "./icons";
import { buttonStyles } from "./ui";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className={buttonStyles.secondary} onClick={() => window.print()}>
      <ReceiptIcon size={16} /> {label}
    </button>
  );
}
