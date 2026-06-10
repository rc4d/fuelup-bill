import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IndianOil Bill Generator | Mumbai Petrol Receipt PDF" },
      { name: "description", content: "Generate print-ready IndianOil (IOCL) petrol pump bills for Mumbai & Navi Mumbai. Download as PDF." },
      { property: "og:title", content: "IndianOil Petrol Bill Generator" },
      { property: "og:description", content: "Create downloadable IOCL fuel receipts for Mumbai/Navi Mumbai outlets." },
    ],
  }),
  component: Index,
});

const OUTLETS = [
  { name: "HINDUSTAN SERVICE STATION", code: "HSS", addr: "Plot No. 14, Sion-Panvel Highway, Kharghar, Navi Mumbai - 410210" },
  { name: "SHREE GANESH FUELS", code: "SGF", addr: "S.V. Road, Andheri West, Mumbai - 400058" },
  { name: "KOHINOOR AUTO SERVICES", code: "KAS", addr: "LBS Marg, Kurla West, Mumbai - 400070" },
  { name: "SAGAR PETROLEUM", code: "SGP", addr: "Palm Beach Road, Vashi, Navi Mumbai - 400703" },
  { name: "MAHALAXMI FILLING STATION", code: "MFS", addr: "Dr. E. Moses Road, Worli, Mumbai - 400018" },
  { name: "BOMBAY AUTO CENTRE", code: "BAC", addr: "Western Express Highway, Bandra East, Mumbai - 400051" },
  { name: "NEW BHARAT SERVICE STATION", code: "NBS", addr: "Eastern Express Highway, Ghatkopar East, Mumbai - 400077" },
  { name: "KHARGHAR FUEL POINT", code: "KHR", addr: "Sector 12, Kharghar, Navi Mumbai - 410210" },
  { name: "VASHI HIGHWAY FUELS", code: "VHF", addr: "Thane-Belapur Road, Vashi, Navi Mumbai - 400705" },
  { name: "POWAI AUTO SERVICES", code: "PAS", addr: "Hiranandani Gardens, Powai, Mumbai - 400076" },
];

const RATES: Record<string, number> = {
  Petrol: 103.44,
  Diesel: 89.97,
  "XP95 Premium Petrol": 109.12,
};

const HSN: Record<string, string> = {
  Petrol: "27101290",
  Diesel: "27101944",
  "XP95 Premium Petrol": "27101290",
};

function rand(n: number) { return Math.floor(Math.random() * n); }
function pad(n: number, w: number) { return String(n).padStart(w, "0"); }

function genGSTIN() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const L = () => letters[rand(26)];
  const D = () => String(rand(10));
  return `27${L()}${L()}${L()}${L()}${L()}${D()}${D()}${D()}${D()}${L()}1Z${D()}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}
function nowTime() {
  const d = new Date();
  return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`;
}

function shiftOf(t: string) {
  const h = parseInt(t.split(":")[0] || "0", 10);
  if (h >= 6 && h < 14) return "Morning (06:00–14:00)";
  if (h >= 14 && h < 22) return "Afternoon (14:00–22:00)";
  return "Night (22:00–06:00)";
}

