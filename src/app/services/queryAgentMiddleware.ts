import { createMiddleware } from "langchain";
import type { QueryRequestContext } from "./queryAgent.types";

export function createQueryAgentMiddleware(context: QueryRequestContext) {
  return createMiddleware({
    name: "query-lifecycle",
    beforeModel: {
      canJumpTo: ["end"],
      hook: () => {
        if (context.toolError) throw context.toolError;
        if (context.queryResult) return { jumpTo: "end" as const };
        if (++context.modelCalls > 6)
          throw new Error("Query agent model call limit reached");
      },
    },
  });
}
