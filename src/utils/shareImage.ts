import * as htmlToImage from "html-to-image";

async function tryShareFile(file: File): Promise<boolean> {
  const nav: any = navigator as any;
  if (!nav.share) return false;
  try {
    await nav.share({ files: [file], title: "Session Results" });
    return true;
  } catch {
    return false;
  }
}

async function tryCopyImage(blob: Blob): Promise<boolean> {
  const nav: any = navigator as any;
  if (!nav.clipboard || !(window as any).ClipboardItem) return false;
  try {
    const item = new (window as any).ClipboardItem({ "image/png": blob });
    await nav.clipboard.write([item]);
    return true;
  } catch {
    return false;
  }
}

export async function shareElementAsPng(
  el: HTMLElement,
  opts?: { title?: string; filename?: string }
): Promise<{ ok: boolean; message: string }> {
  const filename = opts?.filename ?? "results.png";
  try {
    // Capture full scroll size (important for wide tables)
    const width = Math.max(el.scrollWidth, el.clientWidth);
    const height = Math.max(el.scrollHeight, el.clientHeight);

    const dataUrl = await htmlToImage.toPng(el, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#0b1220",
      width,
      height,
      style: {
        transform: "scale(1)",
        transformOrigin: "top left",
        overflow: "visible",
      },
    });

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: "image/png" });

    if (await tryShareFile(file)) return { ok: true, message: "Shared" };
    if (await tryCopyImage(blob)) return { ok: true, message: "Copied image" };

    return { ok: false, message: "Sharing not supported on this device/browser" };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Share failed" };
  }
}