function formatDateDMY(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function Index() {
  const [qty, setQty] = useState("5.00");
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(nowTime());
  const [fuel, setFuel] = useState<keyof typeof RATES>("Petrol");
  const [rate, setRate] = useState<number>(RATES["Petrol"]);
  const [payment, setPayment] = useState<"Cash" | "UPI" | "Card">("UPI");
  const [cardLast4, setCardLast4] = useState("4242");
  const [duplicate, setDuplicate] = useState(false);

  // Stable per-session meta
  const meta = useMemo(() => {
    const outlet = OUTLETS[rand(OUTLETS.length)];
    return {
      outlet,
      gstin: genGSTIN(),
      mobile: `9820${pad(rand(1000000), 6)}`,
      pumpNo: 1 + rand(6),
      nozzleNo: 1 + rand(4),
      attendant: `ATT-${pad(rand(1000), 3)}`,
      upiRef: Array.from({ length: 12 }, () => rand(10)).join(""),
      seq: pad(rand(100000), 5),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setRate(RATES[fuel]); }, [fuel]);

  const q = Math.max(0, parseFloat(qty) || 0);
  const r = Math.max(0, parseFloat(String(rate)) || 0);
  const total = Math.round(q * r * 100) / 100;

  const breakup = {
    base: +(total * 0.57).toFixed(2),
    excise: +(total * 0.18).toFixed(2),
    vat: +(total * 0.16).toFixed(2),
    dealer: +(total * 0.04).toFixed(2),
    other: +(total * 0.05).toFixed(2),
  };

  const yymm = (date || todayStr()).slice(2, 7).replace("-", "");
  const invoiceNo = `IND/MUM/${meta.outlet.code}/${yymm}/${meta.seq}`;

  const billRef = useRef<HTMLDivElement>(null);

  async function downloadPDF() {
    if (!billRef.current) return;
    const canvas = await html2canvas(billRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/png");
    // A5 portrait: 148 x 210 mm
    const pdf = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    let w = pw, h = pw / ratio;
    if (h > ph) { h = ph; w = ph * ratio; }
    pdf.addImage(img, "PNG", (pw - w) / 2, 0, w, h);
    pdf.save(`IndianOil_Receipt_${invoiceNo.replace(/\//g, "-")}_${date}.pdf`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <IOCLLogo className="h-9" />
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-tight">IndianOil Bill Generator</h1>
            <p className="text-xs text-slate-500">Mumbai & Navi Mumbai retail outlets</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[420px_1fr]">
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
              <Field label="Quantity (Litres)">
                <input
                  type="number" step="0.01" min="0" value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Rate (₹/L)">
                <input
                  type="number" step="0.01" min="0" value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input
                  type="date" value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Time">
                <input
                  type="time" value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label="Payment Method">
              <div className="flex gap-2">
                {(["Cash", "UPI", "Card"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPayment(p)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                      payment === p
                        ? "border-[#E8411A] bg-[#E8411A]/10 text-[#E8411A] font-medium"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >{p}</button>
                ))}
              </div>
            </Field>

            {payment === "Card" && (
              <Field label="Card Last 4 Digits">
                <input
                  type="text" maxLength={4} value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={duplicate} onChange={(e) => setDuplicate(e.target.checked)} />
              Mark as DUPLICATE copy
            </label>

            <div className="pt-2 flex gap-2">
              <button
                onClick={downloadPDF}
                className="flex-1 bg-[#E8411A] hover:bg-[#cc3814] text-white text-sm font-medium rounded-md py-2.5 transition"
              >Download PDF</button>
            </div>

            <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
              Total: <span className="font-semibold text-slate-900">₹{total.toFixed(2)}</span> · Invoice {invoiceNo}
            </div>
          </div>
        </section>

        {/* PREVIEW */}
        <section>
          <div className="text-xs text-slate-500 mb-2">Live Preview (A5)</div>
          <div className="overflow-auto">
            <div
              ref={billRef}
              className="relative bg-white text-[#1A1A1A] mx-auto shadow-sm border border-slate-200"
              style={{ width: "560px", minHeight: "794px", padding: "24px", fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              {duplicate && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                  style={{ transform: "rotate(-30deg)", color: "rgba(232,65,26,0.12)", fontSize: "110px", fontWeight: 800, letterSpacing: "8px" }}
                >DUPLICATE</div>
              )}

              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-[#E8411A] pb-3">
                <div className="flex items-center gap-3">
                  <IOCLLogo className="h-12" />
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.2em] text-[#E8411A]">RETAIL OUTLET</div>
                    <div className="text-[15px] font-bold leading-tight">{meta.outlet.name}</div>
                    <div className="text-[10px] text-slate-700 leading-snug max-w-[280px]">{meta.outlet.addr}</div>
                  </div>
                </div>
                <div className="text-right text-[10px] text-slate-700 leading-snug">
                  <div>GSTIN: <span className="font-mono">{meta.gstin}</span></div>
                  <div>SAC: 999713</div>
                  <div>Mob: {meta.mobile}</div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center my-3">
                <div className="inline-block px-4 py-1 border border-[#1A1A1A] text-[11px] font-bold tracking-widest">
                  TAX INVOICE / CASH MEMO
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] border border-slate-300 p-2.5">
                <Row k="Invoice No" v={invoiceNo} mono />
                <Row k="Date" v={formatDateDMY(date)} />
                <Row k="Time" v={time} />
                <Row k="Shift" v={shiftOf(time)} />
                <Row k="Pump No" v={String(meta.pumpNo)} />
                <Row k="Nozzle No" v={String(meta.nozzleNo)} />
                <Row k="Attendant" v={meta.attendant} />
                <Row k="Payment" v={payment} />
              </div>

              {/* Fuel table */}
              <table className="w-full mt-3 text-[11px] border border-slate-300">
                <thead className="bg-[#E8411A]/10 text-[#1A1A1A]">
                  <tr>
                    <th className="text-left p-2 border-b border-slate-300">Description</th>
                    <th className="text-center p-2 border-b border-slate-300">HSN/SAC</th>
                    <th className="text-right p-2 border-b border-slate-300">Qty (L)</th>
                    <th className="text-right p-2 border-b border-slate-300">Rate (₹/L)</th>
                    <th className="text-right p-2 border-b border-slate-300">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr>
                    <td className="p-2">{fuel}</td>
                    <td className="text-center p-2">{HSN[fuel]}</td>
                    <td className="text-right p-2">{q.toFixed(2)}</td>
                    <td className="text-right p-2">{r.toFixed(2)}</td>
                    <td className="text-right p-2">{total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Tax breakup */}
              <div className="mt-3">
                <div className="text-[11px] font-semibold mb-1">Price Build-up (₹ inclusive)</div>
                <table className="w-full text-[11px] border border-slate-300">
                  <tbody className="font-mono">
                    <BRow k="Basic Price (Ex-Refinery)" v={breakup.base} />
                    <BRow k="Central Excise Duty" v={breakup.excise} />
                    <BRow k="State VAT (Maharashtra @26%)" v={breakup.vat} />
                    <BRow k="Dealer Commission" v={breakup.dealer} />
                    <BRow k="Other Levies & Surcharge" v={breakup.other} />
                    <tr className="bg-[#E8411A] text-white">
                      <td className="p-2 font-bold">Total Payable</td>
                      <td className="p-2 text-right font-bold">₹{total.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment */}
              <div className="mt-3 text-[11px] border border-slate-300 p-2.5">
                <div className="font-semibold mb-1">Payment Details</div>
                <div>Mode: <span className="font-mono">{payment}</span></div>
                {payment === "UPI" && <div>UPI Ref No: <span className="font-mono">{meta.upiRef}</span></div>}
                {payment === "Card" && <div>Card: <span className="font-mono">**** **** **** {cardLast4}</span></div>}
                {payment === "Cash" && <div>Cash Tendered</div>}
              </div>

              {/* Footer */}
              <div className="mt-4 flex items-start gap-3 text-[10px] text-slate-700">
                <div className="border-2 border-dashed border-slate-400 w-20 h-20 flex flex-col items-center justify-center text-center p-1">
                  <div className="text-[8px] font-semibold">QR</div>
                  <div className="text-[7px] leading-tight">Scan for Digital Copy</div>
                </div>
                <div className="flex-1 leading-snug">
                  <div className="font-bold text-[#E8411A] text-[12px]">Thank you for choosing IndianOil. Drive Safe!</div>
                  <div>Customer care: 1800-2333-555</div>
                  <div>XTRAPOWER Fleet Card | XTRAREWARDS Member</div>
                  <div className="italic mt-1">This is a computer-generated invoice.</div>
                  <div className="text-[9px] text-slate-500 mt-1">
                    Fuel prices are inclusive of all applicable taxes. Subject to revision by Government of India.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
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

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-600">{k}:</span>
      <span className={mono ? "font-mono" : ""}>{v}</span>
    </div>
  );
}

function BRow({ k, v }: { k: string; v: number }) {
  return (
    <tr className="border-b border-slate-200 last:border-0">
      <td className="p-2">{k}</td>
      <td className="p-2 text-right">₹{v.toFixed(2)}</td>
    </tr>
  );
}

function IOCLLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 60" className={className} xmlns="http://www.w3.org/2000/svg">
      <g>
        {/* Flame */}
        <path d="M28 6 C 18 18, 14 28, 20 40 C 12 36, 10 28, 14 22 C 14 32, 22 36, 22 44 C 22 52, 30 56, 36 52 C 44 48, 46 38, 40 30 C 38 38, 34 40, 32 36 C 36 28, 36 18, 28 6 Z"
          fill="#E8411A" />
        <circle cx="30" cy="40" r="4" fill="#FFC400" />
      </g>
      <text x="56" y="32" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="700" fill="#1A1A1A">Indian</text>
      <text x="56" y="50" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="700" fill="#E8411A">Oil</text>
    </svg>
  );
}
