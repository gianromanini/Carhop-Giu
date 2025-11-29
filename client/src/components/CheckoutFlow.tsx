import { useState } from "react";
import { Check, ChevronLeft, Car, User, CreditCard, Shield, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { PaymentComparison } from "./PaymentComparison";
import { useToast } from "@/hooks/use-toast";
import type { Vehicle } from "./VehicleCard";

interface CheckoutFlowProps {
  vehicle: Vehicle;
  pickupDate: Date;
  returnDate: Date;
  location: string;
  onBack: () => void;
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

export function CheckoutFlow({
  vehicle,
  pickupDate,
  returnDate,
  location,
  onBack,
  onComplete,
}: CheckoutFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [paymentOption, setPaymentOption] = useState<"now" | "later">("now");
  const [extras, setExtras] = useState({ insurance: false, gps: false, childSeat: false });
  const [driverInfo, setDriverInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    licenseNumber: "",
  });
  const { toast } = useToast();

  const days = Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24));
  const basePrice = paymentOption === "now" ? vehicle.payNowPrice : vehicle.pricePerDay;
  const extrasPrice = (extras.insurance ? 15 : 0) + (extras.gps ? 8 : 0) + (extras.childSeat ? 5 : 0);
  const totalPerDay = basePrice + extrasPrice;
  const totalPrice = totalPerDay * days;

  const steps = [
    { number: 1, title: "Reservation", icon: Car },
    { number: 2, title: "Driver Info", icon: User },
    { number: 3, title: "Payment", icon: CreditCard },
  ];

  const handleNext = () => {
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
    } else {
      toast({
        title: "Booking Confirmed!",
        description: `Your ${vehicle.name} is reserved. Confirmation sent to ${driverInfo.email}`,
      });
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as Step);
    } else {
      onBack();
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={handlePrevious} data-testid="button-back">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl font-bold">Quick Checkout</h1>
      </div>

      <div className="flex items-center justify-between mb-8 max-w-md mx-auto">
        {steps.map((s, i) => (
          <div key={s.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step >= s.number
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`step-indicator-${s.number}`}
              >
                {step > s.number ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
              </div>
              <span className="text-xs mt-1 text-muted-foreground hidden sm:block">{s.title}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-16 sm:w-24 h-0.5 mx-2 ${
                  step > s.number ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Reservation Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4 flex-wrap">
                  <img
                    src={vehicle.image}
                    alt={vehicle.name}
                    className="w-32 h-20 object-cover rounded-md"
                  />
                  <div>
                    <h3 className="font-semibold text-lg">{vehicle.name}</h3>
                    <p className="text-sm text-muted-foreground">{vehicle.category}</p>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.passengers} passengers, {vehicle.transmission}, {vehicle.luggage} bags
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium">{location || "Los Angeles Airport"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">Dates</p>
                      <p className="font-medium">
                        {pickupDate.toLocaleDateString()} - {returnDate.toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">{days} days</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Optional Extras</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="insurance"
                          checked={extras.insurance}
                          onCheckedChange={(c) => setExtras({ ...extras, insurance: !!c })}
                          data-testid="checkbox-insurance"
                        />
                        <div>
                          <Label htmlFor="insurance" className="cursor-pointer font-medium">
                            Full Coverage Insurance
                          </Label>
                          <p className="text-xs text-muted-foreground">Zero deductible protection</p>
                        </div>
                      </div>
                      <span className="font-medium">+$15/day</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="gps"
                          checked={extras.gps}
                          onCheckedChange={(c) => setExtras({ ...extras, gps: !!c })}
                          data-testid="checkbox-gps"
                        />
                        <div>
                          <Label htmlFor="gps" className="cursor-pointer font-medium">
                            GPS Navigation
                          </Label>
                          <p className="text-xs text-muted-foreground">Never get lost</p>
                        </div>
                      </div>
                      <span className="font-medium">+$8/day</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="childSeat"
                          checked={extras.childSeat}
                          onCheckedChange={(c) => setExtras({ ...extras, childSeat: !!c })}
                          data-testid="checkbox-child-seat"
                        />
                        <div>
                          <Label htmlFor="childSeat" className="cursor-pointer font-medium">
                            Child Seat
                          </Label>
                          <p className="text-xs text-muted-foreground">Safety-approved seat</p>
                        </div>
                      </div>
                      <span className="font-medium">+$5/day</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Driver Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={driverInfo.firstName}
                      onChange={(e) => setDriverInfo({ ...driverInfo, firstName: e.target.value })}
                      placeholder="John"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={driverInfo.lastName}
                      onChange={(e) => setDriverInfo({ ...driverInfo, lastName: e.target.value })}
                      placeholder="Doe"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={driverInfo.email}
                    onChange={(e) => setDriverInfo({ ...driverInfo, email: e.target.value })}
                    placeholder="john@example.com"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={driverInfo.phone}
                    onChange={(e) => setDriverInfo({ ...driverInfo, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="license">Driver's License Number</Label>
                  <Input
                    id="license"
                    value={driverInfo.licenseNumber}
                    onChange={(e) => setDriverInfo({ ...driverInfo, licenseNumber: e.target.value })}
                    placeholder="DL12345678"
                    data-testid="input-license"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Choose Payment Option</CardTitle>
                </CardHeader>
                <CardContent>
                  <PaymentComparison
                    pricePerDay={vehicle.pricePerDay + extrasPrice}
                    payNowPrice={vehicle.payNowPrice + extrasPrice}
                    days={days}
                    selected={paymentOption}
                    onSelect={setPaymentOption}
                  />
                </CardContent>
              </Card>

              {paymentOption === "now" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <Input
                        id="cardNumber"
                        placeholder="1234 5678 9012 3456"
                        data-testid="input-card-number"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiry">Expiry Date</Label>
                        <Input id="expiry" placeholder="MM/YY" data-testid="input-expiry" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cvv">CVV</Label>
                        <Input id="cvv" placeholder="123" data-testid="input-cvv" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      <span>Your payment is secure and encrypted</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <img
                  src={vehicle.image}
                  alt={vehicle.name}
                  className="w-20 h-14 object-cover rounded"
                />
                <div>
                  <p className="font-medium">{vehicle.name}</p>
                  <p className="text-sm text-muted-foreground">{days} days rental</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Base rate</span>
                  <span>${basePrice}/day x {days}</span>
                </div>
                {extras.insurance && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Insurance</span>
                    <span>$15/day x {days}</span>
                  </div>
                )}
                {extras.gps && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">GPS</span>
                    <span>$8/day x {days}</span>
                  </div>
                )}
                {extras.childSeat && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Child Seat</span>
                    <span>$5/day x {days}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-between items-end gap-2 flex-wrap">
                <span className="font-medium">Total</span>
                <div className="text-right">
                  <span className="font-display text-2xl font-bold" data-testid="text-total-price">
                    ${totalPrice.toFixed(2)}
                  </span>
                  {paymentOption === "now" && (
                    <p className="text-xs text-green-600">You save ${((vehicle.pricePerDay - vehicle.payNowPrice) * days).toFixed(2)}</p>
                  )}
                </div>
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleNext}
                data-testid="button-continue"
              >
                {step === 3 ? (paymentOption === "now" ? "Pay & Confirm" : "Confirm Booking") : "Continue"}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Free cancellation up to 24 hours before pickup
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
