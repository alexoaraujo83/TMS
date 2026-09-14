alter table outbox_events
  add column if not exists lease_token uuid;
