import { Check, Clock, CreditCard, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PaymentComparisonProps {
  pricePerDay: number;
  payNowPrice: number;
  days: number;
  selected: "now" | "later";
  onSelect: (option: "now" | "later") => void;
}

export function PaymentComparison({
  pricePerDay,
  payNowPrice,
  days,
  selected,
  onSelect,
}: PaymentComparisonProps) {
  const payLaterTotal = pricePerDay * days;
  const payNowTotal = payNowPrice * days;
  const totalSavings = payLaterTotal - payNowTotal;

  const payNowBenefits = [
    "Lowest guaranteed price",
    "Priority vehicle pickup",
    "Free upgrade when available",
    "Locked-in rate protection",
  ];

  const payLaterBenefits = [
    "Pay at pickup counter",
    "Cancel anytime for free",
    "Flexible date changes",
  ];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card
        className={`cursor-pointer transition-all ${
          selected === "now"
            ? "ring-2 ring-primary border-primary"
            : "hover-elevate"
        }`}
        onClick={() => onSelect("now")}
        data-testid="card-pay-now"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              Pay Now
            </CardTitle>
            <Badge className="bg-primary text-primary-foreground">
              <DollarSign className="h-3 w-3 mr-1" />
              Save ${totalSavings.toFixed(2)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="font-display text-3xl font-bold text-primary" data-testid="text-pay-now-total">
              ${payNowTotal.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              ${payNowPrice}/day x {days} days
            </div>
          </div>
          
          <ul className="space-y-2">
            {payNowBenefits.map((benefit, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600 shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          
          <Button
            className="w-full"
            variant={selected === "now" ? "default" : "outline"}
            data-testid="button-select-pay-now"
          >
            {selected === "now" ? "Selected" : "Select Pay Now"}
          </Button>
        </CardContent>
      </Card>

      <Card
        className={`cursor-pointer transition-all ${
          selected === "later"
            ? "ring-2 ring-primary border-primary"
            : "hover-elevate"
        }`}
        onClick={() => onSelect("later")}
        data-testid="card-pay-later"
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Pay Later
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="font-display text-3xl font-bold" data-testid="text-pay-later-total">
              ${payLaterTotal.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              ${pricePerDay}/day x {days} days
            </div>
          </div>
          
          <ul className="space-y-2">
            {payLaterBenefits.map((benefit, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          
          <Button
            className="w-full"
            variant={selected === "later" ? "default" : "outline"}
            data-testid="button-select-pay-later"
          >
            {selected === "later" ? "Selected" : "Select Pay Later"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
