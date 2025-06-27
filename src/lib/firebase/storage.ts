// src/lib/firebase/storage.ts
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject, type UploadMetadata, updateMetadata } from "firebase/storage";
import { storage } from '../firebase'; // Ensure storage is initialized and exported from firebase.ts

export async function uploadFile(file: File, path: string): Promise<string> {
  console.log("Uploading file to path:", path, "File name:", file.name, "with type:", file.type);
  const fileRef = storageRef(storage, path);

  const metadata: UploadMetadata = {
    contentType: file.type,
  };

  try {
    // 1. Upload with explicit metadata.
    await uploadBytes(fileRef, file, metadata);
    
    // 2. Force update metadata after upload as a failsafe.
    // This can fix cases where the initial metadata is ignored by Firebase Storage.
    await updateMetadata(fileRef, { contentType: file.type });

    // 3. Get the URL only after all operations are complete.
    const downloadURL = await getDownloadURL(fileRef);
    console.log("File uploaded successfully with metadata. Download URL:", downloadURL);
    return downloadURL;

  } catch (error) {
    console.error("Critical error during file upload or metadata update:", error);
    // Re-throw the error to be handled by the calling function
    throw new Error("Failed to upload file or set metadata correctly.");
  }
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
