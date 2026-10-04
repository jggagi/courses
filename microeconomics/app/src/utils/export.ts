export function downloadText(text: string, filename: string, mime = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Print the complete notes, including values beyond a textarea's viewport. */
export function printCurrentPage() {
  const root = document.getElementById("main-content");
  if (!root) return;
  const details = [...root.querySelectorAll("details")].map(node => ({ node, open: node.open }));
  details.forEach(({ node }) => { node.open = true; });
  const values: HTMLElement[] = [];
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select").forEach(control => {
    if (control instanceof HTMLInputElement && ["radio", "checkbox", "file"].includes(control.type)) return;
    const value = document.createElement("div");
    value.className = "print-value";
    value.textContent = control instanceof HTMLSelectElement ? control.selectedOptions[0]?.textContent || "未填写" : control.value || "未填写";
    control.after(value);
    values.push(value);
  });
  const restore = () => {
    details.forEach(({ node, open }) => { node.open = open; });
    values.forEach(value => value.remove());
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore, { once: true });
  try { window.print(); } catch (error) { restore(); throw error; }
}
