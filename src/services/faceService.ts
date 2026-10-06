import { supabase } from "./supabase";
import { getCards, type ProfileCard } from "./cardService";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";

type FaceApi = typeof import("@vladmandic/face-api");
let apiPromise: Promise<FaceApi> | null = null;

/** Loads the face recognition library + models once (runs in the browser). */
export function loadFaceApi(): Promise<FaceApi> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      const tf = faceapi.tf as any;
      try { await tf.setBackend("webgl"); } catch { await tf.setBackend("cpu"); }
      await tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      return faceapi;
    })().catch((e) => { apiPromise = null; throw e; });
  }
  return apiPromise;
}

export async function descriptorFrom(input: HTMLImageElement | HTMLVideoElement): Promise<number[]> {
  const faceapi = await loadFaceApi();
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 });
  const faces = await faceapi.detectAllFaces(input, opts).withFaceLandmarks().withFaceDescriptors();
  if (faces.length === 0) throw new Error("No face found. Use a clear, front-facing, well-lit photo.");
  if (faces.length > 1) throw new Error(`Found ${faces.length} faces. Only you should be in the picture.`);
  return Array.from(faces[0].descriptor);
}

export async function loadPhotoImage(path: string): Promise<HTMLImageElement> {
  const { data, error } = await supabase.storage.from("profile-photos").download(path);
  if (error || !data) throw new Error("Could not load your photo");
  const img = new Image();
  img.src = URL.createObjectURL(data);
  await img.decode();
  return img;
}

export interface EnrollResult { verified: boolean; distance: number; duplicate_flag?: boolean }

export async function enrollFace(photo: number[], selfie: number[], optIn: boolean): Promise<EnrollResult> {
  const { data, error } = await supabase.rpc("enroll_face", { p_photo: photo, p_selfie: selfie, p_opt_in: optIn });
  if (error) throw error;
  return data as EnrollResult;
}

export async function deleteFaceData() {
  const { error } = await supabase.rpc("delete_face_data");
  if (error) throw error;
}

export async function faceSuggestions(): Promise<ProfileCard[]> {
  const { data, error } = await supabase.rpc("face_suggestions", { p_limit: 24 });
  if (error) throw error;
  return getCards((data ?? []).map((r: { profile_id: string }) => r.profile_id));
}
