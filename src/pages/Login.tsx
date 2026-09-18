import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { loginUsers, fetchMe } from "../api/index.js";

import { isLoggedIn, getCurrentUser } from "../auth/auth";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const redirectByRole = (role?: string) => {
    switch (role) {
      case "SUPER_ADMIN":
      case "ADMIN":
        navigate("/super-admin/dashboard", { replace: true });
        break;
      case "BRANCH_MANAGER":
        navigate("/admin/dashboard", { replace: true });
        break;
      case "WAITER":
        navigate("/waiter/tables", { replace: true });
        break;
      case "COUNTER":
        navigate("/counter/orders", { replace: true });
        break;
      case "KITCHEN":
        navigate("/kitchen/display", { replace: true });
        break;
      default:
        navigate("/login", { replace: true });
    }
  };

  // auto redirect if already logged in
  useEffect(() => {
    if (isLoggedIn()) {
      const user = getCurrentUser();
      if (user?.role) redirectByRole(user.role);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1) login -> save tokens
      await loginUsers(username, password);

      // 2) The tokens are already saved in localStorage by loginUsers.
      // We can now get the user info from the token.
      const user = getCurrentUser();

      if (!user?.role) {
        throw new Error("Unable to identify user role from token.");
      }

      localStorage.setItem("currentUser", JSON.stringify(user));
      if (user.role === "WAITER") {
        localStorage.setItem("currentWaiter", JSON.stringify(user));
      }

      const DEFAULT_PASSWORDS = ["amabakery@123", "123", "password"];
      if (DEFAULT_PASSWORDS.includes(password)) {
        localStorage.setItem("mustChangePassword", "true");
        localStorage.setItem("defaultPasswordUsed", password);
      } else {
        localStorage.removeItem("mustChangePassword");
        localStorage.removeItem("defaultPasswordUsed");
      }

      toast.success("Login Successful", {
        description: `Welcome, ${user?.username || username}! (${user.role})`,
      });

      redirectByRole(user.role);
    } catch (err: any) {
      const msg = err?.message || "Invalid username or password";
      setError(msg);
      toast.error("Login Failed", { description: msg });
      console.error("LOGIN ERROR:", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden bg-gradient-cream">
      {/* BRANDING SIDE */}
      <div className="w-full lg:w-1/2 relative bg-primary overflow-hidden pt-10 pb-40 flex items-start justify-center lg:py-0 lg:items-center lg:justify-center lg:rounded-none shadow-2xl lg:shadow-none z-10 transition-all duration-700">
        {/* Background Decorative Elements */}
        {/* ... (decorative elements restored in previous step) ... */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-10 -left-10 lg:top-20 lg:left-20 w-48 h-48 lg:w-96 lg:h-96 bg-white rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-10 -right-10 lg:bottom-20 lg:right-20 w-64 h-64 lg:w-[32rem] lg:h-[32rem] bg-white rounded-full blur-[100px] animate-pulse delay-700" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full p-6 lg:p-12 text-white">
          <div className="max-w-md text-center space-y-4 lg:space-y-8">
            <div className="inline-flex items-center justify-center h-28 w-28 lg:h-44 lg:w-44 rounded-full bg-white p-4 overflow-hidden mb-2 lg:mb-4 transition-transform hover:scale-105 duration-500">
              <img
                src="/logos/logo1white.jfif"
                alt="Ama Bakery Logo"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="space-y-1 lg:space-y-3">
              <h1 className="text-4xl lg:text-6xl font-rockwell font-bold tracking-tight">AMA BAKERY</h1>
              <p className="text-white/80 text-[10px] lg:text-base font-bold uppercase tracking-[0.4em]">
                Management Suite
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* LOGIN SIDE */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 md:p-8 lg:p-12 -mt-32 lg:mt-0 relative z-20">
        <div className="w-full max-w-lg lg:max-w-2xl">
          <div className="bg-white rounded-[2.5rem] lg:rounded-[3.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.12)] p-6 md:p-12 lg:p-20 lg:px-24 transition-all duration-500 hover:shadow-[0_20px_70px_rgba(0,0,0,0.18)] border border-slate-100">
            <div className="mb-6 lg:mb-12 lg:text-left text-center">
              <h2 className="text-2xl lg:text-4xl font-black text-slate-900 mb-1 lg:mb-3">Welcome Back</h2>
              <p className="text-slate-500 text-sm lg:text-base font-medium italic">Sign in to access your dashboard</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 lg:space-y-8">
              <div className="group">
                <label className="text-[10px] lg:text-xs font-black uppercase tracking-widest text-slate-400 ml-1 mb-1.5 lg:mb-2 block group-focus-within:text-primary transition-colors">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-4 lg:left-5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4 lg:h-6 lg:w-6 group-focus-within:text-primary transition-colors" />
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-12 lg:pl-16 h-12 lg:h-16 text-base lg:text-lg bg-slate-50 border-slate-100 focus:border-primary focus:bg-white transition-all rounded-xl lg:rounded-2xl"
                    placeholder="your.username"
                    required
                  />
                </div>
              </div>

              <div className="group">
                <label className="text-[10px] lg:text-xs font-black uppercase tracking-widest text-slate-400 ml-1 mb-1.5 lg:mb-2 block group-focus-within:text-primary transition-colors">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 lg:left-5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4 lg:h-6 lg:w-6 group-focus-within:text-primary transition-colors" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 lg:pl-16 pr-12 lg:pr-16 h-12 lg:h-16 text-base lg:text-lg bg-slate-50 border-slate-100 focus:border-primary focus:bg-white transition-all rounded-xl lg:rounded-2xl"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors focus:outline-none"
                  >
                    {showPassword ? (
                      <Eye className="h-5 w-5 lg:h-6 lg:w-6" />
                    ) : (
                      <EyeOff className="h-5 w-5 lg:h-6 lg:w-6" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 text-xs lg:text-sm font-semibold px-4 lg:px-6 py-3 lg:py-4 rounded-xl border border-red-100 animate-shake">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 lg:h-16 rounded-xl lg:rounded-2xl text-sm lg:text-lg font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all lg:mt-6"
              >
                {loading ? "Verifying..." : "Sign In"}
                <ArrowRight className="h-5 w-5 lg:h-6 lg:w-6 ml-2" />
              </Button>
            </form>

            <div className="mt-6 lg:mt-8 pt-6 border-t border-slate-50">
              <p className="text-[9px] lg:text-[11px] text-center text-slate-300 uppercase tracking-widest font-bold">
                Secure Terminal Access • Staff Only
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}