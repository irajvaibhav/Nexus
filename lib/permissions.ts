import type { SupabaseClient } from "@supabase/supabase-js";

export const AGENT_LEVELS = ["read", "recommend", "prepare", "execute"] as const;
export type AgentLevel = (typeof AGENT_LEVELS)[number];

export const DEFAULT_AGENT_LEVEL: AgentLevel = "recommend";

const RANK: Record<AgentLevel, number> = {
  read: 0,
  recommend: 1,
  prepare: 2,
  execute: 3,
};

export const LEVEL_LABEL: Record<AgentLevel, string> = {
  read: "Read",
  recommend: "Recommend",
  prepare: "Prepare",
  execute: "Execute",
};

export function isAgentLevel(value: unknown): value is AgentLevel {
  return typeof value === "string" && (AGENT_LEVELS as readonly string[]).includes(value);
}

export function allows(current: AgentLevel, required: AgentLevel): boolean {
  return RANK[current] >= RANK[required];
}

export async function getAgentLevel(
  supabase: SupabaseClient,
  userId: string
): Promise<AgentLevel> {
  const { data } = await supabase
    .from("profiles")
    .select("agent_permission")
    .eq("id", userId)
    .single();

  const stored = (data as { agent_permission?: string } | null)?.agent_permission;
  return isAgentLevel(stored) ? stored : DEFAULT_AGENT_LEVEL;
}

export function deniedMessage(required: AgentLevel, current: AgentLevel): string {
  return `NEXUS needs "${LEVEL_LABEL[required]}" permission for this, but it's set to "${LEVEL_LABEL[current]}". You can change this in Settings.`;
}
