import { describe, expect, it, vi } from "vitest";
import { summarizeIntegrationInput } from "../audit";

vi.mock("@/lib/dal/mcp-tool-invocations", () => ({
  createMcpToolInvocation: vi.fn(),
}));

describe("summarizeIntegrationInput", () => {
  it("keeps bounded primitive fields", () => {
    expect(
      summarizeIntegrationInput({
        articleId: "article_1",
        allowUpdate: true,
        limit: 20,
      }),
    ).toEqual({
      articleId: "article_1",
      allowUpdate: true,
      limit: 20,
    });
  });

  it("redacts sensitive keys", () => {
    expect(
      summarizeIntegrationInput({
        apiKey: "secret",
        authorization: "Bearer secret",
        refreshToken: "refresh-secret",
        client_secret: "client-secret",
        dbPassword: "password",
        credentialId: "credential",
      }),
    ).toEqual({
      apiKey: "[redacted]",
      authorization: "[redacted]",
      refreshToken: "[redacted]",
      client_secret: "[redacted]",
      dbPassword: "[redacted]",
      credentialId: "[redacted]",
    });
  });

  it("redacts content and payload keys", () => {
    expect(
      summarizeIntegrationInput({
        body: "<p>long html</p>",
        html: "<main>html</main>",
        content: "article body",
        requestPayload: { deep: true },
        responsePayload: { ok: true },
      }),
    ).toEqual({
      body: "[redacted_content]",
      html: "[redacted_content]",
      content: "[redacted_content]",
      requestPayload: "[redacted_content]",
      responsePayload: "[redacted_content]",
    });
  });

  it("summarizes unbounded values without preserving nested objects", () => {
    expect(
      summarizeIntegrationInput({
        title: "x".repeat(205),
        tags: ["a", "b"],
        options: { nested: true },
        retry: null,
      }),
    ).toEqual({
      title: `${"x".repeat(200)}...`,
      tags: "[array:2]",
      options: "[object]",
      retry: null,
    });
  });

  it.each([
    ["text", { value: "string" }],
    [42, { value: "number" }],
    [true, { value: "boolean" }],
    [null, { value: "object" }],
    [["a", "b"], { value: "object" }],
  ])("summarizes non-object input %j by type", (input, expected) => {
    expect(summarizeIntegrationInput(input)).toEqual(expected);
  });
});
