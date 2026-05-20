"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/home");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Brand */}
      <div
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col items-center justify-center p-12"
        style={{
          background: "linear-gradient(135deg, #8B0A1A 0%, #C41230 40%, #E8384F 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(212,168,75,0.2) 0%, transparent 50%)`,
        }} />
        <div className="relative z-10 text-center">
          <img src="/logo.png" alt="军媒智云" className="h-12 w-auto mx-auto mb-8 brightness-0 invert" />
          <h1 className="text-4xl font-bold text-white mb-4 tracking-wide">智能协作空间</h1>
          <p className="text-lg text-white/70 max-w-md mx-auto leading-relaxed">
            AI 驱动的全媒体智能内容生产平台
          </p>
          <div className="mt-12 flex items-center justify-center gap-8 text-white/50 text-sm">
            <span>数字员工</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>智能工作流</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>知识库</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Register Form */}
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#0f0f0f] p-8">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <img src="/logo.png" alt="军媒智云" className="h-8 w-auto object-contain" />
          </div>

          <h2 className="text-2xl font-bold text-foreground text-left mb-1">
            注册
          </h2>
          <p className="text-sm text-muted-foreground text-left mb-8">
            创建账号，组建你的 AI 团队
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">
                姓名
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="text"
                  placeholder="你的姓名"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="pl-9 h-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">
                邮箱
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">
                密码
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="password"
                  placeholder="至少 6 位密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 h-10"
                  minLength={6}
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-10 text-sm font-medium"
              style={{ background: "linear-gradient(135deg, #C41230, #E8384F)" }}
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "注册"
              )}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            已有账号？{" "}
            <Link
              href="/login"
              className="font-medium hover:brightness-110"
              style={{ color: "#C41230" }}
            >
              登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
