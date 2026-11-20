import { queryOptions } from "@tanstack/react-query";
import { getGrammar } from "./grammar.functions";

export const grammarQuery = queryOptions({ queryKey: ["grammar"], queryFn: () => getGrammar(), staleTime: 15000 });