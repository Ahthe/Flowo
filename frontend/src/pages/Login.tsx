import React, { useState } from "react";
import { supabase } from "../services/supabase";
import {
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  MoveRight,
  Pencil,
  Star,
  UserPlus,
} from "lucide-react";
import { useToast } from "../context/ToastContext";
import Logo from "../components/common/Logo";

const Login: React.FC = () => {
  const { showToast } = useToast();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isSignup = mode === "signup";

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      showToast("Email and password are required.", "error");
      return;
    }

    if (isSignup && password.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }

    setIsLoading(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim() || email.split("@")[0],
            },
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        if (!data.session) {
          showToast("Account created. Check your email to confirm it.", "success");
        } else {
          showToast("Welcome to Flowo.", "success");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
        showToast("Welcome back.", "success");
      }
    } catch (error: any) {
      showToast(error.message || "Authentication failed.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      showToast("Enter your email first.", "error");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      showToast("Magic link sent. Check your email.", "success");
    } catch (error: any) {
      showToast(error.message || "Could not send magic link.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper-bg flex flex-col relative overflow-hidden text-ink font-type selection:bg-highlighter-yellow/40">
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-highlighter-yellow/30 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-highlighter-pink/20 rounded-full blur-[120px] animate-pulse delay-1000" />

      <div className="absolute top-20 left-10 hidden lg:block opacity-20 rotate-12">
        <Star size={64} className="text-highlighter-yellow fill-highlighter-yellow" />
      </div>
      <div className="absolute bottom-40 right-20 hidden lg:block opacity-20 -rotate-12">
        <Pencil size={80} className="text-ink" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-8">
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="transform group-hover:rotate-12 transition-transform duration-300">
            <Logo size={48} />
          </div>
          <h1 className="marker-text text-4xl -rotate-2 group-hover:rotate-0 transition-transform">
            Flowo
          </h1>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center container mx-auto px-4 relative z-10 w-full max-w-6xl">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24 w-full">
          <div className="flex-1 text-center lg:text-left relative">
            <div className="inline-block relative mb-6">
              <span className="font-sketch font-bold text-sm tracking-widest uppercase bg-ink text-white px-3 py-1 rotate-2 inline-block">
                Private System
              </span>
            </div>

            <h2 className="font-marker text-6xl md:text-8xl leading-[0.9] mb-8 relative">
              <span className="relative z-10">Turn goals into</span> <br />
              <span className="relative z-10 text-transparent bg-clip-text bg-linear-to-r from-ink to-ink/70">
                daily proof.
              </span>
              <svg
                className="absolute w-[110%] h-12 -bottom-2 -left-2 text-highlighter-yellow -z-10 opacity-90"
                viewBox="0 0 300 20"
                fill="none"
              >
                <path
                  d="M5 10 C 50 15, 150 15, 290 8"
                  stroke="currentColor"
                  strokeWidth="18"
                  strokeLinecap="round"
                  strokeOpacity="0.6"
                />
              </svg>
            </h2>

            <p className="font-hand text-2xl md:text-3xl text-ink/80 mb-10 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Sign in from your laptop or phone. Your pursuits, tasks, timeline,
              journal, and training logs stay with your account.
            </p>

            <div className="flex items-center justify-center lg:justify-start gap-4 font-sketch text-xs opacity-50 uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <Lock size={14} /> Supabase Auth
              </div>
              <div className="w-1 h-1 bg-ink rounded-full" />
              <div className="flex items-center gap-2">
                <Pencil size={14} /> Cross-device
              </div>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md relative group perspective-1000">
            <div className="absolute inset-0 bg-ink rounded-sm transform translate-x-2 translate-y-2 rotate-2 group-hover:rotate-3 transition-transform duration-300" />

            <form
              onSubmit={handleAuth}
              className="bg-white p-8 md:p-12 sketch-border relative transform -rotate-1 group-hover:rotate-0 transition-transform duration-500 shadow-xl flex flex-col text-left border-2 border-ink"
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-32 h-8 bg-highlighter-yellow/40 backdrop-blur-sm -rotate-1 shadow-sm border-l border-r border-white/50" />

              <div className="mb-8 text-center">
                <div className="w-20 h-20 rounded-full border-4 border-ink flex items-center justify-center bg-paper-bg relative overflow-hidden mx-auto mb-5">
                  {isSignup ? <UserPlus size={34} /> : <LogIn size={34} />}
                </div>
                <h3 className="font-marker text-3xl mb-2">
                  {isSignup ? "Create Account" : "Open Flowo"}
                </h3>
                <p className="font-hand text-lg opacity-60 leading-snug">
                  {isSignup
                    ? "Make an account with email and password."
                    : "Sign in with your email and password."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={`sketch-border px-3 py-2 font-hand text-lg transition-all ${
                    !isSignup ? "bg-ink text-white" : "bg-white opacity-60 hover:opacity-100"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`sketch-border px-3 py-2 font-hand text-lg transition-all ${
                    isSignup ? "bg-ink text-white" : "bg-white opacity-60 hover:opacity-100"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {isSignup && (
                <div className="mb-4">
                  <label className="font-sketch text-xs uppercase opacity-40 ml-1">
                    Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ahthesham"
                    className="w-full font-hand text-xl p-3 border-b-2 border-ink focus:outline-none focus:border-highlighter-pink bg-transparent"
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="font-sketch text-xs uppercase opacity-40 ml-1">
                  Email
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-35" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full font-hand text-xl p-3 pl-9 border-b-2 border-ink focus:outline-none focus:border-highlighter-pink bg-transparent"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="font-sketch text-xs uppercase opacity-40 ml-1">
                  Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-35" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full font-hand text-xl p-3 pl-9 pr-10 border-b-2 border-ink focus:outline-none focus:border-highlighter-pink bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-4 py-4 px-6 bg-ink text-white font-bold text-lg rounded-sm hover:translate-y-[-2px] hover:shadow-lg active:translate-y-px transition-all disabled:opacity-50"
              >
                {isLoading ? "Working..." : isSignup ? "Create Account" : "Sign In"}
                <MoveRight size={20} />
              </button>

              <button
                type="button"
                onClick={handleMagicLink}
                disabled={isLoading}
                className="mt-4 font-hand text-lg opacity-60 hover:opacity-100 hover:underline underline-offset-4"
              >
                Send me a magic link instead
              </button>

              <div className="mt-8 pt-6 border-t-2 border-dashed border-ink/10 w-full text-center">
                <p className="font-sketch text-[10px] opacity-40 uppercase tracking-widest">
                  No Google Cloud setup needed.
                </p>
              </div>
            </form>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-8 text-center">
        <p className="font-sketch text-xs opacity-40">
          &copy; {new Date().getFullYear()} Flowo.
        </p>
      </footer>
    </div>
  );
};

export default Login;
