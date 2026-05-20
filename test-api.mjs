import http from "http";

function makeRequest(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "sb-access-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0;sb-refresh-token=v2.local.T4rgFzOxSIG0gUkKjzWmFJGP0LFG7IjW8H7U0qYllFJAYln1nxfS0VGiM0bfhMor3OXJ3GCtO1-0LqudHdXJ-vq_RjmdBgJnpB3dMGBPN98t_9iOKtGKLnkFfMFr6lrDsr_uWCxLrM5JUrYl7yU0LUm3rW_NxfYOjA",
        },
      },
      (res) => {
        let rawData = "";
        res.on("data", (chunk) => (rawData += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: rawData }));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function parseSSE(raw) {
  const events = [];
  const lines = raw.split("\n");
  let cur = null;
  for (const line of lines) {
    if (line.startsWith("event: ")) cur = { event: line.slice(7).trim(), data: "" };
    else if (line.startsWith("data: ")) {
      if (cur) cur.data += line.slice(6);
      else cur = { event: "message", data: line.slice(6) };
    }
    else if (line.trim() === "" && cur) { events.push(cur); cur = null; }
  }
  return events;
}

async function main() {
  const input = "帮我分析三大央媒的爆款作品";
  console.log("Testing:", input);

  const res = await makeRequest("/api/chat/intent", { message: input, employeeSlug: "leader" });
  console.log("Status:", res.status);

  const events = parseSSE(res.body);
  for (const evt of events) {
    if (evt.event === "result") {
      const result = JSON.parse(evt.data);
      console.log("\n=== RESULT ===");
      console.log("needsClarification:", result.needsClarification);
      console.log("workflowId:", result.workflowId);
      console.log("workflowName:", result.workflowName);
      console.log("clarificationQuestions:", result.clarificationQuestions?.length);
      console.log("confidence:", result.confidence);
      console.log("summary:", result.summary);
      if (result.clarificationQuestions?.length > 0) {
        console.log("\nQuestions:");
        result.clarificationQuestions.forEach((q, i) => {
          console.log(`  ${i + 1}. ${q.question} (field: ${q.field}, options: ${q.options?.length})`);
        });
      }
    }
  }
}

main().catch(console.error);
