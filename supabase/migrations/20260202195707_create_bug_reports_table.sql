create extension if not exists "vector" with schema "public";

alter table "public"."data_records" alter column "embedding" set data type public.vector using "embedding"::public.vector;


