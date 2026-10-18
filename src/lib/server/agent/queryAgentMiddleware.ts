import { createMiddleware } from "langchain";
import type { QueryRequestContext } from "./queryAgent.types";

/** Stop model iteration after execution or a tool failure, and cap model calls per request. */
export function createQueryAgentMiddleware(context: QueryRequestContext) {
  return createMiddleware({
    name: "query-lifecycle",
    beforeModel: {
      canJumpTo: ["end"],
      hook: () => {
        if (context.toolError) throw context.toolError;
        // Execution is the terminal agent step; optional summarization runs afterward.
        if (context.queryResult) return { jumpTo: "end" as const };
        if (++context.modelCalls > 6)
          throw new Error("Query agent model call limit reached");
      },
    },
  });
}
