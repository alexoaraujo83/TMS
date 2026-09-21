alter table audit_events
  add column if not exists correlation_id text,
  add column if not exists actor_subject text,
  add column if not exists ip_address inet,
  add column if not exists user_agent text,
  add column if not exists outcome text;

create index if not exists audit_events_request_idx on audit_events (request_id);
create index if not exists audit_events_correlation_idx on audit_events (correlation_id);
create index if not exists audit_events_actor_idx on audit_events (tenant_id, actor_user_id, created_at desc);
