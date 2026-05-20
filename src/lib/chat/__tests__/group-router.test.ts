import { describe, it, expect } from "vitest";
import {
  createChatContext,
  routeByMention,
  routeByIntent,
  routeByRecentInteraction,
  routeByBroadcast,
  resolveRoute,
  updateFocus,
  clearFocus,
} from "../group-router";

const PARTICIPANTS = [
  { participantId: "xiaowen", participantType: "ai_employee" },
  { participantId: "xiaojian", participantType: "ai_employee" },
  { participantId: "xiaoce", participantType: "ai_employee" },
  { participantId: "xiaoshen", participantType: "ai_employee" },
  { participantId: "user-1", participantType: "human" },
];

describe("routeByMention", () => {
  it("routes to mentioned employee", () => {
    expect(routeByMention("@小文 写稿", PARTICIPANTS)).toBe("xiaowen");
  });

  it("returns null when no mention", () => {
    expect(routeByMention("继续", PARTICIPANTS)).toBeNull();
  });

  it("returns null when mentioning non-existent employee", () => {
    expect(routeByMention("@不存在的员工", PARTICIPANTS)).toBeNull();
  });

  it("ignores human participants", () => {
    expect(routeByMention("@user-1 hello", PARTICIPANTS)).toBeNull();
  });
});

describe("routeByIntent", () => {
  it("routes 写 to xiaowen", () => {
    expect(routeByIntent("开始写稿")).toBe("xiaowen");
  });

  it("routes 审核 to xiaojian", () => {
    expect(routeByIntent("请审核一下")).toBe("xiaojian");
  });

  it("routes 策划 to xiaoce", () => {
    expect(routeByIntent("帮我策划")).toBe("xiaoce");
  });

  it("routes 热点 to xiaolei", () => {
    expect(routeByIntent("看看热点")).toBe("xiaolei");
  });

  it("returns null for no intent keywords", () => {
    expect(routeByIntent("好的")).toBeNull();
  });
});

describe("routeByRecentInteraction", () => {
  it("returns focus employee when within decay window", () => {
    const ctx = createChatContext();
    updateFocus(ctx, "xiaowen", "recent_interaction", Date.now());
    expect(routeByRecentInteraction(ctx, Date.now())).toBe("xiaowen");
  });

  it("returns null and clears focus after decay", () => {
    const ctx = createChatContext();
    updateFocus(ctx, "xiaowen", "recent_interaction", 0);
    expect(routeByRecentInteraction(ctx, 60_000)).toBeNull();
    expect(ctx.focusEmployeeId).toBeNull();
  });
});

describe("routeByBroadcast", () => {
  it("detects 大家", () => {
    expect(routeByBroadcast("大家觉得怎么样")).toBe(true);
  });

  it("detects 所有人", () => {
    expect(routeByBroadcast("所有人回复")).toBe(true);
  });

  it("returns false for normal message", () => {
    expect(routeByBroadcast("继续")).toBe(false);
  });
});

describe("resolveRoute", () => {
  it("routes by mention first", () => {
    const ctx = createChatContext();
    const result = resolveRoute({
      message: "@小检 审核一下",
      participants: PARTICIPANTS,
      ctx,
      activeStepEmployeeId: "xiaowen",
    });
    expect(result).toEqual({ type: "direct", employeeId: "xiaojian" });
  });

  it("routes by active step when no mention", () => {
    const ctx = createChatContext();
    const result = resolveRoute({
      message: "继续",
      participants: PARTICIPANTS,
      ctx,
      activeStepEmployeeId: "xiaowen",
    });
    expect(result).toEqual({ type: "direct", employeeId: "xiaowen" });
  });

  it("routes by broadcast keywords", () => {
    const ctx = createChatContext();
    const result = resolveRoute({
      message: "大家看看这个",
      participants: PARTICIPANTS,
      ctx,
    });
    expect(result).toEqual({ type: "broadcast" });
  });

  it("routes by intent keyword", () => {
    const ctx = createChatContext();
    const result = resolveRoute({
      message: "开始写稿",
      participants: PARTICIPANTS,
      ctx,
    });
    expect(result).toEqual({ type: "direct", employeeId: "xiaowen" });
  });

  it("routes by recent interaction as fallback", () => {
    const ctx = createChatContext();
    updateFocus(ctx, "xiaowen", "recent_interaction", Date.now());
    const result = resolveRoute({
      message: "好的",
      participants: PARTICIPANTS,
      ctx,
    });
    expect(result).toEqual({ type: "direct", employeeId: "xiaowen" });
  });

  it("falls back to default receptionist", () => {
    const ctx = createChatContext();
    const result = resolveRoute({
      message: "好的",
      participants: PARTICIPANTS,
      ctx,
    });
    expect(result).toEqual({ type: "fallback", employeeId: "xiaoce" });
  });

  it("updates focus after mention route", () => {
    const ctx = createChatContext();
    resolveRoute({
      message: "@小文 写稿",
      participants: PARTICIPANTS,
      ctx,
    });
    expect(ctx.focusEmployeeId).toBe("xiaowen");
  });
});

describe("clearFocus", () => {
  it("clears focus state", () => {
    const ctx = createChatContext();
    updateFocus(ctx, "xiaowen", "recent_interaction", Date.now());
    clearFocus(ctx);
    expect(ctx.focusEmployeeId).toBeNull();
    expect(ctx.focusReason).toBeNull();
  });
});
