import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, ArrowRight, Lock, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { users } from "@/lib/mockData";
import { toast } from "sonner";

export default function WaiterLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"username" | "pin">("username");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState<typeof users[0] | null>(null);

  // Keyboard support for PIN step
  useEffect(() => {
    if (step === "pin") {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (/^[0-9]$/.test(e.key)) {
          handlePinChange(e.key);
        } else if (e.key === "Backspace") {
          handleDelete();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [step, pin, selectedUser]);

  // Step 1: Username validation
  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    const user = users.find(
      u => u.role === 'waiter' && u.name.toLowerCase() === username.toLowerCase()
    );

    if (user) {
      setSelectedUser(user);
      setStep("pin");
      setError("");
      toast.success(`Welcome ${user.name}!`, {
        description: "Please enter your PIN",
      });
    } else {
      setError("Username not found. Try 'Rahul' or 'Priya'");
    }
  };

  // Step 2: PIN validation
  const handlePinChange = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError("");

      if (newPin.length === 4) {
        if (selectedUser && selectedUser.pin === newPin) {
          localStorage.setItem('currentWaiter', JSON.stringify(selectedUser));
          toast.success("Login successful!", {
            description: `Welcome back, ${selectedUser.name}!`,
          });
          navigate('/waiter/tables');
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

  const handleBackToUsername = () => {
    setStep("username");
    setUsername("");
    setPin("");
    setError("");
    setSelectedUser(null);
  };

  return (
    <div className="min-h-screen gradient-cream flex flex-col p-6">
      {/* Header - Mobile Friendly */}
      <header className="pt-12 pb-10 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white shadow-warm mb-3 p-1 overflow-hidden">
          <img src="/logos/logo1white.jfif" alt="Ama Bakery Logo" className="h-full w-full object-cover" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Ama Bakery</h1>
        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1">Waiter Login</p>
      </header>

      {/* Main Content - Centered for Mobile Context */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full pb-20">
        {step === "username" ? (
          // Step 1: Username Entry (Mobile Style)
          <div className="card-elevated p-8 w-full animate-slide-up border-4 border-white">
            <div className="flex items-center justify-center gap-2 mb-6 text-slate-700">
              <User className="h-5 w-5 text-primary" />
              <span className="font-bold">Staff Username</span>
            </div>

            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                className="h-14 text-center text-xl font-bold bg-slate-50 border-none"
                autoFocus
              />

              {error && (
                <p className="text-destructive text-xs font-bold text-center">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full h-14 text-lg font-bold gradient-warm shadow-warm-lg transition-all active:scale-95"
              >
                Continue
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>

              <p className="text-[10px] text-slate-300 text-center font-black uppercase tracking-widest mt-4">
                Rahul • Priya
              </p>
            </form>
          </div>
        ) : (
          // Step 2: PIN Entry (Large Mobile Numbers)
          <div className="card-elevated p-8 w-full animate-slide-up border-4 border-white">
            <div className="flex items-center justify-center gap-2 mb-2 text-slate-700">
              <Lock className="h-5 w-5 text-primary" />
              <span className="font-bold">Enter PIN</span>
            </div>

            {selectedUser && (
              <p className="text-sm text-primary font-bold text-center mb-6 uppercase tracking-wider">
                {selectedUser.name}
              </p>
            )}

            {/* PIN Dots */}
            <div className="flex justify-center gap-4 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-4 w-4 rounded-full border-2 transition-all ${i < pin.length
                    ? error ? 'bg-destructive border-destructive' : 'bg-primary border-primary'
                    : 'bg-white border-slate-200'
                    }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-destructive text-[10px] font-bold text-center mb-4">{error}</p>
            )}

            {/* Number Pad - Optimized for Thumb Reach */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((item, index) => (
                <Button
                  key={index}
                  variant={item === 'del' ? 'outline' : 'secondary'}
                  className={`h-14 rounded-xl text-xl font-black ${item === 'del' ? 'bg-white' : 'bg-slate-50 hover:bg-slate-100 active:scale-90 transition-all'
                    }`}
                  disabled={item === null}
                  onClick={() => {
                    if (item === 'del') {
                      handleDelete();
                    } else if (item !== null) {
                      handlePinChange(item.toString());
                    }
                  }}
                >
                  {item === 'del' ? '⌫' : item === null ? '' : item}
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              className="w-full text-xs font-bold text-slate-400"
              onClick={handleBackToUsername}
            >
              ← Change User
            </Button>

            <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-center gap-2 opacity-30">
              <Keyboard className="h-3 w-3" />
              <span className="text-[8px] font-black uppercase tracking-widest">Supports Physical Numpad</span>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          className="mt-8 font-black text-[10px] uppercase tracking-widest text-slate-300"
          onClick={() => navigate('/')}
        >
          ← Interface Selection
        </Button>
      </main>
    </div>
  );
}
