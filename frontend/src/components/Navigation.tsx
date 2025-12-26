import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Link } from "react-router-dom";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { ready, authenticated, login, logout } = usePrivy();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <a href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent" />
            <span className="text-xl font-bold">Corre</span>
          </a>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {ready && authenticated ? (
              <>
                <Link to="/home">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
                <Button onClick={logout} variant="secondary">Logout</Button>
              </>
            ) : (
              <Button
                onClick={login}
                variant="default"
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                Login
              </Button>
            )}
          </div>
          
          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          <div className="px-4 py-6 space-y-4">
            {ready && authenticated ? (
              <div className="flex flex-col space-y-2">
                <Link to="/home" onClick={() => setIsOpen(false)}>
                  <Button variant="ghost" className="w-full">Dashboard</Button>
                </Link>
                <Button onClick={() => { logout(); setIsOpen(false); }} variant="secondary" className="w-full">Logout</Button>
              </div>
            ) : (
              <Button
                onClick={() => {
                  setIsOpen(false);
                  login();
                }}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                Login
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;

