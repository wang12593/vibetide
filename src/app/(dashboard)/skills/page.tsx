import { getSkillsWithBindCount } from "@/lib/dal/skills";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/rbac";
import { SkillsClient } from "./skills-client";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  let skills: Awaited<ReturnType<typeof getSkillsWithBindCount>> = [];

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const admin = user ? await isSuperAdmin(user.id) : false;
    skills = await getSkillsWithBindCount({
      userId: user?.id,
      mode: admin ? "all" : "own",
    });
  } catch {
    skills = [];
  }

  return <SkillsClient skills={skills} />;
}
