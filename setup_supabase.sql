-- Script de Configuração do Supabase Storage
-- Execute este script no SQL Editor do seu Dashboard Supabase (https://app.supabase.com)

-- 1. Criar o bucket 'receipts'
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Configurar Políticas de Acesso (RLS) para o bucket 'receipts'

-- Permitir acesso público de leitura (SELECT)
CREATE POLICY "Acesso Público de Leitura"
ON storage.objects FOR SELECT
USING ( bucket_id = 'receipts' );

-- Permitir uploads (INSERT) apenas para utilizadores autenticados
CREATE POLICY "Uploads para Utilizadores Autenticados"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'receipts' 
  AND auth.role() = 'authenticated'
);

-- Permitir eliminação (DELETE) apenas para o dono do ficheiro
CREATE POLICY "Eliminação pelo Proprietário"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. (Opcional) Criar bucket 'avatars' caso não exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Acesso Público Avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "Uploads Avatars Autenticados"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 4. Adicionar a coluna is_cleared à tabela transactions, caso não exista
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_cleared BOOLEAN DEFAULT false;
