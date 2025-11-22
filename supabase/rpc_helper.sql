-- Function to list all tables in the database
create or replace function get_all_tables()
returns table (
  schema_name text,
  table_name text,
  approx_rows bigint
)
language sql
security definer
as $$
  select 
    t.table_schema::text,
    t.table_name::text,
    (select reltuples::bigint from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = t.table_schema and c.relname = t.table_name) as approx_rows
  from information_schema.tables t
  where t.table_schema not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'graphql', 'graphql_public', 'realtime', 'supabase_functions', 'pg_toast')
  order by t.table_schema, t.table_name;
$$;
