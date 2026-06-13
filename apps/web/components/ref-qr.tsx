"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";

/**
 * Renders the QR code for a partner's referral link as inline SVG, with
 * download (.svg) and print actions. The code is generated client-side from
 * the link; it is never stored, so re-rendering a partner always shows the
 * same code without us regenerating their ref_code.
 */
export function RefQr({ url, label }: { url: string; label?: string }) {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toString(url, { type: "svg", margin: 1, width: 220, errorCorrectionLevel: "M" })
      .then((s) => active && setSvg(s))
      .catch(() => active && setSvg(""));
    return () => {
      active = false;
    };
  }, [url]);

  function download() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${(label || "referral").replace(/\s+/g, "-").toLowerCase()}-qr.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function print() {
    if (!svg) return;
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) return;
    w.document.write(
      `<html><head><title>${label || "Referral"} QR</title></head>` +
        `<body style="font-family:system-ui,sans-serif;text-align:center;padding:32px">` +
        (label ? `<h2 style="margin:0 0 16px">${label}</h2>` : "") +
        `<div style="display:inline-block;width:260px;height:260px">${svg}</div>` +
        `<p style="font-size:13px;color:#444;margin-top:16px;word-break:break-all">${url}</p>` +
        `</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="h-[200px] w-[200px] rounded-xl border border-ink/10 bg-white p-2"
        aria-label="Referral QR code"
        dangerouslySetInnerHTML={{ __html: svg || "" }}
      />
      <div className="max-w-[240px] break-all text-center text-xs text-ink/55">{url}</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={download}
          disabled={!svg}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-bold text-ink/75 hover:bg-smoke disabled:opacity-50"
        >
          <Download size={15} aria-hidden /> SVG
        </button>
        <button
          type="button"
          onClick={print}
          disabled={!svg}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-bold text-ink/75 hover:bg-smoke disabled:opacity-50"
        >
          <Printer size={15} aria-hidden /> Print
        </button>
      </div>
    </div>
  );
}
