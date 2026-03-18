'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, API_URL } from '@/lib/api';
import ConsumptionChart from '@/components/ConsumptionChart';

interface Customer { id: string; name: string; email?: string; phone?: string; city?: string; state?: string; company?: string; gstin?: string; address?: string }
interface Site { id: string; name?: string; address: string; roofType?: string; roofAreaSqM?: number }
interface Bill { id: string; month: number; year: number; unitsKwh: number; amount?: number; source: string }
interface OcrReading { month: number; year: number; unitsKwh: number; amount?: number; confidence: number; rawMatch?: string; source?: string }

const MONTHS = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROOF_TYPES = ['FLAT','SLOPED','METAL','TERRACE','GROUND_MOUNTED'];

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [tab, setTab] = useState<'bills' | 'ocr'>('bills');

  // New site form
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [siteForm, setSiteForm] = useState({ address: '', name: '', roofType: '', roofAreaSqM: '', city: '', state: '' });
  const [savingSite, setSavingSite] = useState(false);

  // Bulk bill entry (13 rows)
  const now = new Date();
  const defaultStartMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // one month before current
  const defaultStartYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [startMonth, setStartMonth] = useState(defaultStartMonth);
  const [startYear, setStartYear] = useState(defaultStartYear);

  const buildBulkRows = (sm: number, sy: number) => {
    const rows = [];
    for (let i = 0; i < 13; i++) {
      const d = new Date(sy, sm - 1 + i, 1);
      rows.push({ month: d.getMonth() + 1, year: d.getFullYear(), unitsKwh: '', amount: '' });
    }
    return rows;
  };
  const [bulkRows, setBulkRows] = useState<{ month: number; year: number; unitsKwh: string; amount: string }[]>(
    () => buildBulkRows(defaultStartMonth, defaultStartYear)
  );
  const [savingBill, setSavingBill] = useState(false);

  const handleStartMonthChange = (newMonth: number) => {
    setStartMonth(newMonth);
    setBulkRows(buildBulkRows(newMonth, startYear));
  };

  const handleStartYearChange = (newYear: number) => {
    setStartYear(newYear);
    setBulkRows(buildBulkRows(startMonth, newYear));
  };

  // OCR
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrReadings, setOcrReadings] = useState<OcrReading[]>([]);
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [savingOcr, setSavingOcr] = useState(false);

  // Quotation
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteNotes, setQuoteNotes] = useState('');
  const [savingQuote, setSavingQuote] = useState(false);
  const [quotes, setQuotes] = useState<{ id: string; quoteNumber: string; status: string; createdAt: string }[]>([]);

  const loadBills = useCallback(async (siteId: string) => {
    const data = await api<Bill[]>(`/bills/${siteId}`);
    setBills(data);
  }, []);

  const loadQuotes = useCallback(async () => {
    const data = await api<typeof quotes>(`/quotations/customer/${id}`);
    setQuotes(data);
  }, [id]);

  useEffect(() => {
    Promise.all([
      api<Customer>(`/customers/${id}`),
      api<Site[]>(`/sites/customer/${id}`),
    ]).then(([cust, s]) => {
      setCustomer(cust);
      setSites(s);
      if (s.length > 0) { setSelectedSite(s[0]); loadBills(s[0].id); }
    }).catch(() => {});
    loadQuotes();
  }, [id, loadBills, loadQuotes]);

  const selectSite = (site: Site) => {
    setSelectedSite(site);
    loadBills(site.id);
    setOcrReadings([]);
  };

  const addSite = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingSite(true);
    try {
      const site = await api<Site>('/sites', {
        method: 'POST',
        body: JSON.stringify({ customerId: id, ...siteForm, roofAreaSqM: siteForm.roofAreaSqM ? parseFloat(siteForm.roofAreaSqM) : undefined, roofType: siteForm.roofType || undefined }),
      });
      setSites([site, ...sites]);
      setSelectedSite(site); setBills([]);
      setShowSiteForm(false); setSiteForm({ address: '', name: '', roofType: '', roofAreaSqM: '', city: '', state: '' });
    } catch { /* ignore */ } finally { setSavingSite(false); }
  };

  const saveBulkBills = async () => {
    if (!selectedSite) return;
    const filled = bulkRows.filter((r) => r.unitsKwh.trim() !== '');
    if (!filled.length) return;
    setSavingBill(true);
    try {
      await api('/bills/bulk', {
        method: 'POST',
        body: JSON.stringify({
          siteId: selectedSite.id,
          bills: filled.map((r) => ({
            month: r.month,
            year: r.year,
            unitsKwh: parseFloat(r.unitsKwh),
            amount: r.amount ? parseFloat(r.amount) : undefined,
          })),
        }),
      });
      loadBills(selectedSite.id);
      setBulkRows(buildBulkRows(startMonth, startYear));
    } catch { /* ignore */ } finally { setSavingBill(false); }
  };

  const updateBulkRow = (i: number, field: 'unitsKwh' | 'amount', value: string) => {
    setBulkRows(bulkRows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const deleteBill = async (billId: string) => {
    if (!confirm('Delete this bill entry?') || !selectedSite) return;
    await api(`/bills/${billId}`, { method: 'DELETE' });
    loadBills(selectedSite.id);
  };

  const runOcr = async () => {
    if (!ocrFile) return;
    setOcrRunning(true); setOcrReadings([]);
    try {
      const fd = new FormData(); fd.append('file', ocrFile);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/ocr/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, credentials: 'include', body: fd });
      const data = await res.json();
      setOcrReadings(data.monthlyReadings ?? []);
      setOcrWarnings(data.warnings ?? []);
      setOcrConfidence(data.overallConfidence ?? 0);
    } catch { /* ignore */ } finally { setOcrRunning(false); }
  };

  const updateOcrRow = (i: number, field: keyof OcrReading, value: string) => {
    setOcrReadings(ocrReadings.map((r, idx) => idx === i ? { ...r, [field]: parseFloat(value) || 0 } : r));
  };

  const saveOcrReadings = async () => {
    if (!selectedSite || !ocrReadings.length) return;
    setSavingOcr(true);
    try {
      await api('/ocr/save', { method: 'POST', body: JSON.stringify({ siteId: selectedSite.id, readings: ocrReadings }) });
      loadBills(selectedSite.id);
      setOcrReadings([]); setOcrFile(null); setTab('bills');
    } catch { /* ignore */ } finally { setSavingOcr(false); }
  };

  const triggerQuotation = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedSite) return;
    setSavingQuote(true);
    try {
      await api('/quotations', { method: 'POST', body: JSON.stringify({ customerId: id, siteId: selectedSite.id, notes: quoteNotes }) });
      setShowQuoteForm(false); setQuoteNotes('');
      loadQuotes();
    } catch { /* ignore */ } finally { setSavingQuote(false); }
  };

  const statusColors: Record<string, string> = { DRAFT: 'bg-gray-100 text-gray-600', SENT: 'bg-blue-100 text-blue-700', ACCEPTED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-600' };

  if (!customer) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/sales/customers" className="text-gray-400 hover:text-gray-600">Customers</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-800 font-medium">{customer.name}</span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Customer info + Sites */}
        <div className="space-y-4">
          {/* Customer Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-base mb-3">{customer.name}</h2>
            <dl className="space-y-1.5 text-sm">
              {customer.company && <div><dt className="text-xs text-gray-400">Company</dt><dd className="text-gray-700">{customer.company}</dd></div>}
              {customer.phone && <div><dt className="text-xs text-gray-400">Phone</dt><dd className="text-gray-700">{customer.phone}</dd></div>}
              {customer.email && <div><dt className="text-xs text-gray-400">Email</dt><dd className="text-gray-700">{customer.email}</dd></div>}
              {customer.city && <div><dt className="text-xs text-gray-400">Location</dt><dd className="text-gray-700">{[customer.city, customer.state].filter(Boolean).join(', ')}</dd></div>}
              {customer.gstin && <div><dt className="text-xs text-gray-400">GSTIN</dt><dd className="text-gray-700 font-mono text-xs">{customer.gstin}</dd></div>}
            </dl>
          </div>

          {/* Sites */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase">Sites</span>
              <button onClick={() => setShowSiteForm(true)} className="text-xs text-yellow-600 hover:text-yellow-700 font-medium">+ Add Site</button>
            </div>

            {showSiteForm && (
              <form onSubmit={addSite} className="px-4 py-3 bg-yellow-50 border-b border-yellow-100 space-y-2">
                <input required placeholder="Site address *" value={siteForm.address} onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                <input placeholder="Site name (optional)" value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={siteForm.roofType} onChange={(e) => setSiteForm({ ...siteForm, roofType: e.target.value })}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600">
                    <option value="">Roof type</option>
                    {ROOF_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input type="number" placeholder="Area (sq.m)" value={siteForm.roofAreaSqM} onChange={(e) => setSiteForm({ ...siteForm, roofAreaSqM: e.target.value })}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={savingSite} className="flex-1 bg-yellow-500 text-white text-xs font-medium py-1.5 rounded-lg">{savingSite ? 'Saving…' : 'Add Site'}</button>
                  <button type="button" onClick={() => setShowSiteForm(false)} className="text-xs text-gray-500 px-2">Cancel</button>
                </div>
              </form>
            )}

            <ul className="divide-y divide-gray-50">
              {sites.map((s) => (
                <li key={s.id}>
                  <button onClick={() => selectSite(s)}
                    className={`w-full text-left px-4 py-3 transition-colors ${selectedSite?.id === s.id ? 'bg-yellow-50 border-l-2 border-yellow-500' : 'hover:bg-gray-50'}`}>
                    <div className="text-sm text-gray-800 font-medium">{s.name || 'Unnamed Site'}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{s.address}</div>
                    {s.roofType && <div className="text-xs text-gray-300 mt-0.5">{s.roofType}{s.roofAreaSqM ? ` · ${s.roofAreaSqM} m²` : ''}</div>}
                  </button>
                </li>
              ))}
              {sites.length === 0 && !showSiteForm && <li className="px-4 py-4 text-xs text-gray-400 text-center">No sites yet.</li>}
            </ul>
          </div>

          {/* Quotations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase">Quotations</span>
              {selectedSite && (
                <button onClick={() => setShowQuoteForm(true)} className="text-xs text-yellow-600 hover:text-yellow-700 font-medium">+ Request</button>
              )}
            </div>

            {showQuoteForm && (
              <form onSubmit={triggerQuotation} className="px-4 py-3 bg-yellow-50 border-b border-yellow-100 space-y-2">
                <p className="text-xs text-gray-600">Site: <strong>{selectedSite?.name || selectedSite?.address}</strong></p>
                <textarea placeholder="Notes (optional)" rows={2} value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                <div className="flex gap-2">
                  <button type="submit" disabled={savingQuote} className="flex-1 bg-gray-900 text-white text-xs font-medium py-1.5 rounded-lg">{savingQuote ? 'Creating…' : 'Create Quotation'}</button>
                  <button type="button" onClick={() => setShowQuoteForm(false)} className="text-xs text-gray-500 px-2">Cancel</button>
                </div>
              </form>
            )}

            <ul className="divide-y divide-gray-50">
              {quotes.map((q) => (
                <li key={q.id} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <Link href={`/sales/quotations/${q.id}`}
                      className="text-xs font-mono font-medium text-yellow-600 hover:text-yellow-800 hover:underline">
                      {q.quoteNumber}
                    </Link>
                    <div className="text-xs text-gray-400">{new Date(q.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[q.status]}`}>{q.status}</span>
                </li>
              ))}
              {quotes.length === 0 && <li className="px-4 py-4 text-xs text-gray-400 text-center">No quotations yet.</li>}
            </ul>
          </div>
        </div>

        {/* Right: Bills + Chart */}
        <div className="col-span-2 space-y-4">
          {/* Consumption Chart */}
          {bills.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Electricity Consumption</h3>
              <ConsumptionChart bills={bills} />
            </div>
          )}

          {/* Bills panel */}
          {selectedSite ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex gap-0 border-b border-gray-100">
                {(['bills', 'ocr'] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-5 py-3 text-sm font-medium transition-colors ${tab === t ? 'border-b-2 border-yellow-500 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                    {t === 'bills' ? '📋 Manual Entry' : '📄 OCR Upload'}
                  </button>
                ))}
              </div>

              {tab === 'bills' && (
                <div className="p-5 space-y-5">
                  {/* 13-row bulk entry grid */}
                  <div>
                    {/* Start month/year picker */}
                    <div className="flex items-center gap-3 mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                      <span className="text-xs font-semibold text-gray-600 shrink-0">Start from:</span>
                      <select value={startMonth} onChange={(e) => handleStartMonthChange(Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white">
                        {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                      </select>
                      <input type="number" min="2000" max="2100" value={startYear}
                        onChange={(e) => handleStartYearChange(Number(e.target.value))}
                        className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white" />
                      <span className="text-xs text-gray-400 italic">Rows 2–13 auto-fill ahead</span>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs text-gray-500">Fill units for each month. Leave blank to skip.</p>
                      <button onClick={saveBulkBills} disabled={savingBill || bulkRows.every((r) => !r.unitsKwh.trim())}
                        className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-40 text-white text-sm font-medium px-5 py-1.5 rounded-lg transition-colors">
                        {savingBill ? 'Saving…' : 'Save All'}
                      </button>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-8">#</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Month</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Year</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Units (kWh)</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Amount (₹)</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Saved</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {bulkRows.map((row, i) => {
                            const saved = bills.find((b) => b.month === row.month && b.year === row.year);
                            return (
                              <tr key={i} className={saved ? 'bg-green-50' : ''}>
                                <td className="px-3 py-1.5 text-xs text-gray-400">{i + 1}</td>
                                <td className="px-3 py-1.5 font-medium text-gray-800">{MONTHS[row.month]}</td>
                                <td className="px-3 py-1.5 text-gray-500 text-xs">{row.year}</td>
                                <td className="px-2 py-1">
                                  <input
                                    type="number" step="0.01" min="0"
                                    value={row.unitsKwh}
                                    placeholder={saved ? String(saved.unitsKwh) : '—'}
                                    onChange={(e) => updateBulkRow(i, 'unitsKwh', e.target.value)}
                                    className="w-28 border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <input
                                    type="number" step="0.01" min="0"
                                    value={row.amount}
                                    placeholder={saved?.amount ? String(saved.amount) : '—'}
                                    onChange={(e) => updateBulkRow(i, 'amount', e.target.value)}
                                    className="w-28 border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                  />
                                </td>
                                <td className="px-3 py-1.5">
                                  {saved ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-green-600 font-medium">Saved</span>
                                      <button onClick={() => deleteBill(saved.id)} className="text-xs text-red-400 hover:text-red-600">Del</button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-300">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Saved bills summary */}
                  {bills.length > 0 && (
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">All Saved Readings ({bills.length})</p>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {['Month', 'Year', 'kWh', 'Amount', 'Source'].map((h) => (
                              <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {bills.map((b) => (
                            <tr key={b.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-800">{MONTHS[b.month]}</td>
                              <td className="px-3 py-2 text-gray-600">{b.year}</td>
                              <td className="px-3 py-2 text-gray-800">{b.unitsKwh.toLocaleString()}</td>
                              <td className="px-3 py-2 text-gray-500">{b.amount ? `₹${b.amount.toLocaleString()}` : '—'}</td>
                              <td className="px-3 py-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${b.source === 'OCR' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>{b.source}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === 'ocr' && (
                <div className="p-5 space-y-4">
                  {/* Upload area */}
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                    <input type="file" accept="image/*,application/pdf" id="ocrFile" className="hidden"
                      onChange={(e) => { setOcrFile(e.target.files?.[0] ?? null); setOcrReadings([]); }} />
                    <label htmlFor="ocrFile" className="cursor-pointer">
                      <div className="text-3xl mb-2">📄</div>
                      <div className="text-sm font-medium text-gray-700">
                        {ocrFile ? ocrFile.name : 'Click to upload bill image or PDF'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP, PDF · Max 10MB</div>
                    </label>
                    {ocrFile && (
                      <button onClick={runOcr} disabled={ocrRunning}
                        className="mt-3 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                        {ocrRunning ? 'Processing…' : 'Run OCR'}
                      </button>
                    )}
                  </div>

                  {ocrWarnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 space-y-0.5">
                      {ocrWarnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                    </div>
                  )}

                  {ocrReadings.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Extracted {ocrReadings.length} reading(s) · Confidence: {(ocrConfidence * 100).toFixed(0)}%
                        </span>
                        <span className="text-xs text-gray-400">Edit any value before saving</span>
                      </div>
                      <table className="w-full text-sm mb-3">
                        <thead className="bg-gray-50">
                          <tr>
                            {['Month', 'Year', 'Units (kWh)', 'Amount (₹)', 'Confidence', 'Source'].map((h) => (
                              <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {ocrReadings.map((r, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2">
                                <select value={r.month} onChange={(e) => updateOcrRow(i, 'month', e.target.value)}
                                  className="border border-gray-200 rounded px-2 py-1 text-xs">
                                  {MONTHS.slice(1).map((m, mi) => <option key={mi + 1} value={mi + 1}>{m}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" value={r.year} onChange={(e) => updateOcrRow(i, 'year', e.target.value)}
                                  className="w-20 border border-gray-200 rounded px-2 py-1 text-xs" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" value={r.unitsKwh} onChange={(e) => updateOcrRow(i, 'unitsKwh', e.target.value)}
                                  className="w-24 border border-gray-200 rounded px-2 py-1 text-xs" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" value={r.amount ?? ''} onChange={(e) => updateOcrRow(i, 'amount', e.target.value)}
                                  className="w-24 border border-gray-200 rounded px-2 py-1 text-xs" />
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${r.confidence > 0.7 ? 'bg-green-400' : r.confidence > 0.4 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                      style={{ width: `${r.confidence * 100}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-400">{(r.confidence * 100).toFixed(0)}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-400 capitalize">{r.source ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex gap-2">
                        <button onClick={saveOcrReadings} disabled={savingOcr}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                          {savingOcr ? 'Saving…' : 'Save All Readings'}
                        </button>
                        <button onClick={() => setOcrReadings([])} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Discard</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center h-48">
              <p className="text-sm text-gray-400">Select or add a site to enter bill data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
