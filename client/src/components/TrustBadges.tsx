import { Phone, Shield, Check, Calendar } from "lucide-react";

const badges = [
  {
    icon: Phone,
    title: "24/7 Support",
    description: "Always here to help",
  },
  {
    icon: Shield,
    title: "Price Match",
    description: "Guaranteed lowest price",
  },
  {
    icon: Check,
    title: "No Hidden Fees",
    description: "Transparent pricing",
  },
  {
    icon: Calendar,
    title: "Free Cancellation",
    description: "Up to 24 hours before",
  },
];

export function TrustBadges() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {badges.map((badge, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center p-4"
              data-testid={`trust-badge-${index}`}
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <badge.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{badge.title}</h3>
              <p className="text-sm text-muted-foreground">{badge.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
