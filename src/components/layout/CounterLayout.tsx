import { useState } from "react";
import { Outlet } from "react-router-dom";
import { CounterSidebar } from "./CounterSidebar";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function CounterLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 h-full shrink-0 shadow-2xl z-20">
        <CounterSidebar />
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <div className="lg:hidden fixed top-4 left-4 z-[60]">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-white shadow-lg border-slate-100">
              <Menu className="h-5 w-5 text-slate-600" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 border-none">
            <CounterSidebar onNavigate={() => setIsMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 h-full relative overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
