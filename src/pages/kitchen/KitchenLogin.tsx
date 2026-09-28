import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ChefHat, Monitor, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { users } from "@/lib/mockData";
import { toast } from "sonner";

export default function KitchenLogin() {
    const navigate = useNavigate();
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");

    // Find default kitchen user
    const kitchenUser = users.find(u => u.role === 'kitchen') || users[0];

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (/^[0-9]$/.test(e.key)) {
                handlePinChange(e.key);
            } else if (e.key === "Backspace") {
                handleDelete();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [pin]);

    const handlePinChange = (digit: string) => {
        if (pin.length < 4) {
            const newPin = pin + digit;
            setPin(newPin);
            setError("");

            if (newPin.length === 4) {
                if (kitchenUser.pin === newPin) {
                    localStorage.setItem('currentUser', JSON.stringify(kitchenUser));
                    toast.success("Login successful!", {
                        description: `Welcome to the Kitchen Display System`,
                    });
                    navigate('/kitchen/display');
                } else {
                    setError("Invalid PIN. Please try again.");
                    setTimeout(() => setPin(""), 500);
                }
            }
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
        setError("");
    };

    return (
        <div className="min-h-screen gradient-cream flex flex-col items-center justify-center p-4 overflow-hidden">
            {/* Header / Branding */}
            <div className="text-center mb-4 animate-in fade-in zoom-in duration-700">
                <div className="inline-flex items-center justify-center h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-white shadow-warm mb-3 p-1 overflow-hidden border-2 border-primary/10">
                    <img src="/logos/logo1white.jfif" alt="Ama Bakery Logo" className="h-full w-full object-cover" />
                </div>
                <h1 className="text-2xl md:text-3xl font-rockwell tracking-tight text-slate-800 mb-1">Ama Bakery</h1>
                <p className="text-orange-500 text-[10px] font-black uppercase tracking-[0.3em] mt-0.5 bg-orange-50 px-3 py-0.5 rounded-full inline-block border border-orange-100">Kitchen Terminal</p>
            </div>

            {/* PIN Entry Card */}
            <div className="w-full max-w-sm animate-slide-up">
                <div className="card-elevated p-6 md:p-8 border-4 border-white flex flex-col items-center shadow-2xl shadow-orange-900/5">
                    <div className="flex items-center justify-center gap-2 mb-6">
                        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                            <ChefHat className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                            <h2 className="font-black text-slate-800 text-sm leading-none">Kitchen Access</h2>
                            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">Enter PIN to Unlock</p>
                        </div>
                    </div>

                    {/* PIN Dots */}
                    <div className="flex justify-center gap-4 mb-6">
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={`h-4 w-4 rounded-full border-2 transition-all duration-300 ${i < pin.length
                                    ? error ? 'bg-destructive border-destructive scale-110 shadow-lg shadow-destructive/20' : 'bg-orange-500 border-orange-500 scale-110 shadow-lg shadow-orange-500/20'
                                    : 'bg-white border-slate-200'
                                    }`}
                            />
                        ))}
                    </div>

                    {error && (
                        <div className="mb-4 p-2 bg-destructive/5 border border-destructive/10 rounded-xl w-full animate-in fade-in slide-in-from-top-2">
                            <p className="text-destructive text-[10px] font-black uppercase tracking-widest text-center">{error}</p>
                        </div>
                    )}

                    {/* Number Pad */}
                    <div className="grid grid-cols-3 gap-3 w-full">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((item, index) => (
                            <Button
                                key={index}
                                variant={item === 'del' ? 'outline' : 'secondary'}
                                className={`h-14 md:h-16 text-xl font-black rounded-[1.25rem] transition-all active:scale-90 ${item === 'del'
                                    ? 'bg-white border-2 hover:bg-slate-50'
                                    : item === null
                                        ? 'bg-transparent opacity-0 cursor-default pointer-events-none'
                                        : 'bg-slate-50/50 hover:bg-white hover:text-orange-600 hover:shadow-xl border-2 border-transparent hover:border-orange-100'
                                    }`}
                                onClick={() => {
                                    if (item === 'del') {
                                        handleDelete();
                                    } else if (item !== null) {
                                        handlePinChange(item.toString());
                                    }
                                }}
                            >
                                {item === 'del' ? <Delete className="h-5 w-5" /> : item}
                            </Button>
                        ))}
                    </div>

                    {/* Keyboard Hint */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 opacity-40 w-full">
                        <Monitor className="h-3 w-3 text-slate-400" />
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Physical Numpad Enabled</span>
                    </div>
                </div>
            </div>

            {/* Back Button */}
            <Button
                variant="ghost"
                className="mt-6 font-black text-[9px] uppercase tracking-widest text-slate-400 hover:text-orange-500 transition-all hover:bg-white/50 rounded-full px-6 py-2"
                onClick={() => navigate('/')}
            >
                ← Exit System
            </Button>
        </div>
    );
}
