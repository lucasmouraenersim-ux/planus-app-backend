'use server';
/**
 * @fileOverview A server action to handle user photo enhancement requests.
 * It uploads the original photo to storage and creates a request document in Firestore.
 */

import { z } from 'zod';
import { initializeAdmin } from '@/lib/firebase/admin';
import { uploadFile } from '@/lib/firebase/storage';
import { getAuth } from 'firebase-admin/auth';
import type { UserRecord } from 'firebase-admin/auth';
import admin from 'firebase-admin';

// Define valid enhancement types
const EnhancementTypeSchema = z.enum(['upscale_leve', 'noturna', 'hdr']);
export type EnhancementType = z.infer<typeof EnhancementTypeSchema>;

const UploadRequestInputSchema = z.object({
  photoDataUri: z.string().describe("A photo to be enhanced, as a data URI."),
  enhancementType: EnhancementTypeSchema,
  userId: z.string().min(1, "User ID is required."),
});
export type UploadRequestInput = z.infer<typeof UploadRequestInputSchema>;

const UploadRequestOutputSchema = z.object({
  success: z.boolean(),
  requestId: z.string().optional(),
  message: z.string(),
});
export type UploadRequestOutput = z.infer<typeof UploadRequestOutputSchema>;

// Helper function to extract file extension from data URI
function getFileExtensionFromDataUri(dataUri: string): string {
    const mimeType = dataUri.substring(dataUri.indexOf(':') + 1, dataUri.indexOf(';'));
    switch (mimeType) {
        case 'image/jpeg': return 'jpg';
        case 'image/png': return 'png';
        case 'image/webp': return 'webp';
        default: return 'jpg'; // Default to jpg
    }
}

export async function uploadEnhancementRequest(input: UploadRequestInput): Promise<UploadRequestOutput> {
  try {
    const adminDb = await initializeAdmin();
    const adminAuth = getAuth();
    
    let user: UserRecord;
    try {
        user = await adminAuth.getUser(input.userId);
    } catch (error) {
        console.error("Failed to fetch user:", error);
        return { success: false, message: "Usuário não encontrado." };
    }

    const requestsRef = adminDb.collection('photoEnhancementRequests');
    const newRequestRef = requestsRef.doc(); // Create a new document reference to get the ID
    const requestId = newRequestRef.id;
    
    const fileExtension = getFileExtensionFromDataUri(input.photoDataUri);
    const imagePath = `enhancement_requests/${input.userId}/${requestId}_original.${fileExtension}`;

    // Convert data URI to a Buffer for upload
    const base64Data = input.photoDataUri.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // We need to pass the file buffer and mime type to uploadFile
    const mimeType = `image/${fileExtension}`;
    
    // This is a temporary solution as uploadFile expects a File object.
    // We'll create a lightweight object that mimics the necessary File properties for the upload function.
    const pseudoFile = {
        name: `${requestId}_original.${fileExtension}`,
        type: mimeType,
        arrayBuffer: () => imageBuffer,
    } as any; // Cast to 'any' to bypass strict File type checking for this specific server-side case

    const originalImageUrl = await uploadFile(pseudoFile, imagePath);

    const requestData = {
      userId: input.userId,
      userName: user.displayName || user.email || 'Usuário Desconhecido',
      userPhoto: user.photoURL || null,
      originalImageUrl,
      enhancementType: input.enhancementType,
      status: 'pending' as 'pending' | 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      enhancedImageUrl: null,
      adminNotes: null,
    };

    await newRequestRef.set(requestData);

    return {
      success: true,
      requestId: requestId,
      message: 'Sua solicitação de aprimoramento foi enviada com sucesso!',
    };
  } catch (error) {
    console.error("Error creating enhancement request:", error);
    const errorMessage = error instanceof Error ? error.message : "Um erro desconhecido ocorreu.";
    return {
      success: false,
      message: `Falha ao enviar solicitação: ${errorMessage}`,
    };
  }
}
