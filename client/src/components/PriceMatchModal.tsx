import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Shield, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { addDays } from "date-fns";

interface PriceMatchModalProps {
  trigger?: React.ReactNode;
  vehicleName?: string;
  currentPrice?: number;
}

export function PriceMatchModal({ trigger, vehicleName, currentPrice }: PriceMatchModalProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [competitorName, setCompetitorName] = useState("");
  const [competitorPrice, setCompetitorPrice] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const { toast } = useToast();

  const priceMatchMutation = useMutation({
    mutationFn: async () => {
      const pickupDate = new Date();
      const returnDate = addDays(pickupDate, 3);
      
      const res = await apiRequest("POST", "/api/price-match", {
        customerEmail,
        competitorName,
        competitorPrice: parseFloat(competitorPrice),
        vehicleType: vehicleName || "Economy",
        pickupDate: pickupDate.toISOString(),
        returnDate: returnDate.toISOString(),
        proofUrl: competitorUrl || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Price Match Request Submitted",
        description: "We'll review your request and respond within 24 hours.",
      });
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    priceMatchMutation.mutate();
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setSubmitted(false);
      setCustomerEmail("");
      setCompetitorName("");
      setCompetitorPrice("");
      setCompetitorUrl("");
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" data-testid="button-price-match-trigger">
            <Shield className="h-4 w-4 mr-2" />
            Price Match
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {!submitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Host and Rent For The Best Prices
              </DialogTitle>
              <DialogDescription>
                Found a lower price? We'll match it or beat it! Submit the competitor's offer 
                and we'll review within 24 hours.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {vehicleName && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Requesting match for:</p>
                  <p className="font-medium">{vehicleName}</p>
                  {currentPrice && (
                    <p className="text-sm">Our price: <span className="font-semibold">${currentPrice}/day</span></p>
                  )}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Your Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                  data-testid="input-customer-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="competitor">Competitor Name</Label>
                <Input
                  id="competitor"
                  placeholder="e.g., Enterprise, Hertz"
                  value={competitorName}
                  onChange={(e) => setCompetitorName(e.target.value)}
                  required
                  data-testid="input-competitor-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="price">Competitor Price (per day)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="price"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="25.00"
                    className="pl-7"
                    value={competitorPrice}
                    onChange={(e) => setCompetitorPrice(e.target.value)}
                    required
                    data-testid="input-competitor-price"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="url">Link to Offer (optional)</Label>
                <Textarea
                  id="url"
                  placeholder="Paste the URL or booking details..."
                  value={competitorUrl}
                  onChange={(e) => setCompetitorUrl(e.target.value)}
                  rows={2}
                  data-testid="input-competitor-url"
                />
              </div>
              
              <p className="text-xs text-muted-foreground">
                * Price match applies to identical vehicle class, dates, and location. 
                Subject to verification.
              </p>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={priceMatchMutation.isPending}
                  data-testid="button-submit-price-match"
                >
                  {priceMatchMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle>Request Submitted!</DialogTitle>
            <DialogDescription>
              We've received your price match request. Our team will review it and 
              respond to you within 24 hours.
            </DialogDescription>
            <Button onClick={handleClose} className="mt-4" data-testid="button-close-success">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
