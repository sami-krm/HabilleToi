insert into storage.buckets (id, name, public)
values ('wardrobe-backups', 'wardrobe-backups', false)
on conflict (id) do nothing;

create policy "Users can read their own wardrobe backup"
on storage.objects for select to authenticated
using (
  bucket_id = 'wardrobe-backups'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload their own wardrobe backup"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'wardrobe-backups'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their own wardrobe backup"
on storage.objects for update to authenticated
using (
  bucket_id = 'wardrobe-backups'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'wardrobe-backups'
  and (storage.foldername(name))[1] = auth.uid()::text
);
