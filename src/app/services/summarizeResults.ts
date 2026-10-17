import { HumanMessage } from "@langchain/core/messages";
import type { QueryRequestContext } from "./queryAgent.types";
import { appendQueryHistory } from "./queryConversation";
import { extractText, toHistoryMessages } from "./queryMessages";

export async function summarizeResults(
  context: QueryRequestContext,
  request: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  if (!context.generatedSQL || !context.queryResult) {
    throw new Error("Execute the generated query before summarizing results.");
  }
  context.resultSummary ??= (async () => {
    const { model, options, prompts, queryResult } = context;

    const answerMessages = appendQueryHistory([], request, {
      generatedSQL: context.generatedSQL,
      explanation: "",
      requiredTables: context.requiredTables,
      warnings: [],
      queryResult: queryResult!,
    });

    const stream = await model.stream(
      [
        { role: "system", content: prompts.resultSummary },
        ...toHistoryMessages(options.history),
        new HumanMessage(
          JSON.stringify({
            request,
            executedResult: JSON.parse(answerMessages.at(-1)!.content),
          }),
        ),
      ],
      { signal, tags: ["result-summary"] },
    );

    let explanation = "";
    options.onAgentToken?.("\n\n");
    for await (const chunk of stream) {
      signal?.throwIfAborted();
      const token = extractText(chunk.content);
      explanation += token;
      if (token) options.onAgentToken?.(token);
    }
    return explanation.trim();
  })();

  return { explanation: await context.resultSummary };
}
