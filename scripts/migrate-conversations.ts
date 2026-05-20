import { db } from "@/db";
import { savedConversations, conversationParticipants, conversationMessages } from "@/db/schema";
import { isNull, isNotNull } from "drizzle-orm";

async function migrate() {
  console.log("开始迁移 saved_conversations → conversation_participants + conversation_messages");

  const allConvs = await db
    .select()
    .from(savedConversations)
    .where(isNull(savedConversations.isGroup));

  console.log(`找到 ${allConvs.length} 条单聊对话需要迁移`);

  let totalMessages = 0;
  let totalParticipants = 0;

  for (const conv of allConvs) {
    const messages = (conv.messages ?? []) as Array<{
      role: "user" | "assistant" | "system";
      content: string;
      [key: string]: unknown;
    }>;

    if (conv.employeeSlug) {
      await db.insert(conversationParticipants).values({
        conversationId: conv.id,
        participantType: "ai_employee",
        participantId: conv.employeeSlug,
        role: "member",
        organizationId: conv.organizationId,
      }).onConflictDoNothing();
      totalParticipants++;
    }

    await db.insert(conversationParticipants).values({
      conversationId: conv.id,
      participantType: "human",
      participantId: conv.userId,
      role: "leader",
      organizationId: conv.organizationId,
    }).onConflictDoNothing();
    totalParticipants++;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      await db.insert(conversationMessages).values({
        conversationId: conv.id,
        seqNum: i,
        role: msg.role,
        content: msg.content,
        senderType: msg.role === "user" ? "human" : "ai_employee",
        senderId: msg.role === "user" ? conv.userId : (conv.employeeSlug ?? undefined),
        messageType: "text",
        metadata: {
          durationMs: (msg as Record<string, unknown>).durationMs,
          thinkingSteps: (msg as Record<string, unknown>).thinkingSteps,
          skillsUsed: (msg as Record<string, unknown>).skillsUsed,
          sources: (msg as Record<string, unknown>).sources,
          kind: (msg as Record<string, unknown>).kind,
          missionId: (msg as Record<string, unknown>).missionId,
        },
        organizationId: conv.organizationId,
      }).onConflictDoNothing();
      totalMessages++;
    }
  }

  console.log(`迁移完成：`);
  console.log(`  对话数: ${allConvs.length}`);
  console.log(`  参与者记录: ${totalParticipants}`);
  console.log(`  消息记录: ${totalMessages}`);
  console.log(`原始 jsonb 数据未删除，作为备份保留。`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("迁移失败:", err);
    process.exit(1);
  });
