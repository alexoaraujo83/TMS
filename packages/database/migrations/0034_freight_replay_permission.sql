-- Give manual freight status-event replay its own authorization boundary.
-- Do not grant this permission to operator by default; tenant admins inherit
-- the permission through the canonical admin role bootstrap.

insert into permissions (code, description)
values ('freight:replay', 'Replay a freight status-change event')
on conflict (code) do nothing;
