import { useState, type InputHTMLAttributes } from "react";
import { parseDecimal } from "../lib/pricing";

// type="number" rejects a comma on Indonesian iOS keyboards, so prices use a text field
// with a decimal keypad and keep the typed text until the field loses focus.
export function DecimalInput({
  value,
  onValue,
  onBlur,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "type" | "onChange"> & {
  value: number | null | undefined;
  onValue: (n: number) => void;
}) {
  // While focused, show exactly what was typed ("14," mid-entry); otherwise show the value.
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={text ?? (value ? String(value) : "")}
      onFocus={() => setText(value ? String(value) : "")}
      onChange={(e) => {
        setText(e.target.value);
        onValue(parseDecimal(e.target.value));
      }}
      onBlur={(e) => {
        setText(null);
        onBlur?.(e);
      }}
    />
  );
}
