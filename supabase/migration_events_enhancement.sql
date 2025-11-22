-- Migration: Add additional fields to events table and RLS policies
-- Created: 2025-11-22

-- Add new fields to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS cover_image_url text,
ADD COLUMN IF NOT EXISTS ticket_types jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS max_attendees int,
ADD COLUMN IF NOT EXISTS category text;

-- Update image_url to cover_image_url for consistency (if needed)
-- We'll keep both for backwards compatibility

-- Add RLS policies for event creation and management
CREATE POLICY IF NOT EXISTS "Members can create events for their organization" 
  ON public.events FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = events.organization_id 
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY IF NOT EXISTS "Members can update their organization events" 
  ON public.events FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = events.organization_id 
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY IF NOT EXISTS "Members can delete their organization events" 
  ON public.events FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = events.organization_id 
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Create storage bucket for event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY IF NOT EXISTS "Authenticated users can upload event images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'event-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY IF NOT EXISTS "Public can view event images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-images');

CREATE POLICY IF NOT EXISTS "Users can update their uploaded images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'event-images' 
    AND auth.uid() = owner
  );

CREATE POLICY IF NOT EXISTS "Users can delete their uploaded images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'event-images' 
    AND auth.uid() = owner
  );
