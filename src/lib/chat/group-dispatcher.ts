export type GroupStreamEvent =
  | { type: "participant_start"; participantId: string; participantName: string }
  | { type: "participant_end"; participantId: string; summary?: string }
  | { type: "chain_progress"; current: number; total: number }
  | { type: "text-delta"; content: string; senderId: string }
  | { type: "thinking"; tool: string; label: string; senderId: string }
  | { type: "step-review"; stepIndex: number; senderId: string; [key: string]: unknown }
  | { type: "parallel_merge"; leaderSlug: string; summaries: Array<{ slug: string; output: string }> }
  | { type: "arbitration_start"; conflictDescription: string; participants: string[]; maxRounds: number }
  | { type: "arbitration_round"; round: number; speakerId: string; stance: string }
  | { type: "arbitration_end"; conclusion: string; resolution: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type GroupParticipant = {
  participantId: string;
  participantType: string;
  role: string;
};

export type GroupDispatchPlan = {
  conversationId: string;
  triggerMessage: { content: string; senderId: string };
  participants: GroupParticipant[];
  mode: "serial" | "parallel";
  executionOrder: string[];
};

export type FeedbackEntry = {
  content: string;
  senderId: string;
  receivedAt: number;
};

const INTERRUPT_KEYWORDS = ["停", "等一下", "暂停", "stop", "wait", "hold"];

export function isInterruptSignal(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  return INTERRUPT_KEYWORDS.some((kw) => trimmed === kw || trimmed.startsWith(kw));
}

export class FeedbackQueue {
  private queue: FeedbackEntry[] = [];

  push(entry: FeedbackEntry): void {
    this.queue.push(entry);
  }

  drain(): FeedbackEntry[] {
    const items = [...this.queue];
    this.queue = [];
    return items;
  }

  hasItems(): boolean {
    return this.queue.length > 0;
  }
}

export type StepExecutor = (opts: {
  employeeSlug: string;
  prompt: string;
  priorOutput: string;
  feedbackItems: FeedbackEntry[];
}) => AsyncGenerator<{
  textDelta?: string;
  thinking?: { tool: string; label: string };
  done: boolean;
  output: string;
}>;

export async function* executeSerialPlan(
  plan: GroupDispatchPlan,
  executor: StepExecutor,
  opts?: {
    onParticipantStart?: (id: string, name: string) => void;
    onParticipantEnd?: (id: string, summary?: string) => void;
    onChainProgress?: (current: number, total: number) => void;
  }
): AsyncGenerator<GroupStreamEvent, void, unknown> {
  const total = plan.executionOrder.length;
  let priorOutput = "";

  for (let i = 0; i < plan.executionOrder.length; i++) {
    const employeeSlug = plan.executionOrder[i];

    opts?.onParticipantStart?.(employeeSlug, employeeSlug);
    yield {
      type: "participant_start",
      participantId: employeeSlug,
      participantName: employeeSlug,
    };

    opts?.onChainProgress?.(i + 1, total);
    yield {
      type: "chain_progress",
      current: i + 1,
      total,
    };

    let stepOutput = "";
    const feedbackItems: FeedbackEntry[] = [];

    const gen = executor({
      employeeSlug,
      prompt: plan.triggerMessage.content,
      priorOutput,
      feedbackItems,
    });

    for await (const chunk of gen) {
      if (chunk.textDelta) {
        stepOutput += chunk.textDelta;
        yield {
          type: "text-delta",
          content: chunk.textDelta,
          senderId: employeeSlug,
        };
      }
      if (chunk.thinking) {
        yield {
          type: "thinking",
          tool: chunk.thinking.tool,
          label: chunk.thinking.label,
          senderId: employeeSlug,
        };
      }
      if (chunk.done) {
        stepOutput = chunk.output || stepOutput;
      }
    }

    priorOutput = stepOutput;

    opts?.onParticipantEnd?.(employeeSlug);
    yield {
      type: "participant_end",
      participantId: employeeSlug,
    };
  }
}

type ParallelCompletion = {
  employeeSlug: string;
  output: string;
};

class AsyncEventQueue {
  private events: GroupStreamEvent[] = [];
  private waiting: ((value: void) => void) | null = null;
  private closed = false;

  push(event: GroupStreamEvent): void {
    this.events.push(event);
    if (this.waiting) {
      const w = this.waiting;
      this.waiting = null;
      w();
    }
  }

  close(): void {
    this.closed = true;
    if (this.waiting) {
      const w = this.waiting;
      this.waiting = null;
      w();
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<GroupStreamEvent, void, unknown> {
    while (true) {
      while (this.events.length > 0) {
        yield this.events.shift()!;
      }
      if (this.closed && this.events.length === 0) return;
      await new Promise<void>((resolve) => {
        this.waiting = resolve;
      });
    }
  }
}

export async function* executeParallelPlan(
  plan: GroupDispatchPlan,
  executor: StepExecutor,
  opts?: {
    leaderSlug?: string;
    leaderExecutor?: StepExecutor;
    onParticipantStart?: (id: string, name: string) => void;
    onParticipantEnd?: (id: string, summary?: string) => void;
    onChainProgress?: (current: number, total: number) => void;
  }
): AsyncGenerator<GroupStreamEvent, void, unknown> {
  const queue = new AsyncEventQueue();
  const total = plan.executionOrder.length;

  for (const slug of plan.executionOrder) {
    yield {
      type: "participant_start",
      participantId: slug,
      participantName: slug,
    };
    opts?.onParticipantStart?.(slug, slug);
  }

  let completedCount = 0;

  const allPromise = Promise.allSettled(
    plan.executionOrder.map(async (employeeSlug) => {
      let output = "";
      const gen = executor({
        employeeSlug,
        prompt: plan.triggerMessage.content,
        priorOutput: "",
        feedbackItems: [],
      });

      for await (const chunk of gen) {
        if (chunk.textDelta) {
          output += chunk.textDelta;
          queue.push({
            type: "text-delta",
            content: chunk.textDelta,
            senderId: employeeSlug,
          });
        }
        if (chunk.thinking) {
          queue.push({
            type: "thinking",
            tool: chunk.thinking.tool,
            label: chunk.thinking.label,
            senderId: employeeSlug,
          });
        }
        if (chunk.done) {
          output = chunk.output || output;
        }
      }

      completedCount++;
      queue.push({
        type: "chain_progress",
        current: completedCount,
        total,
      });
      opts?.onChainProgress?.(completedCount, total);

      queue.push({
        type: "participant_end",
        participantId: employeeSlug,
        summary: output.slice(0, 200),
      });
      opts?.onParticipantEnd?.(employeeSlug, output.slice(0, 200));

      return { employeeSlug, output };
    })
  );

  let completions: ParallelCompletion[] = [];

  allPromise.then((results) => {
    completions = results
      .filter(
        (r): r is PromiseFulfilledResult<ParallelCompletion> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value);
    queue.close();
  });

  for await (const event of queue) {
    yield event;
  }

  if (opts?.leaderSlug && opts.leaderExecutor && completions.length > 0) {
    yield {
      type: "parallel_merge",
      leaderSlug: opts.leaderSlug,
      summaries: completions.map((c) => ({
        slug: c.employeeSlug,
        output: c.output,
      })),
    };

    yield {
      type: "participant_start",
      participantId: opts.leaderSlug,
      participantName: opts.leaderSlug,
    };
    opts?.onParticipantStart?.(opts.leaderSlug, opts.leaderSlug);

    const consolidated = completions
      .map((c) => `## ${c.employeeSlug}\n${c.output}`)
      .join("\n\n");

    const gen = opts.leaderExecutor({
      employeeSlug: opts.leaderSlug,
      prompt: `请汇总以下并行执行结果并给出综合结论：\n\n${consolidated}`,
      priorOutput: "",
      feedbackItems: [],
    });

    let leaderOutput = "";
    for await (const chunk of gen) {
      if (chunk.textDelta) {
        leaderOutput += chunk.textDelta;
        yield {
          type: "text-delta",
          content: chunk.textDelta,
          senderId: opts.leaderSlug,
        };
      }
      if (chunk.thinking) {
        yield {
          type: "thinking",
          tool: chunk.thinking.tool,
          label: chunk.thinking.label,
          senderId: opts.leaderSlug,
        };
      }
    }

    yield {
      type: "participant_end",
      participantId: opts.leaderSlug,
      summary: leaderOutput.slice(0, 200),
    };
    opts?.onParticipantEnd?.(opts.leaderSlug, leaderOutput.slice(0, 200));
  }

  yield { type: "done" };
}

export function planFromTemplate(opts: {
  participantIds: string[];
  mode: "serial" | "parallel";
  triggerMessage: { content: string; senderId: string };
  conversationId: string;
  participants: GroupParticipant[];
}): GroupDispatchPlan {
  return {
    conversationId: opts.conversationId,
    triggerMessage: opts.triggerMessage,
    participants: opts.participants,
    mode: opts.mode,
    executionOrder: opts.participantIds,
  };
}

export type ConflictCheck = {
  hasConflict: boolean;
  description?: string;
  conflictingParties?: string[];
};

type StepOutput = {
  employeeSlug: string;
  output: string;
  constraints?: string[];
};

const CONFLICT_SIGNALS = [
  "矛盾",
  "冲突",
  "不一致",
  "conflict",
  "contradiction",
  "inconsistent",
  "无法满足",
  "不符合",
];

export function detectConflict(
  priorStep: StepOutput,
  nextStepConstraints: string[] | undefined
): ConflictCheck {
  if (!nextStepConstraints || nextStepConstraints.length === 0) {
    return { hasConflict: false };
  }

  const outputLower = priorStep.output.toLowerCase();
  const found = CONFLICT_SIGNALS.some((signal) =>
    outputLower.includes(signal)
  );

  if (found) {
    return {
      hasConflict: true,
      description: `${priorStep.employeeSlug} 的输出与后续步骤约束可能存在冲突`,
      conflictingParties: [priorStep.employeeSlug],
    };
  }

  return { hasConflict: false };
}

export async function* executeArbitration(
  conflict: ConflictCheck,
  executor: StepExecutor,
  opts: {
    maxRounds?: number;
    onArbitrationStart?: (desc: string, participants: string[]) => void;
    onArbitrationRound?: (round: number, speaker: string, stance: string) => void;
    onArbitrationEnd?: (conclusion: string) => void;
  }
): AsyncGenerator<GroupStreamEvent, string, unknown> {
  const maxRounds = opts.maxRounds ?? 3;
  const participants = conflict.conflictingParties ?? [];

  yield {
    type: "arbitration_start",
    conflictDescription: conflict.description ?? "未指定冲突",
    participants,
    maxRounds,
  };
  opts?.onArbitrationStart?.(conflict.description ?? "", participants);

  let resolution = "";

  for (let round = 1; round <= maxRounds; round++) {
    for (const speakerId of participants) {
      yield {
        type: "participant_start",
        participantId: speakerId,
        participantName: speakerId,
      };

      const gen = executor({
        employeeSlug: speakerId,
        prompt: `争议仲裁第 ${round} 轮：请针对以下冲突发表你的立场和理由。\n\n冲突描述：${conflict.description}\n\n请简要陈述你的观点。`,
        priorOutput: resolution,
        feedbackItems: [],
      });

      let stance = "";
      for await (const chunk of gen) {
        if (chunk.textDelta) {
          stance += chunk.textDelta;
          yield {
            type: "text-delta",
            content: chunk.textDelta,
            senderId: speakerId,
          };
        }
        if (chunk.done) {
          stance = chunk.output || stance;
        }
      }

      yield {
        type: "participant_end",
        participantId: speakerId,
        summary: stance.slice(0, 200),
      };

      yield {
        type: "arbitration_round",
        round,
        speakerId,
        stance: stance.slice(0, 500),
      };
      opts?.onArbitrationRound?.(round, speakerId, stance.slice(0, 500));

      resolution = stance;
    }
  }

  const conclusion = `经过 ${maxRounds} 轮仲裁，结论如下：${resolution.slice(0, 500)}`;

  yield {
    type: "arbitration_end",
    conclusion,
    resolution: conclusion,
  };
  opts?.onArbitrationEnd?.(conclusion);

  return conclusion;
}
