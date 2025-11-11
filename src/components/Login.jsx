import { useState } from "react";
import { authClient } from "../authClient";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await authClient.login(username, password);
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      console.error("Login error:", err);
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 md:px-8 py-0 bg-[#0b141a] bg-[url('https://raw.githubusercontent.com/jazimabbas/whatsapp-web-ui/refs/heads/master/public/assets/images/bg-chat-room.png')] bg-cover bg-center bg-no-repeat">
      <div className="relative w-full max-w-md bg-[#202c33] border border-[#3b4a54] rounded-lg px-5 md:px-7 py-7 md:py-8 shadow-xl overflow-visible">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center justify-center text-center gap-2">
            <img src="/logo.svg" alt="Logo" className="w-[100px]"/>
            <h1 className="text-[#e9edef] text-2xl font-medium">WhatsApp Web</h1>
            <p className="text-[#8696a0] text-sm">Sign in to continue to WhatsApp</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[#8696a0] text-sm" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full px-5 py-4 bg-[#2a3942] border border-[#3b4a54] rounded-lg text-[#e9edef] text-base placeholder-[#8696a0] focus:outline-none focus:border-[#00d9bb] focus:ring-1 focus:ring-[#00d9bb] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[#8696a0] text-sm" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-5 py-4 bg-[#2a3942] border border-[#3b4a54] rounded-lg text-[#e9edef] text-base placeholder-[#8696a0] focus:outline-none focus:border-[#00d9bb] focus:ring-1 focus:ring-[#00d9bb] transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-[#e9edef] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-300 px-3 py-2.5 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-center pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full . h-14 bg-[#00d9bb] hover:bg-[#00c4aa] disabled:bg-[#8696a0] text-[#0b141a] font-semibold text-base rounded-md transition-all duration-200 disabled:cursor-not-allowed shadow-[0_18px_40px_rgba(0,217,187,0.28)] flex items-center justify-center cursor-pointer"

              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[#8696a0] text-xs flex items-center justify-center">
            <Lock size={12} className="mr-1" />
            Your personal messages are end-to-end encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
