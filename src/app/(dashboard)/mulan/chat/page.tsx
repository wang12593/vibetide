import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { savedConversations } from "@/db/schema/saved-conversations";
import { userProfiles } from "@/db/schema/users";
import { desc, eq } from "drizzle-orm";
import { MulanChatClient } from "./mulan-chat-client";

export const dynamic = "force-dynamic";

export default async function MulanChatPage() {
  let conversations: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }> = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const rows = await db
        .select({
          id: savedConversations.id,
          title: savedConversations.title,
          updatedAt: savedConversations.updatedAt,
        })
        .from(savedConversations)
        .where(eq(savedConversations.employeeSlug, "leader"))
        .orderBy(desc(savedConversations.updatedAt))
        .limit(50);

      conversations = rows.map((r) => ({
        ...r,
        updatedAt: r.updatedAt.toISOString(),
      }));
    }
  } catch (error) { console.error("加载数据失败:", error); }

  return <MulanChatClient conversations={conversations} />;
}
