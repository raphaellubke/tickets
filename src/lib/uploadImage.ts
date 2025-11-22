import { createClient } from '@/lib/supabase/client';

export interface UploadImageOptions {
    bucket?: string;
    folder?: string;
    maxSizeMB?: number;
}

export interface UploadImageResult {
    url: string;
    path: string;
    error?: string;
}

/**
 * Upload an image to Supabase Storage
 * @param file - The file to upload
 * @param options - Upload options
 * @returns Promise with the public URL and path
 */
export async function uploadImage(
    file: File,
    options: UploadImageOptions = {}
): Promise<UploadImageResult> {
    const {
        bucket = 'event-images',
        folder = 'events',
        maxSizeMB = 5
    } = options;

    try {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            return { url: '', path: '', error: 'O arquivo deve ser uma imagem' };
        }

        // Validate file size
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            return { url: '', path: '', error: `A imagem deve ter no máximo ${maxSizeMB}MB` };
        }

        const supabase = createClient();

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        // Upload file
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Upload error:', error);
            return { url: '', path: '', error: 'Erro ao fazer upload da imagem' };
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return {
            url: publicUrl,
            path: filePath
        };
    } catch (error) {
        console.error('Unexpected error:', error);
        return { url: '', path: '', error: 'Erro inesperado ao fazer upload' };
    }
}

/**
 * Delete an image from Supabase Storage
 * @param path - The file path to delete
 * @param bucket - The storage bucket name
 * @returns Promise with success status
 */
export async function deleteImage(
    path: string,
    bucket: string = 'event-images'
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = createClient();

        const { error } = await supabase.storage
            .from(bucket)
            .remove([path]);

        if (error) {
            console.error('Delete error:', error);
            return { success: false, error: 'Erro ao deletar imagem' };
        }

        return { success: true };
    } catch (error) {
        console.error('Unexpected error:', error);
        return { success: false, error: 'Erro inesperado ao deletar imagem' };
    }
}
