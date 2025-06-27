
// src/lib/firebase/storage.ts
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject, type UploadMetadata } from "firebase/storage";
import { storage } from '../firebase'; // Ensure storage is initialized and exported from firebase.ts

export async function uploadFile(file: File, path: string): Promise<string> {
  console.log("Uploading file to path:", path, "File name:", file.name, "with type:", file.type);
  const fileRef = storageRef(storage, path);

  const metadata: UploadMetadata = {
    contentType: file.type,
  };

  await uploadBytes(fileRef, file, metadata);
  const downloadURL = await getDownloadURL(fileRef);
  console.log("File uploaded successfully with metadata. Download URL:", downloadURL);
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
