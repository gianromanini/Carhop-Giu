import { useState } from "react";
import { PaymentComparison } from "../PaymentComparison";
import { ThemeProvider } from "../ThemeProvider";

export default function PaymentComparisonExample() {
  const [selected, setSelected] = useState<"now" | "later">("now");

  return (
    <ThemeProvider>
      <div className="p-6 max-w-2xl bg-background">
        <PaymentComparison
          pricePerDay={35}
          payNowPrice={29}
          days={3}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </ThemeProvider>
  );
}
