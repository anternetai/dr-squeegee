// Shrinking a field photo before it leaves the phone.
//
// A raw phone photo is 3-4MB. At full size the free storage tier is gone in a
// few months, and a crew member on LTE in a driveway waits on every upload — so
// this is correctness, not micro-optimisation. Shared by the file-input fallback
// (compress) and the live camera (captureFrame).

export const MAX_EDGE = 1600
export const QUALITY = 0.8

function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process that photo."))),
      "image/jpeg",
      QUALITY
    )
  })
}

/** A file the tech picked (or shot with the OS camera) -> a ~250KB JPEG. */
export async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("no canvas")
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return encode(canvas)
}

/**
 * The current frame of a live <video> preview -> the same ~250KB JPEG. The video
 * element is already capped at 1600px by the getUserMedia constraint, but a
 * phone that ignores `width: { ideal }` would hand back 4032px, so cap here too.
 */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) throw new Error("Camera isn't ready yet.")
  const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh))
  const w = Math.round(vw * scale)
  const h = Math.round(vh * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("no canvas")
  ctx.drawImage(video, 0, 0, w, h)
  return encode(canvas)
}

/** crypto.randomUUID needs a secure context; a local key never leaves the tab. */
export function localKey(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === "function") return c.randomUUID()
  return `k${Date.now()}${Math.random().toString(16).slice(2)}`
}
