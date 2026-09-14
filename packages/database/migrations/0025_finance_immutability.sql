create or replace function public.enforce_financial_entry_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'pending' then
    if new.status <> old.status
      or new.settled_at is distinct from old.settled_at
      or new.amount_cents <> old.amount_cents
      or new.currency <> old.currency
      or new.direction <> old.direction
      or new.entry_type <> old.entry_type
      or new.description <> old.description
      or new.freight_id <> old.freight_id
      or new.assignment_id is distinct from old.assignment_id
      or new.trip_id is distinct from old.trip_id
      or new.external_reference is distinct from old.external_reference
      or new.metadata is distinct from old.metadata
      or new.due_at is distinct from old.due_at then
      raise exception 'FINANCIAL_ENTRY_IMMUTABLE';
    end if;
  end if;

  if old.status = 'pending' and new.status = 'settled' then
    if new.settled_at is null then
      raise exception 'FINANCIAL_ENTRY_SETTLED_AT_REQUIRED';
    end if;
  elsif old.status = 'pending' and new.status = 'cancelled' then
    if new.settled_at is not null then
      raise exception 'FINANCIAL_ENTRY_CANCELLED_WITH_SETTLED_AT';
    end if;
  elsif new.status <> old.status then
    raise exception 'FINANCIAL_ENTRY_INVALID_STATUS_TRANSITION';
  end if;

  return new;
end;
$$;

create trigger financial_entries_immutability
before update on financial_entries
for each row execute function public.enforce_financial_entry_immutability();
