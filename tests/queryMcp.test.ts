import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { ChatOpenAI } from "@langchain/openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { AGENT_TIMEOUT_MS } from "../src/app/types/queryProtocol";
import type { QueryRequestContext } from "../src/app/services/queryAgent.types";
import { createQueryMcpConnection } from "../src/app/services/queryAgentMCP";
import { callQueryTool } from "../src/app/services/queryAgentTools";
import { loadQueryPrompts } from "../src/app/services/queryPrompts";
import { registerQueryRequest } from "../src/app/services/queryRequestStore";

test("the bridge sets the application timeout, forwards cancellation, and rejects malformed output", async () => {
  const client = new Client({ name: "test", version: "1" });
  const controller = new AbortController();
  const call = mock.method(
    client,
    "callTool",
    async (...args: Parameters<Client["callTool"]>) => {
      assert.equal(args[2]?.timeout, AGENT_TIMEOUT_MS);
      assert.equal(args[2]?.signal, controller.signal);
      return { content: [], structuredContent: { explanation: 123 } };
    },
  );
  try {
    await assert.rejects(
      callQueryTool(
        client,
        "summarize_results",
        { request: "List customers" },
        "test-request",
        controller.signal,
      ),
      /string/,
    );
    controller.abort();
    await assert.rejects(
      callQueryTool(
        client,
        "summarize_results",
        { request: "List customers" },
        "test-request",
        controller.signal,
      ),
      /abort/i,
    );
    assert.equal(
      call.mock.callCount(),
      1,
      "an already-cancelled request never reaches MCP",
    );
  } finally {
    call.mock.restore();
    await client.close();
  }
});

test("MCP advertises output contracts and a timed-out call cancels its model stream", async () => {
  const prompts = await loadQueryPrompts();
  const connection = await createQueryMcpConnection(prompts);
  const model = new ChatOpenAI({ apiKey: "test", model: "test" });
  let receivedSignal: AbortSignal | undefined;
  let notifyStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });
  const stream = mock.method(
    model,
    "stream",
    async (_messages: unknown, options: { signal: AbortSignal }) => {
      receivedSignal = options.signal;
      notifyStarted();
      await new Promise<void>((_resolve, reject) => {
        if (options.signal.aborted) reject(options.signal.reason);
        else
          options.signal.addEventListener(
            "abort",
            () => reject(options.signal.reason),
            { once: true },
          );
      });
      throw new Error("unreachable");
    },
  );
  const context: QueryRequestContext = {
    model,
    prompts,
    options: {},
    modelCalls: 0,
    generatedSQL: "SELECT 1;",
    requiredTables: [],
    queryResult: {
      columns: ["value"],
      rows: [{ value: 1 }],
      rowCount: 1,
      truncated: false,
      message: "OK",
    },
  };
  const registration = registerQueryRequest(context);
  try {
    const { tools } = await connection.client.listTools();
    assert.equal(tools.length, 3);
    for (const tool of tools) {
      assert.ok(tool.title);
      assert.ok(tool.outputSchema);
    }
    // Attach rejection handling immediately, before waiting for the handler to start.
    const timedOut = assert.rejects(
      connection.client.callTool(
        {
          name: "summarize_results",
          arguments: {
            request: "Summarize",
            requestId: registration.requestId,
          },
        },
        undefined,
        { timeout: 100 },
      ),
      /timed out/i,
    );
    await started;
    await timedOut;
    await assert.rejects(context.resultSummary!, /./);
    assert.equal(receivedSignal?.aborted, true);
  } finally {
    registration.dispose();
    stream.mock.restore();
    await connection.close();
  }
});
