import { describe, it, expect, vi } from "vitest";
import {
  executeSerialPlan,
  executeParallelPlan,
  executeArbitration,
  detectConflict,
  FeedbackQueue,
  isInterruptSignal,
  planFromTemplate,
  type StepExecutor,
} from "../group-dispatcher";

async function* mockStepExecutor(opts: {
  employeeSlug: string;
  prompt: string;
  priorOutput: string;
}): AsyncGenerator<{
  textDelta?: string;
  thinking?: { tool: string; label: string };
  done: boolean;
  output: string;
}> {
  yield {
    textDelta: `${opts.employeeSlug}:收到`,
    done: false,
    output: "",
  };
  yield {
    done: true,
    output: `${opts.employeeSlug} completed with prior="${opts.priorOutput}"`,
  };
}

describe("FeedbackQueue", () => {
  it("pushes and drains items", () => {
    const q = new FeedbackQueue();
    q.push({ content: "改一下标题", senderId: "user-1", receivedAt: Date.now() });
    q.push({ content: "加个段落", senderId: "user-1", receivedAt: Date.now() });

    expect(q.hasItems()).toBe(true);
    const items = q.drain();
    expect(items).toHaveLength(2);
    expect(q.hasItems()).toBe(false);
    expect(q.drain()).toHaveLength(0);
  });
});

describe("isInterruptSignal", () => {
  it("detects interrupt keywords", () => {
    expect(isInterruptSignal("停")).toBe(true);
    expect(isInterruptSignal("等一下")).toBe(true);
    expect(isInterruptSignal("stop")).toBe(true);
    expect(isInterruptSignal("wait")).toBe(true);
  });

  it("does not trigger on normal messages", () => {
    expect(isInterruptSignal("好的")).toBe(false);
    expect(isInterruptSignal("继续")).toBe(false);
    expect(isInterruptSignal("停不下来")).toBe(true);
  });
});

describe("executeSerialPlan", () => {
  it("executes steps in order with context passing", async () => {
    const plan = planFromTemplate({
      participantIds: ["xiaowen", "xiaojian"],
      mode: "serial",
      triggerMessage: { content: "写稿并审核", senderId: "user-1" },
      conversationId: "conv-1",
      participants: [
        { participantId: "xiaowen", participantType: "ai_employee", role: "member" },
        { participantId: "xiaojian", participantType: "ai_employee", role: "member" },
      ],
    });

    const events: Array<Record<string, unknown>> = [];
    for await (const event of executeSerialPlan(plan, mockStepExecutor)) {
      events.push(event as Record<string, unknown>);
    }

    const participantStarts = events.filter(
      (e) => e.type === "participant_start"
    );
    expect(participantStarts).toHaveLength(2);
    expect(participantStarts[0].participantId).toBe("xiaowen");
    expect(participantStarts[1].participantId).toBe("xiaojian");

    const textDeltas = events.filter(
      (e) => e.type === "text-delta"
    ) as Array<Record<string, unknown>>;
    expect(textDeltas[0].senderId).toBe("xiaowen");
    expect(textDeltas[1].senderId).toBe("xiaojian");

    const progressEvents = events.filter(
      (e) => e.type === "chain_progress"
    );
    expect(progressEvents).toHaveLength(2);
    expect(progressEvents[0]).toMatchObject({ current: 1, total: 2 });
    expect(progressEvents[1]).toMatchObject({ current: 2, total: 2 });
  });

  it("handles single step plan", async () => {
    const plan = planFromTemplate({
      participantIds: ["xiaowen"],
      mode: "serial",
      triggerMessage: { content: "写稿", senderId: "user-1" },
      conversationId: "conv-2",
      participants: [
        { participantId: "xiaowen", participantType: "ai_employee", role: "member" },
      ],
    });

    const events: Array<Record<string, unknown>> = [];
    for await (const event of executeSerialPlan(plan, mockStepExecutor)) {
      events.push(event as Record<string, unknown>);
    }

    const starts = events.filter((e) => e.type === "participant_start");
    expect(starts).toHaveLength(1);
  });
});

