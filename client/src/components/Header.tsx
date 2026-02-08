import { Car, Menu, Phone, X, MessageCircle, MoreVertical, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps {
  onManageBooking?: () => void;
  onSignIn?: () => void;
  onChat?: () => void;
  isLoggedIn?: boolean;
}

export function Header({ onManageBooking, onSignIn, onChat }: HeaderProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileActionsMenuOpen, setMobileActionsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/" data-testid="link-home">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/logo.png" alt="CarHop Logo" className="h-10 w-auto object-contain" />
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
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {user.firstName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden lg:block">
                    {user.firstName || user.email?.split('@')[0]}
                  </span>
                </div>
                <Button 
                  variant="ghost"
                  size="icon"
                  onClick={() => window.location.href = '/api/logout'}
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-login"
              >
                Sign In
              </Button>
            )}
            <ThemeToggle />
          </div>

          <div className="flex md:hidden items-center justify-end gap-2 flex-1">
            {isAuthenticated && (
              <Button 
                variant="ghost"
                size="sm"
                onClick={onManageBooking}
                data-testid="button-bookings-mobile"
              >
                Bookings
              </Button>
            )}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileActionsMenuOpen(!mobileActionsMenuOpen)}
                data-testid="button-actions-menu"
                className="h-8 w-8 p-0"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
              {mobileActionsMenuOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 min-w-[150px] overflow-hidden">
                  {isAuthenticated && user ? (
                    <>
                      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {user.firstName?.charAt(0) || user.email?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {user.firstName || user.email?.split('@')[0]}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          window.location.href = '/api/logout';
                          setMobileActionsMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                        data-testid="button-menu-signout"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        window.location.href = '/api/login';
                        setMobileActionsMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                      data-testid="button-menu-signin"
                    >
                      <User className="h-4 w-4" />
                      Sign In
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onChat?.();
                      setMobileActionsMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800"
                    data-testid="button-menu-chat"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Chat / Support
                  </button>
                  <div className="border-t border-zinc-200 dark:border-zinc-800 p-2 flex items-center justify-center">
                    <ThemeToggle className="h-6 w-6 p-0" iconSize={14} />
                  </div>
                </div>
              )}
            </div>
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
