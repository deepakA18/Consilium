/**
 * Reasoning smoke (CONSOLIUM_BUILD.MD §7.1, §11 step 3).
 * One structured LLM call against the live (free) provider; prints the parsed JSON decision.
 *
 *   bun run reasoning:smoke
 */
import { llmJSON, type TraderDecision } from "../llm.ts";
import { env, requireEnv } from "@consilium/shared";

requireEnv(["LLM_API_KEY"]);

console.log(`Reasoning smoke — provider=${env.LLM_PROVIDER} model=${env.LLM_MODEL}\n`);

const decision = await llmJSON<TraderDecision>({
  messages: [
    {
      role: "system",
      content:
        "You are a terse prediction-market trader. Respond ONLY with a JSON object of the form " +
        `{"stance":"YES"|"NO","sizeUSDC":number,"rationale":string}. No prose, no code fences.`,
    },
    {
      role: "user",
      content:
        "Market: will the watched wallet's USDC balance exceed 1000 by tomorrow? It currently " +
        "holds 1200 USDC and has been rising. Pick a stance and a small size (<= 20 USDC).",
    },
  ],
  temperature: 0.2,
  maxTokens: 200,
});

console.log("parsed decision:", decision);
if (decision.stance !== "YES" && decision.stance !== "NO") {
  throw new Error(`unexpected stance: ${decision.stance}`);
}
if (typeof decision.sizeUSDC !== "number") {
  throw new Error(`sizeUSDC not a number: ${decision.sizeUSDC}`);
}
console.log("\nReasoning endpoint live ✓");
