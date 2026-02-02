
  create table "public"."audit_logs" (
    "id" text not null,
    "action" text not null,
    "entity_type" text not null,
    "entity_id" text,
    "project_id" text,
    "user_id" uuid not null,
    "user_email" text not null,
    "metadata" jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."audit_logs" enable row level security;

CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action, created_at DESC);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);

CREATE INDEX idx_audit_logs_project ON public.audit_logs USING btree (project_id);

CREATE INDEX idx_audit_logs_user_time ON public.audit_logs USING btree (user_id, created_at DESC);

alter table "public"."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY using index "audit_logs_pkey";

alter table "public"."audit_logs" add constraint "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_user_id_fkey";

grant delete on table "public"."audit_logs" to "anon";

grant insert on table "public"."audit_logs" to "anon";

grant references on table "public"."audit_logs" to "anon";

grant select on table "public"."audit_logs" to "anon";

grant trigger on table "public"."audit_logs" to "anon";

grant truncate on table "public"."audit_logs" to "anon";

grant update on table "public"."audit_logs" to "anon";

grant delete on table "public"."audit_logs" to "authenticated";

grant insert on table "public"."audit_logs" to "authenticated";

grant references on table "public"."audit_logs" to "authenticated";

grant select on table "public"."audit_logs" to "authenticated";

grant trigger on table "public"."audit_logs" to "authenticated";

grant truncate on table "public"."audit_logs" to "authenticated";

grant update on table "public"."audit_logs" to "authenticated";

grant delete on table "public"."audit_logs" to "service_role";

grant insert on table "public"."audit_logs" to "service_role";

grant references on table "public"."audit_logs" to "service_role";

grant select on table "public"."audit_logs" to "service_role";

grant trigger on table "public"."audit_logs" to "service_role";

grant truncate on table "public"."audit_logs" to "service_role";

grant update on table "public"."audit_logs" to "service_role";


  create policy "Admins can read all audit logs"
  on "public"."audit_logs"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'ADMIN'::public."UserRole")))));



  create policy "Authenticated users can insert audit logs"
  on "public"."audit_logs"
  as permissive
  for insert
  to authenticated
with check (true);