describe("planFromTemplate", () => {
  it("creates correct plan", () => {
    const plan = planFromTemplate({
      participantIds: ["a", "b", "c"],
      mode: "serial",
      triggerMessage: { content: "test", senderId: "user-1" },
      conversationId: "conv-x",
      participants: [
        { participantId: "a", participantType: "ai_employee", role: "member" },
        { participantId: "b", participantType: "ai_employee", role: "member" },
        { participantId: "c", participantType: "ai_employee", role: "member" },
      ],
    });

    expect(plan.executionOrder).toEqual(["a", "b", "c"]);
    expect(plan.mode).toBe("serial");
  });
});

describe("executeParallelPlan", () => {
  it("executes all participants concurrently", async () => {
    const plan = planFromTemplate({
      participantIds: ["xiaowen", "xiaojian", "xiaoce"],
      mode: "parallel",
      triggerMessage: { content: "并行任务", senderId: "user-1" },
      conversationId: "conv-p1",
      participants: [
        { participantId: "xiaowen", participantType: "ai_employee", role: "member" },
        { participantId: "xiaojian", participantType: "ai_employee", role: "member" },
        { participantId: "xiaoce", participantType: "ai_employee", role: "member" },
      ],
    });

    const events: Array<Record<string, unknown>> = [];
    for await (const event of executeParallelPlan(plan, mockStepExecutor)) {
      events.push(event as Record<string, unknown>);
    }

    const starts = events.filter((e) => e.type === "participant_start");
    expect(starts).toHaveLength(3);
    const startIds = starts.map((e) => e.participantId as string).sort();
    expect(startIds).toEqual(["xiaoce", "xiaojian", "xiaowen"]);

    const ends = events.filter((e) => e.type === "participant_end");
    expect(ends).toHaveLength(3);

    const textDeltas = events.filter(
      (e) => e.type === "text-delta"
    ) as Array<Record<string, unknown>>;
    expect(textDeltas).toHaveLength(3);

    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents).toHaveLength(1);
  });

  it("calls progress callback for each completion", async () => {
    const plan = planFromTemplate({
      participantIds: ["a", "b"],
      mode: "parallel",
      triggerMessage: { content: "test", senderId: "user-1" },
      conversationId: "conv-p2",
      participants: [
        { participantId: "a", participantType: "ai_employee", role: "member" },
        { participantId: "b", participantType: "ai_employee", role: "member" },
      ],
    });

    const progressCalls: Array<{ current: number; total: number }> = [];
    for await (const _ of executeParallelPlan(plan, mockStepExecutor, {
      onChainProgress: (current, total) => progressCalls.push({ current, total }),
    })) {
    }

    expect(progressCalls.length).toBeGreaterThanOrEqual(2);
    expect(progressCalls[0].total).toBe(2);
  });

  it("runs leader consolidation when leaderSlug provided", async () => {
    const plan = planFromTemplate({
      participantIds: ["xiaowen", "xiaoce"],
      mode: "parallel",
      triggerMessage: { content: "并行任务", senderId: "user-1" },
      conversationId: "conv-p3",
      participants: [
        { participantId: "xiaowen", participantType: "ai_employee", role: "member" },
        { participantId: "xiaoce", participantType: "ai_employee", role: "member" },
      ],
    });

    const events: Array<Record<string, unknown>> = [];
    for await (const event of executeParallelPlan(plan, mockStepExecutor, {
      leaderSlug: "xiaolei",
      leaderExecutor: mockStepExecutor,
    })) {
      events.push(event as Record<string, unknown>);
    }

    const mergeEvents = events.filter((e) => e.type === "parallel_merge");
    expect(mergeEvents).toHaveLength(1);
    expect((mergeEvents[0] as Record<string, unknown>).leaderSlug).toBe("xiaolei");

    const leaderStart = events.find(
      (e) =>
        e.type === "participant_start" &&
        (e as Record<string, unknown>).participantId === "xiaolei"
    );
    expect(leaderStart).toBeDefined();

    const leaderEnd = events.find(
      (e) =>
        e.type === "participant_end" &&
        (e as Record<string, unknown>).participantId === "xiaolei"
    );
    expect(leaderEnd).toBeDefined();
  });

  it("handles single participant parallel plan", async () => {
    const plan = planFromTemplate({
      participantIds: ["xiaowen"],
      mode: "parallel",
      triggerMessage: { content: "单任务", senderId: "user-1" },
      conversationId: "conv-p4",
      participants: [
        { participantId: "xiaowen", participantType: "ai_employee", role: "member" },
      ],
    });

    const events: Array<Record<string, unknown>> = [];
    for await (const event of executeParallelPlan(plan, mockStepExecutor)) {
      events.push(event as Record<string, unknown>);
    }

    const starts = events.filter((e) => e.type === "participant_start");
    expect(starts).toHaveLength(1);
    expect(starts[0].participantId).toBe("xiaowen");
  });
});

