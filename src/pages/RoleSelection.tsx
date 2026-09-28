import { useNavigate } from "react-router-dom";
import { ChefHat, UtensilsCrossed, Monitor, ShieldCheck } from "lucide-react";

export default function RoleSelection() {
  const navigate = useNavigate();

  const roles = [
    {
      id: 'waiter',
      title: 'Waiter',
      description: 'Mobile Table Service',
      icon: UtensilsCrossed,
      path: '/waiter',
      color: 'bg-amber-100 text-amber-700',
    },
    {
      id: 'counter',
      title: 'Counter POS',
      description: 'Takeaway & Billing',
      icon: Monitor,
      path: '/counter',
      color: 'bg-blue-100 text-blue-700',
    },
    {
      id: 'kitchen',
      title: 'Kitchen',
      description: 'Order Display System',
      icon: ChefHat,
      path: '/kitchen',
      color: 'bg-orange-100 text-orange-700',
    },
    {
      id: 'admin',
      title: 'Admin',
      description: 'Dashboard & Reports',
      icon: ShieldCheck,
      path: '/admin',
      color: 'bg-stone-100 text-stone-700',
    },
  ];

  return (
    <div className="min-h-screen gradient-cream flex flex-col items-center justify-center p-4 md:p-8 relative overflow-y-auto">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white/60 to-transparent opacity-50 -z-10" />

      <div className="w-full max-w-7xl flex flex-col items-center z-10 py-12 md:py-0">

        {/* Brand Section */}
        <div className="text-center mb-8 md:mb-10 animate-in fade-in zoom-in duration-700">
          <div className="relative inline-block group cursor-pointer mb-6">
            <img
              src="/logos/logo1white.jfif"
              alt="Ama Bakery Logo"
              className="relative h-24 w-24 md:h-28 md:w-28 rounded-[2rem] mb-4 object-cover border-4 border-white transform transition-all duration-500 group-hover:scale-105 group-hover:rotate-2"
            />
          </div>
          <h1 className="text-3xl md:text-5xl font-rockwell text-slate-800 tracking-tight mb-3">
            Ama Bakery
          </h1>
          <p className="text-sm md:text-lg text-primary/60 font-black uppercase tracking-[0.3em] bg-primary/5 px-6 py-1.5 rounded-full inline-block">
            Management Suite
          </p>
        </div>

        {/* Roles Grid - 4 in 1 row on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full animate-in slide-in-from-bottom-8 duration-700 delay-150">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => navigate(role.path)}
              className="group relative flex flex-col items-center p-6 md:p-8 bg-white rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:shadow-primary/10 border-4 border-white hover:border-primary/20 transition-all duration-300 hover:-translate-y-2 active:scale-95"
            >
              <div className={`h-16 w-16 md:h-20 md:w-20 rounded-[1.5rem] ${role.color} flex items-center justify-center mb-5 md:mb-6 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-lg group-hover:shadow-current/20`}>
                <role.icon className="h-8 w-8 md:h-10 md:w-10" strokeWidth={1.5} />
              </div>

              <h3 className="text-lg md:text-xl font-black text-slate-800 mb-3 group-hover:text-primary transition-colors">
                {role.title}
              </h3>

              <p className="text-slate-400 text-xs md:text-sm font-bold uppercase tracking-widest text-center leading-relaxed">
                {role.description}
              </p>

              {/* Hover Indicator */}
              <div className="mt-8 h-1 w-12 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-0 group-hover:w-full bg-primary transition-all duration-500" />
              </div>
            </button>
          ))}
        </div>

      </div>

      {/* Footer */}
      <footer className="mt-20 text-center w-full">
        <p className="text-slate-300 text-[10px] md:text-xs tracking-[0.4em] font-black uppercase">
          Secure Terminal • v2.0
        </p>
      </footer>
    </div>
  );
}
