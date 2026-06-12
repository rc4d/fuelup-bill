import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import { toJpeg } from "html-to-image";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IndianOil Bill Generator | Mumbai Petrol Receipt PDF" },
      { name: "description", content: "Generate print-ready IndianOil (IOCL) petrol pump bills for Mumbai & Navi Mumbai. Download as PDF." },
    ],
  }),
  component: Index,
});

const RATES: Record<string, number> = {
  Petrol: 103.44,
  Diesel: 89.97,
  "XP95 Premium Petrol": 109.12,
};

function rand(n: number) { return Math.floor(Math.random() * n); }
function pad(n: number, w: number) { return String(n).padStart(w, "0"); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}
function nowTime() {
  const d = new Date();
  return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`;
}

function formatDateShort(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

type Meta = {
  invNo: string;
  fccId: string;
  fipNo: string;
  nozzleNo: string;
  atot: string;
  vtot: string;
  printedDate: string;
  printedTime: string;
};

function genMeta(date: string, time: string): Meta {
  return {
    invNo: `${pad(rand(1000000000000), 12)}E${pad(rand(1000000), 6)}`.slice(0, 21),
    fccId: pad(rand(1000000000), 16),
    fipNo: pad(1 + rand(6), 2),
    nozzleNo: pad(1 + rand(4), 2),
    atot: (100000000 + Math.random() * 50000000).toFixed(2).padStart(11, "0"),
    vtot: (1000000 + Math.random() * 500000).toFixed(3).padStart(11, "0"),
    printedDate: formatDateShort(date),
    printedTime: time,
  };
}

function Index() {
  const [qty, setQty] = useState("4.22");
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(nowTime());
  const [fuel, setFuel] = useState<keyof typeof RATES>("Petrol");
  const [rate, setRate] = useState<number>(RATES["Petrol"]);
  const [meta, setMeta] = useState<Meta | null>(null);

  // Client-only random meta to avoid hydration mismatch
  useEffect(() => { setMeta(genMeta(date, time)); }, []);
  useEffect(() => { setRate(RATES[fuel]); }, [fuel]);

  const q = Math.max(0, parseFloat(qty) || 0);
  const r = Math.max(0, parseFloat(String(rate)) || 0);
  const total = Math.round(q * r * 100) / 100;

  const billRef = useRef<HTMLDivElement>(null);

  async function downloadPDF() {
    if (!billRef.current) return;
    const el = billRef.current;
    try {
      const dataUrl = await toJpeg(el, {
        pixelRatio: 2,
        quality: 0.88,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const imgEl = new Image();
      imgEl.src = dataUrl;
      await new Promise((res) => { imgEl.onload = res; });
      const widthMM = 80;
      const heightMM = (imgEl.height / imgEl.width) * widthMM;
      const pdf = new jsPDF({ unit: "mm", format: [widthMM, heightMM], orientation: "portrait", compress: true });
      pdf.addImage(dataUrl, "JPEG", 0, 0, widthMM, heightMM);
      const [, m, day] = date.split("-").map(Number);
      const _months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const _fname = `${pad(day, 2)}${_months[m - 1]}_₹${Math.floor(total)}_${meta?.invNo ?? "receipt"}_FuelBill.pdf`;
      pdf.save(_fname);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  }

  const regenerate = () => setMeta(genMeta(date, time));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <IOCLLogo className="h-9" />
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-tight">IndianOil Bill Generator</h1>
            <p className="text-xs text-slate-500">Thermal receipt · Mumbai & Navi Mumbai</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* FORM */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 h-fit">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Bill Details</h2>
          <div className="space-y-4">
            <Field label="Fuel Type">
              <select
                value={fuel}
                onChange={(e) => setFuel(e.target.value as keyof typeof RATES)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {Object.keys(RATES).map((k) => <option key={k}>{k}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Volume (Litres)">
                <input type="number" step="0.01" min="0" value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="Rate (₹/L)">
                <input type="number" step="0.01" min="0" value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="Time">
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </Field>
            </div>

            <div className="pt-2 flex gap-2">
              <button onClick={regenerate}
                className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium rounded-md py-2.5 hover:bg-slate-50 transition">
                Regenerate IDs
              </button>
              <button onClick={downloadPDF}
                className="flex-1 bg-[#E8411A] hover:bg-[#cc3814] text-white text-sm font-medium rounded-md py-2.5 transition">
                Download PDF
              </button>
            </div>

            <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
              Total: <span className="font-semibold text-slate-900">₹{total.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* PREVIEW — thermal receipt */}
        <section>
          <div className="text-xs text-slate-500 mb-2">Live Preview (80mm thermal)</div>
          <div className="overflow-auto flex justify-center">
            {meta && (
              <div
                ref={billRef}
                className="bg-white text-black"
                style={{
                  width: "302px", // ~80mm @ ~96dpi
                  padding: "18px 16px",
                  fontFamily: "'Courier New', ui-monospace, monospace",
                  fontSize: "13px",
                  lineHeight: 1.35,
                  color: "#111",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: 10 }}>
                  <div style={{
                    position: "relative",
                    width: 90, height: 90,
                    border: "2.5px solid #111", borderRadius: "50%",
                    margin: "0 auto",
                  }}>
                    <div style={{
                      position: "absolute",
                      width: 80, height: 80,
                      border: "1px solid #111", borderRadius: "50%",
                      top: "50%", left: "50%",
                      transform: "translate(-50%, -50%)",
                    }} />
                    <span style={{
                      position: "absolute",
                      top: "50%", left: "50%",
                      transform: "translate(-50%, -50%)",
                      background: "#111", color: "#fff",
                      width: 78, height: 18,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                      fontFamily: "system-ui, sans-serif",
                      whiteSpace: "nowrap",
                      borderRadius: "5%",
                    }}>इंडियनऑयल</span>
                  </div>
                  <div style={{ fontWeight: 650, fontSize: 20, marginTop: 8, fontFamily: "system-ui, sans-serif", color: "#111" }}>
                    IndianOil
                  </div>
                  <div style={{ fontWeight: 400, fontSize: 20, marginTop: 6 }}>Welcomes You</div>
                </div>


                <Line label="Tel. No." value="" />
                <div style={{ height: 14 }} />
                <Line label="Inv.No" value={meta.invNo} />
                <Line label="FCC ID" value={meta.fccId} />
                <Line label="FIP No" value={meta.fipNo} />
                <Line label="Nozzle No" value={meta.nozzleNo} />
                <Line label="Product" value={fuel} />

                <div style={{ height: 10 }} />
                <Line label="Preset Type" value="Volume" />
                <Line label="Rate(Rs/L)" value={r.toFixed(2)} alignRight />
                <Line label="Volume(L)" value={q.toFixed(2).padStart(8, "0")} alignRight />
                <Line label="Amount(Rs)" value={total.toFixed(2).padStart(8, "0")} alignRight />
                <Line label="Atot" value={meta.atot} />
                <Line label="Vtot" value={meta.vtot} />

                <div style={{ height: 10 }} />
                <Line label="Vehicle No" value="Not Entered" />
                <Line label="Mobile No" value="Not Entered" />

                <div style={{ height: 10 }} />
                <Line label="Date" value={formatDateShort(date)} />
                <Line label="Time" value={time} />

                <div style={{ height: 18 }} />
                <div>Thank You! Please Visit</div>
                <div>Again..</div>

              <div style={{ height: 14 }} />
                <div>Printed on:</div>
                <div>{formatDateShort(date)} {time}</div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function Line({ label, value, alignRight }: { label: string; value: string; alignRight?: boolean }) {
  // Format: "Label : value" with colon aligned
  const labelWidth = 11;
  const paddedLabel = label.padEnd(labelWidth, " ");
  return (
    <div style={{ whiteSpace: "pre", display: "flex" }}>
      <span>{paddedLabel}: </span>
      <span style={{ marginLeft: alignRight ? "auto" : 0 }}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function IOCLLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 60" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M28 6 C 18 18, 14 28, 20 40 C 12 36, 10 28, 14 22 C 14 32, 22 36, 22 44 C 22 52, 30 56, 36 52 C 44 48, 46 38, 40 30 C 38 38, 34 40, 32 36 C 36 28, 36 18, 28 6 Z"
        fill="#E8411A" />
      <circle cx="30" cy="40" r="4" fill="#FFC400" />
      <text x="56" y="32" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="700" fill="#1A1A1A">Indian</text>
      <text x="56" y="50" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="700" fill="#E8411A">Oil</text>
    </svg>
  );
}
