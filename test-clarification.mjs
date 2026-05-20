import http from "http";

function postJSON(path, body) {
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
    else if (line.startsWith("data: ")) { if (cur) cur.data += line.slice(6); else cur = { event: "message", data: line.slice(6) }; }
    else if (line.trim() === "" && cur) { events.push(cur); cur = null; }
  }
  return events;
}

async function test() {
  const tests = [
    { input: "\u5E2E\u6211\u5206\u6790\u4E09\u5927\u592E\u5A92\u7684\u7206\u6B3E\u4F5C\u54C1", expectClarification: true },
    { input: "\u5206\u6790\u4EBA\u6C11\u65E5\u62A5\u65B0\u534E\u793E\u592E\u89C6\u65B0\u95FB\u7684\u7206\u6B3E\u4F5C\u54C1", expectClarification: true },
    { input: "\u5E2E\u6211\u5206\u6790\u4E09\u5927\u592E\u5A92\u5728\u5FAE\u535A\u4E0A\u7684\u7206\u6B3E\u77ED\u89C6\u9891", expectClarification: false },
  ];

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    console.log(`\n=== Test ${i + 1}: "${t.input}" ===`);
    console.log(`Expect clarification: ${t.expectClarification}`);

    const res = await postJSON("/api/chat/intent", { message: t.input, employeeSlug: "leader" });
    if (res.status !== 200) { console.error(`HTTP ${res.status}`); continue; }

    const events = parseSSE(res.body);
    let result = null;
    for (const evt of events) {
      if (evt.event === "result") { try { result = JSON.parse(evt.data); } catch {} }
    }

    if (!result) { console.error("No result"); continue; }

    const actualClarification = !!result.needsClarification;
    const pass = actualClarification === t.expectClarification;
    console.log(`needsClarification: ${result.needsClarification}`);
    console.log(`workflowId: ${result.workflowId}`);
    console.log(`questions: ${result.clarificationQuestions?.length ?? 0}`);
    console.log(`PASS: ${pass}`);
    if (!pass) {
      console.log(`Full result: ${JSON.stringify(result, null, 2).slice(0, 500)}`);
    }
  }
}

test().catch(console.error);
