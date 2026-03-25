-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.organization_billing (
  organization_id uuid NOT NULL,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  plan text NOT NULL DEFAULT 'free'::text,
  pending_plan text,  -- Scheduled plan change (e.g., downgrade at period end)
  payment_status text NOT NULL DEFAULT 'ok'::text,  -- 'ok' | 'past_due' | 'blocked'
  period_end timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organization_billing_pkey PRIMARY KEY (organization_id),
  CONSTRAINT organization_billing_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.organization_members (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member'::text CHECK (role = ANY (ARRAY['owner'::text, 'member'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organization_members_pkey PRIMARY KEY (organization_id, user_id),
  CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.organization_projects (
  organization_id uuid NOT NULL,
  name text NOT NULL,
  project_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organization_projects_pkey PRIMARY KEY (organization_id, project_id),
  CONSTRAINT organization_projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.organization_usage (
  organization_id uuid NOT NULL,
  current_task integer NOT NULL DEFAULT 0,
  current_skill integer NOT NULL DEFAULT 0,
  current_fast_skill_search integer NOT NULL DEFAULT 0,
  current_agentic_skill_search integer NOT NULL DEFAULT 0,
  current_storage bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organization_usage_pkey PRIMARY KEY (organization_id),
  CONSTRAINT organization_usage_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_default boolean NOT NULL DEFAULT false,
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_plans (
  plan text NOT NULL,
  max_task integer NOT NULL,
  max_skill integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  max_storage bigint NOT NULL DEFAULT 0,
  description jsonb NOT NULL DEFAULT '{}'::jsonb,
  product text,
  max_fast_skill_search integer NOT NULL DEFAULT 0,
  max_agentic_skill_search integer NOT NULL DEFAULT 0,
  CONSTRAINT product_plans_pkey PRIMARY KEY (plan)
);
CREATE TABLE public.project_secret_key_rotations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  secret_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_email text NOT NULL,
  CONSTRAINT project_secret_key_rotations_pkey PRIMARY KEY (id),
  CONSTRAINT project_secret_key_rotations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.organization_projects(project_id)
);
CREATE TABLE public.project_usage (
  project_id uuid NOT NULL,
  current_task integer NOT NULL DEFAULT 0,
  current_skill integer NOT NULL DEFAULT 0,
  current_fast_skill_search integer NOT NULL DEFAULT 0,
  current_agentic_skill_search integer NOT NULL DEFAULT 0,
  current_storage bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_usage_pkey PRIMARY KEY (project_id),
  CONSTRAINT project_usage_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.organization_projects(project_id)
);
CREATE TABLE public.project_usage_checkpoints (
  project_id uuid NOT NULL,
  tag text NOT NULL,
  last_synced_timestamp timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_synced_increment bigint NOT NULL DEFAULT 0,
  CONSTRAINT project_usage_checkpoints_pkey PRIMARY KEY (project_id, tag),
  CONSTRAINT project_usage_checkpoints_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.organization_projects(project_id)
);
CREATE TABLE public.usage_sync_global_checkpoint (
  id text NOT NULL DEFAULT 'global'::text,
  last_processed_to_timestamp bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT usage_sync_global_checkpoint_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usage_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid,
  tag text NOT NULL,
  date date NOT NULL,
  increment integer NOT NULL,
  stripe_reported boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT usage_sync_logs_pkey PRIMARY KEY (id),
  CONSTRAINT usage_sync_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT usage_sync_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.organization_projects(project_id)
);

-- Atomic increment for project_usage fields (avoids read-modify-write race conditions)
-- Called from sync-usage Edge Function to safely increment usage counters.
create or replace function public.increment_project_usage(
  p_project_id uuid,
  p_field text,
  p_increment integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Allowlist: only known usage columns may be incremented.
  if p_field not in ('current_task', 'current_skill', 'current_fast_skill_search', 'current_agentic_skill_search', 'current_storage') then
    raise exception 'Invalid field name: %', p_field;
  end if;

  -- Single atomic upsert: INSERT or UPDATE in one statement.
  -- Avoids race condition where two concurrent UPDATEs both find NOT FOUND
  -- and then both attempt INSERT, causing a unique constraint violation.
  execute format(
    'INSERT INTO public.project_usage (project_id, %I) VALUES ($1, $2)
     ON CONFLICT (project_id) DO UPDATE SET %I = COALESCE(public.project_usage.%I, 0) + EXCLUDED.%I,
     updated_at = now()',
    p_field, p_field, p_field, p_field
  ) using p_project_id, p_increment;
end;
$$;

-- Atomically claim a monthly reset checkpoint for an org.
-- Returns true if this call claimed it (i.e., the timestamp was actually changed),
-- false if it was already set to the current month's timestamp.
-- Uses ON CONFLICT with a WHERE clause so the UPDATE only fires when the value differs.
create or replace function public.try_claim_monthly_reset(
  p_checkpoint_id text,
  p_month_start_timestamp bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row_count integer;
begin
  INSERT INTO public.usage_sync_global_checkpoint (id, last_processed_to_timestamp)
  VALUES (p_checkpoint_id, p_month_start_timestamp)
  ON CONFLICT (id) DO UPDATE
    SET last_processed_to_timestamp = EXCLUDED.last_processed_to_timestamp
    WHERE public.usage_sync_global_checkpoint.last_processed_to_timestamp != EXCLUDED.last_processed_to_timestamp;

  -- ROW_COUNT is 0 when the WHERE clause suppresses the update (already claimed),
  -- 1 when a row was actually inserted or updated.
  -- FOUND cannot be used here because it is true even when the conditional UPDATE is skipped.
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  return v_row_count > 0;
end;
$$;

-- Database function to create organization
-- Uses auth.uid() to get the current authenticated user
create or replace function public.create_organization(
  org_name text,
  org_plan text default 'free'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  current_user_id uuid;
  has_existing_org boolean;
begin
  -- Get current user ID using auth.uid()
  current_user_id := auth.uid();

  -- Check if user is authenticated
  if current_user_id is null then
    raise exception 'User must be authenticated';
  end if;

  -- Validate plan exists
  if not exists (select 1 from public.product_plans where plan = org_plan) then
    raise exception 'Invalid plan: %', org_plan;
  end if;

  -- Check if user already has any organizations
  select exists (
    select 1
    from public.organization_members
    where user_id = current_user_id
  ) into has_existing_org;

  -- Create organization
  -- Set is_default to true if this is the user's first organization
  insert into public.organizations (name, is_default)
  values (org_name, not has_existing_org)
  returning id into new_org_id;

  -- Create billing record
  insert into public.organization_billing (organization_id, plan)
  values (new_org_id, org_plan);

  -- Create usage record (will be calculated from project_usage)
  insert into public.organization_usage (organization_id)
  values (new_org_id);

  -- Add current user as organization owner
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, current_user_id, 'owner');

  return new_org_id;
end;
$$;

-- Database function to create organization project
-- Uses auth.uid() to get the current authenticated user
-- NOTE: project_id should be obtained from external service before calling this function
-- TODO: This function should be called after requesting external service to create project
-- The external service will return the project_id, which should then be passed to this function
create or replace function public.create_organization_project(
  p_org_id uuid,
  p_project_name text,
  p_project_id uuid  -- project_id is required and should come from external service
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  user_role text;
BEGIN
  -- 获取当前用户
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- 检查是否为组织成员
  SELECT role INTO user_role
  FROM public.organization_members
  WHERE organization_id = p_org_id
    AND user_id = current_user_id;

  IF user_role IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this organization';
  END IF;

  -- 校验 project_id
  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'project_id is required and must be obtained from external service';
  END IF;

  -- 插入记录（避免歧义：参数名与列名不同）
  INSERT INTO public.organization_projects (organization_id, name, project_id)
  VALUES (p_org_id, p_project_name, p_project_id)
  ON CONFLICT (project_id) DO NOTHING;

  -- 创建 project_usage 记录
  INSERT INTO public.project_usage (project_id)
  VALUES (p_project_id)
  ON CONFLICT (project_id) DO NOTHING;

  RETURN p_project_id;
end;
$$;

-- CLI auth sessions for polling-based login.
-- The CLI generates a random state, opens the Dashboard login URL with that state,
-- then polls claim_cli_session(state) until the Dashboard inserts the tokens.
CREATE TABLE public.cli_auth_sessions (
  state text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at bigint NOT NULL DEFAULT 0,
  user_id text NOT NULL,
  user_email text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cli_auth_sessions_pkey PRIMARY KEY (state)
);

ALTER TABLE public.cli_auth_sessions ENABLE ROW LEVEL SECURITY;

-- No RLS policies — all access goes through Edge Functions
-- (store-cli-session and claim-cli-session) using service_role key.
