import { createMiddleware } from "langchain";
import type { QueryRequestContext } from "./queryAgent.types";
import { queryToolContracts } from "./queryToolContracts";

export function createQueryAgentMiddleware(context: QueryRequestContext) {
  return createMiddleware({
    name: "query-lifecycle",
    beforeModel: {
      canJumpTo: ["end"],
      hook: () => {
        if (context.toolError) throw context.toolError;
        if (context.queryResult) return { jumpTo: "end" as const };
        if (++context.modelCalls > 4)
          throw new Error("Query agent model call limit reached");
      },
    },
    wrapModelCall: (request, handler) =>
      handler({
        ...request,
        tools: request.tools.filter(
          (entry) =>
            entry.name ===
            (context.generatedSQL
              ? queryToolContracts.execute_query.name
              : queryToolContracts.construct_sql.name),
        ),
      }),
  });
}
