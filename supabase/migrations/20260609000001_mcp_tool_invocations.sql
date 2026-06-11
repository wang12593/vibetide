create table if not exists public.mcp_tool_invocations (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  adapter_id text not null,
  tool_name text not null,
  organization_id uuid not null references public.organizations(id),
  actor_id text not null,
  actor_type text not null,
  source text not null,
  input_summary jsonb,
  result_status text not null,
  error_code text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists mcp_tool_invocations_request_idx
  on public.mcp_tool_invocations(request_id);

create index if not exists mcp_tool_invocations_org_created_idx
  on public.mcp_tool_invocations(organization_id, created_at);

create index if not exists mcp_tool_invocations_tool_created_idx
  on public.mcp_tool_invocations(tool_name, created_at);
