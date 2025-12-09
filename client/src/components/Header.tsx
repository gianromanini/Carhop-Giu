import { Car, Menu, Phone, X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { useState } from "react";
import { Link } from "wouter";

interface HeaderProps {
  onManageBooking?: () => void;
}

export function Header({ onManageBooking }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showChatLabel, setShowChatLabel] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/" data-testid="link-home">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
                <Car className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl hidden sm:block">CarHop</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <a 
              href="tel:(475) 449-8622" 
              className="flex items-center gap-2 text-sm text-muted-foreground hover-elevate px-2 py-1 rounded-md"
              data-testid="link-phone"
            >
              <Phone className="h-4 w-4" />
              <span>(475) 449-8622</span>
            </a>
            <Button 
              variant="ghost" 
              onClick={onManageBooking}
              data-testid="button-manage-booking"
            >
              Manage Booking
            </Button>
            <Button 
              variant="outline"
              data-testid="button-login"
            >
              Sign In
            </Button>
            <ThemeToggle />
          </div>

          <div className="flex md:hidden items-start justify-between gap-2 flex-1 pl-2">
            <div className="flex flex-col items-center gap-1">
              <ThemeToggle />
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onMouseEnter={() => setShowChatLabel(true)}
                  onMouseLeave={() => setShowChatLabel(false)}
                  onClick={() => {}}
                  data-testid="button-chat-mobile"
                  className="hover-elevate"
                >
                  <MessageCircle className="h-5 w-5" />
                </Button>
                {showChatLabel && (
                  <div className="absolute top-full mt-1 right-0 bg-foreground text-background px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                    Chat / Support
                  </div>
                )}
              </div>
            </div>
            <Button 
              variant="outline"
              size="sm"
              data-testid="button-login-mobile"
              className="flex-shrink-0"
            >
              Sign In
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t space-y-2">
            <a 
              href="tel:(475) 449-8622" 
              className="flex items-center gap-2 px-2 py-2 text-sm hover-elevate rounded-md"
              data-testid="link-phone-mobile"
            >
              <Phone className="h-4 w-4" />
              <span>(475) 449-8622</span>
            </a>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => {
                onManageBooking?.();
                setMobileMenuOpen(false);
              }}
              data-testid="button-manage-booking-mobile"
            >
              Manage Booking
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
