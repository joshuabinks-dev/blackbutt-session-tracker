import * as htmlToImage from "html-to-image";

export async function shareElementAsPng(el: HTMLElement, filename="results.png"): Promise<{ok:boolean; message:string}>{
  try{
    const dataUrl = await htmlToImage.toPng(el, { cacheBust:true, pixelRatio:2, backgroundColor:"#0b1220" });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type:"image/png" });
    if (navigator.share && (navigator as any).canShare?.({ files:[file] })) {
      await navigator.share({ files:[file], title:"Session Results" });
      return { ok:true, message:"Shared" };
    }
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    return { ok:true, message:"Opened image" };
  }catch(e:any){
    return { ok:false, message: e?.message || "Share failed" };
  }
}
