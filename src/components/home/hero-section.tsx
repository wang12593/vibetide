"use client";

import { motion } from "framer-motion";
import { MessageSquare, ArrowRight } from "lucide-react";
import Link from "next/link";

export function HeroSection() {
  return (
    <div className="flex flex-col items-center gap-3 pt-4 pb-2">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.65, ease: "easeOut" }}
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
          </span>
          <span className="text-xs font-medium text-emerald-600 dark:text-red-400">
            智能协作空间
          </span>
        </div>
      </motion.div>

      <h1 className="flex items-center justify-center text-4xl md:text-5xl font-bold tracking-tight text-center">
        {/* 智能协作空间 — paint-on scale animation */}
        <motion.span
          className="relative inline-block font-black leading-none"
          style={{
            background:
              "linear-gradient(135deg, #2A0A10 0%, #8B0A1A 40%, #C41230 90%, #D4A84B 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
          initial={{ opacity: 0, scale: 2.2, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: [0.22, 1.2, 0.36, 1] }}
        >
          智能协作空间
          <motion.span
            className="absolute left-1/2 -bottom-1 h-[3px] rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, #C41230, #D4A84B, transparent)",
            }}
            initial={{ width: 0, x: "-50%", opacity: 0 }}
            animate={{ width: "80%", x: "-50%", opacity: 0.85 }}
            transition={{ duration: 0.6, delay: 0.55, ease: "easeOut" }}
          />
        </motion.span>
      </h1>

      <motion.div
        className="flex flex-col items-center gap-2 text-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 1.15, ease: "easeOut" }}
      >
        <p className="text-base text-muted-foreground">
          与 AI 团队协作，高效完成内容生产
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg text-xs font-medium
            text-red-600 dark:text-red-400 bg-red-500/8 hover:bg-red-500/15
            transition-all duration-200 group"
        >
          <MessageSquare size={13} />
          进入对话中心
          <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    </div>
  );
}
