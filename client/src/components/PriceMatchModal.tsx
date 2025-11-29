import { useState } from "react";
import { Shield, Check } from "lucide-react";
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

interface PriceMatchModalProps {
  trigger?: React.ReactNode;
  vehicleName?: string;
  currentPrice?: number;
}

export function PriceMatchModal({ trigger, vehicleName, currentPrice }: PriceMatchModalProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [competitorName, setCompetitorName] = useState("");
  const [competitorPrice, setCompetitorPrice] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Price match request:", { competitorName, competitorPrice, competitorUrl, vehicleName });
    setSubmitted(true);
    toast({
      title: "Price Match Request Submitted",
      description: "We'll review your request and respond within 24 hours.",
    });
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setSubmitted(false);
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
                Price Match Guarantee
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
                <Button type="submit" data-testid="button-submit-price-match">
                  Submit Request
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
