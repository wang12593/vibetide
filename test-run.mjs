const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function triggerWorkflow(title, workflowId, scenario) {
  console.log(`\n触发工作流: ${title}`);
  const res = await fetch("http://localhost:3000/api/test/run-workflow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, workflowTemplateId: workflowId, scenario }),
  });
  const data = await res.json();
  console.log(`  missionId: ${data.missionId}, status: ${data.status}`);
  return data.missionId;
}

async function pollMission(missionId, maxWait = 600) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxWait) {
    await sleep(5000);
    try {
      const res = await fetch(`http://localhost:3000/api/missions/${missionId}/artifacts?format=md`);
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 50) {
          console.log(`  完成! 产出物长度: ${text.length} 字符, 耗时: ${Math.round((Date.now() - start) / 1000)}s`);
          return text;
        }
      }
    } catch {}
    const detailRes = await fetch(`http://localhost:3000/api/test/mission-status?missionId=${missionId}`).catch(() => null);
    if (detailRes && detailRes.ok) {
      const detail = await detailRes.json();
      console.log(`  状态: ${detail.status}, 进度: ${detail.progress}%, 完成任务: ${detail.completedTasks}/${detail.totalTasks}`);
      if (detail.status === "completed" || detail.status === "failed") {
        if (detail.status === "failed") {
          console.log(`  失败原因: ${detail.errorMessage || "未知"}`);
          return null;
        }
        await sleep(3000);
        const artRes = await fetch(`http://localhost:3000/api/missions/${missionId}/artifacts?format=md`);
        if (artRes.ok) return await artRes.text();
        return detail.finalOutput || "无产出物";
      }
    }
  }
  console.log(`  超时 (${maxWait}s)`);
  return null;
}

(async () => {
  const results = {};

  const m1 = await triggerWorkflow(
    "测试-三大央媒短视频爆款分析与优化建议",
    "a0000000-0000-0000-0000-000000000001",
    "analytics"
  );
  if (m1) results.scene1 = { missionId: m1, output: await pollMission(m1) };

  const m2 = await triggerWorkflow(
    "测试-突发新闻全链路应急响应",
    "a0000000-0000-0000-0000-000000000002",
    "news"
  );
  if (m2) results.scene2 = { missionId: m2, output: await pollMission(m2) };

  require("fs").writeFileSync("test-results.json", JSON.stringify(results, null, 2), "utf-8");
  console.log("\n结果已保存到 test-results.json");
})();
