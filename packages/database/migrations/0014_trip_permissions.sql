insert into permissions (code, description) values
  ('trip:read', 'Read trip operations'),
  ('trip:create', 'Create trip operations'),
  ('trip:update', 'Transition trip operations')
on conflict (code) do nothing;
