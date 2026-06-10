/**
 * Shared types for round events consumed by the web dashboard.
 *
 * Filled in as the round runner (CONSOLIUM_BUILD.MD §9) and dashboard (§10) take shape.
 * Every event that drives a UI figure MUST carry a real tx hash or webhook reference —
 * there is no event type for "fake" or "predicted" state.
 */

export type Side = "YES" | "NO";

export type AgentRole = "fundManager" | "bull" | "bear" | "research";

/** Terminal/non-terminal status as reported by the 1Shot relayer. */
export type RelayStatus =
  | "Pending"
  | "Submitted"
  | "Confirmed"
  | "Rejected"
  | "Reverted";
