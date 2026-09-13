create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as E'BEGIN\n  NEW.updated_at = clock_timestamp()\x3B\n  RETURN NEW\x3B\nEND\x3B';

comment on function public.set_updated_at() is
'Keeps mutable row updated_at timestamps authoritative at the database boundary.';

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_carriers_updated_at ON public.carriers;
CREATE TRIGGER trg_carriers_updated_at BEFORE UPDATE ON public.carriers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_drivers_updated_at ON public.drivers;
CREATE TRIGGER trg_drivers_updated_at BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_freights_updated_at ON public.freights;
CREATE TRIGGER trg_freights_updated_at BEFORE UPDATE ON public.freights FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_freight_assignments_updated_at ON public.freight_assignments;
CREATE TRIGGER trg_freight_assignments_updated_at BEFORE UPDATE ON public.freight_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
