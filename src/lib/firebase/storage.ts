
// src/lib/firebase/storage.ts
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject, type UploadMetadata, updateMetadata } from "firebase/storage";
import { storage } from '../firebase'; // Ensure storage is initialized and exported from firebase.ts

export async function uploadFile(file: File, path: string): Promise<string> {
  console.log("Uploading file to path:", path, "File name:", file.name, "with type:", file.type);
  const fileRef = storageRef(storage, path);

  const metadata: UploadMetadata = {
    contentType: file.type,
  };

  // 1. Upload with metadata
  await uploadBytes(fileRef, file, metadata);
  
  // 2. Force update metadata after upload as a safety measure.
  // This can fix cases where the initial metadata is ignored by Firebase Storage.
  try {
    await updateMetadata(fileRef, { contentType: file.type });
    console.log("Successfully verified/updated metadata contentType to:", file.type);
  } catch (error) {
    console.error("Could not update metadata after upload. This might cause issues with WhatsApp.", error);
    // Depending on strictness, you might want to throw an error here.
    // For now, we'll log a warning and continue.
  }

  const downloadURL = await getDownloadURL(fileRef);
  console.log("File uploaded successfully. Download URL:", downloadURL);
  return downloadURL;
}

export async function deleteFileByUrl(fileUrl: string): Promise<void> {
  console.log("Attempting to delete file by URL:", fileUrl);
  try {
    // Firebase Storage URLs for web usually include the bucket name in the domain
    // or path, and may include access tokens. The `refFromURL` method
    // is robust for handling gs:// and https:// URLs.
    const fileRef = storageRef(storage, fileUrl);
    await deleteObject(fileRef);
    console.log("File deleted successfully:", fileUrl);
  } catch (error: any) {
    // It's common for delete to fail if the file doesn't exist or permissions are wrong.
    // Sometimes, if a URL is old or malformed, it might also fail.
    if (error.code === 'storage/object-not-found') {
      console.warn("File not found for deletion, it might have been already deleted:", fileUrl);
    } else {
      console.error("Error deleting file by URL:", error);
    }
    // Depending on the app's needs, you might re-throw or handle specific errors.
  }
}
