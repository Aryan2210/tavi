export class Camera {
  private stream: MediaStream | null = null;
  private readonly canvas = document.createElement('canvas');

  constructor(private readonly video: HTMLVideoElement) {}

  get active(): boolean {
    return !!this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live');
  }

  async start(): Promise<void> {
    if (this.active) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.setAttribute('playsinline', '');
    await this.video.play();
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  /** Grab the current frame, downscaled, as a JPEG data URL plus its average brightness (0–255). */
  capture(maxDim = 1024, quality = 0.75): { dataUrl: string; brightness: number } {
    const { videoWidth: w, videoHeight: h } = this.video;
    if (!w || !h) throw new Error('Camera is not ready yet');
    const scale = Math.min(1, maxDim / Math.max(w, h));
    this.canvas.width = Math.round(w * scale);
    this.canvas.height = Math.round(h * scale);
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas is not available');
    ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    const brightness = averageBrightness(ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data);
    return { dataUrl: this.canvas.toDataURL('image/jpeg', quality), brightness };
  }
}

export function averageBrightness(rgba: Uint8ClampedArray, step = 16): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < rgba.length; i += 4 * step) {
    sum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    n++;
  }
  return n ? sum / n : 0;
}
