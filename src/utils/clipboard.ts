export async function copyText(text: string): Promise<boolean> {
  // Primary: async clipboard API (best on modern mobile)
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}

  // Fallback: select text from a hidden element (avoids showing the keyboard on mobile)
  try {
    const pre = document.createElement("pre");
    pre.textContent = text;
    pre.style.position = "fixed";
    pre.style.left = "-9999px";
    pre.style.top = "0";
    pre.style.userSelect = "text";
    pre.style.whiteSpace = "pre";
    document.body.appendChild(pre);

    const range = document.createRange();
    range.selectNodeContents(pre);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const ok = document.execCommand("copy");
    sel?.removeAllRanges();
    pre.remove();
    return ok;
  } catch {
    return false;
  }
}