describe("detectConflict", () => {
  it("detects conflict when output contains conflict signals", () => {
    const result = detectConflict(
      { employeeSlug: "xiaowen", output: "这个方案与之前的设计矛盾" },
      ["必须与之前设计一致"]
    );
    expect(result.hasConflict).toBe(true);
    expect(result.description).toContain("xiaowen");
    expect(result.conflictingParties).toEqual(["xiaowen"]);
  });

  it("detects conflict in English", () => {
    const result = detectConflict(
      { employeeSlug: "xiaojian", output: "There is a conflict in the data" },
      ["data must be consistent"]
    );
    expect(result.hasConflict).toBe(true);
  });

  it("returns no conflict when output is normal", () => {
    const result = detectConflict(
      { employeeSlug: "xiaowen", output: "稿件已完成，请审核" },
      ["审核标准"]
    );
    expect(result.hasConflict).toBe(false);
  });

  it("returns no conflict when no constraints provided", () => {
    const result = detectConflict(
      { employeeSlug: "xiaowen", output: "这个方案有矛盾" },
      undefined
    );
    expect(result.hasConflict).toBe(false);
  });
});

describe("executeArbitration", () => {
  it("executes arbitration rounds with correct events", async () => {
    const conflict = {
      hasConflict: true,
      description: "小文与小健在稿件风格上存在分歧",
      conflictingParties: ["xiaowen", "xiaojian"],
    };

    const events: Array<Record<string, unknown>> = [];
    let finalConclusion = "";
    for await (const event of executeArbitration(conflict, mockStepExecutor, { maxRounds: 2 })) {
      events.push(event as Record<string, unknown>);
      if ((event as Record<string, unknown>).type === "arbitration_end") {
        finalConclusion = ((event as Record<string, unknown>).conclusion as string) ?? "";
      }
    }

    const startEvent = events.find((e) => e.type === "arbitration_start");
    expect(startEvent).toBeDefined();
    expect((startEvent as Record<string, unknown>).maxRounds).toBe(2);
    expect((startEvent as Record<string, unknown>).participants).toEqual(["xiaowen", "xiaojian"]);

    const roundEvents = events.filter((e) => e.type === "arbitration_round");
    expect(roundEvents).toHaveLength(4);

    const endEvent = events.find((e) => e.type === "arbitration_end");
    expect(endEvent).toBeDefined();
    expect(finalConclusion).toContain("2 轮仲裁");
  });

  it("handles empty participants gracefully", async () => {
    const conflict = {
      hasConflict: true,
      description: "测试冲突",
      conflictingParties: [],
    };

    const events: Array<Record<string, unknown>> = [];
    for await (const event of executeArbitration(conflict, mockStepExecutor, { maxRounds: 1 })) {
      events.push(event as Record<string, unknown>);
    }

    const roundEvents = events.filter((e) => e.type === "arbitration_round");
    expect(roundEvents).toHaveLength(0);

    const endEvent = events.find((e) => e.type === "arbitration_end");
    expect(endEvent).toBeDefined();
  });
});
