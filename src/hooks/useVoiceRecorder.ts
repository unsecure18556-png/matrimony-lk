import { useCallback, useEffect, useRef, useState } from "react";

const MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
export const MAX_VOICE_SECONDS = 120;

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const startedAt = useRef(0);

  const cleanup = useCallback(() => {
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null; rec.current = null; chunks.current = [];
    setRecording(false); setSeconds(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
      throw new Error("Voice recording is not supported in this browser.");
    try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { throw new Error("Microphone permission was denied. Allow microphone access in your browser settings."); }
    const mime = MIMES.find((m) => MediaRecorder.isTypeSupported(m));
    const r = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.start();
    rec.current = r; startedAt.current = Date.now();
    setRecording(true); setSeconds(0);
    timer.current = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
  }, []);

  const stop = useCallback((): Promise<{ blob: Blob; seconds: number } | null> => new Promise((resolve) => {
    const r = rec.current;
    if (!r) return resolve(null);
    const secs = (Date.now() - startedAt.current) / 1000;
    r.onstop = () => {
      const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
      cleanup();
      resolve(blob.size > 0 ? { blob, seconds: secs } : null);
    };
    r.stop();
  }), [cleanup]);

  return { recording, seconds, start, stop, cancel: cleanup };
}
