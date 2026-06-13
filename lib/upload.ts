import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "./firebase";

export type DocKind = "dl" | "rc" | "selfie";

/**
 * Upload a local image (file:// URI from the image picker) to Firebase
 * Storage under `rider-docs/{uid}/{kind}.jpg` and return its download URL.
 * The backend stores the URL; admins review the image before approval.
 */
export async function uploadRiderDocument(
  kind: DocKind,
  localUri: string,
): Promise<string> {
  const storage = getFirebaseStorage();
  const auth = getFirebaseAuth();
  const uid = auth?.currentUser?.uid;
  if (!storage || !uid) {
    throw new Error("Not signed in — please log in again before uploading.");
  }

  // Fetch the local file into a blob for upload.
  const response = await fetch(localUri);
  const blob = await response.blob();

  const objectRef = ref(storage, `rider-docs/${uid}/${kind}.jpg`);
  await uploadBytes(objectRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(objectRef);
}
