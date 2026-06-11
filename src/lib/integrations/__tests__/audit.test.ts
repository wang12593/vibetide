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
        cookie: "sid=secret",
        sessionId: "session",
        jwt: "jwt",
        refreshToken: "refresh-secret",
        client_secret: "client-secret",
        clientSecret: "client-secret",
        privateKey: "private-key",
        private_key: "private-key",
        requestSignature: "signature",
        webhookSecret: "webhook-secret",
        dbPassword: "password",
        credentialId: "credential",
      }),
    ).toEqual({
      apiKey: "[redacted]",
      authorization: "[redacted]",
      cookie: "[redacted]",
      sessionId: "[redacted]",
      jwt: "[redacted]",
      refreshToken: "[redacted]",
      client_secret: "[redacted]",
      clientSecret: "[redacted]",
      privateKey: "[redacted]",
      private_key: "[redacted]",
      requestSignature: "[redacted]",
      webhookSecret: "[redacted]",
      dbPassword: "[redacted]",
      credentialId: "[redacted]",
    });
  });

  it("redacts content, payload, and free-text keys", () => {
    expect(
      summarizeIntegrationInput({
        body: "<p>long html</p>",
        html: "<main>html</main>",
        content: "article body",
        text: "draft text",
        prompt: "write a post",
        markdown: "# Title",
        message: "hello",
        query: "customer research",
        url: "https://example.com/path",
        uri: "vibetide://article/1",
        requestPayload: { deep: true },
        responsePayload: { ok: true },
      }),
    ).toEqual({
      body: "[redacted_content]",
      html: "[redacted_content]",
      content: "[redacted_content]",
      text: "[redacted_content]",
      prompt: "[redacted_content]",
      markdown: "[redacted_content]",
      message: "[redacted_content]",
      query: "[redacted_content]",
      url: "[redacted_content]",
      uri: "[redacted_content]",
      requestPayload: "[redacted_content]",
      responsePayload: "[redacted_content]",
    });
  });

  it("redacts risky string values even under otherwise safe keys", () => {
    expect(
      summarizeIntegrationInput({
        articleId: "Bearer secret-token",
        publicationId:
          "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature",
        externalId: "sk-test_1234567890abcdef1234567890abcdef",
        callbackId: "https://example.com/callback?signature=abc&code=123",
        keyBlock: "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----",
      }),
    ).toEqual({
      articleId: "[redacted]",
      publicationId: "[redacted]",
      externalId: "[redacted]",
      callbackId: "[redacted]",
      keyBlock: "[redacted]",
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
