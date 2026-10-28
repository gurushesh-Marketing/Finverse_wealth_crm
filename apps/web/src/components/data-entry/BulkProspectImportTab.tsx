import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  ClipboardPaste,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Download,
  ArrowRight,
  RefreshCw,
  UserCheck,
  Building2,
  Users,
  ShieldAlert,
  HelpCircle,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { BulkImportJobSummary, BulkImportRowInput, BulkImportRowRecord, Vertical } from '@finverse/contracts';
import {
  createBulkImportJob,
  getBulkImportJob,
  getBulkImportRows,
  processImportJobChunk,
  getBulkImportReportUrl,
} from '../../lib/data-entry-api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select } from '../ui/select';

const VERTICAL_DISPLAY: Record<string, string> = {
  wealth: 'Wealth',
  banking: 'Commercial Banking',
  markets: 'Markets & Trading',
  real_estate: 'Real Estate',
  'real-estate': 'Real Estate',
};

interface ColumnMapping {
  name: number;
  mobile: number;
  email: number;
  whatsapp: number;
  location: number;
  priority: number;
}

export function BulkProspectImportTab({ grants }: { grants: Vertical[] }) {
  const normalizedGrants = useMemo(() => {
    const raw = grants ?? [];
    const normalized = raw.map((v) => (v === 'real-estate' ? 'real_estate' : v));
    const set = new Set<string>(normalized);
    const order: Vertical[] = ['wealth', 'banking', 'markets', 'real_estate'];
    return order.filter((v) => set.has(v));
  }, [grants]);

  const [selectedVertical, setSelectedVertical] = useState<string>(normalizedGrants[0] ?? 'wealth');

  useEffect(() => {
    if (normalizedGrants.length > 0 && !normalizedGrants.includes(selectedVertical as Vertical)) {
      setSelectedVertical(normalizedGrants[0]);
    }
  }, [normalizedGrants, selectedVertical]);
  const [sourceMode, setSourceMode] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [priorityOverrides, setPriorityOverrides] = useState<Record<number, boolean>>({});
  const [colMapping, setColMapping] = useState<ColumnMapping>({
    name: -1,
    mobile: -1,
    email: -1,
    whatsapp: -1,
    location: -1,
    priority: -1,
  });

  const [activeJob, setActiveJob] = useState<BulkImportJobSummary | null>(null);
  const [recentRows, setRecentRows] = useState<BulkImportRowRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rowFilterStatus, setRowFilterStatus] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  type PreviewPageSize = 15 | 50 | 100 | 'all';
  const [previewPageSize, setPreviewPageSize] = useState<PreviewPageSize>(15);
  const [previewPage, setPreviewPage] = useState<number>(1);

  useEffect(() => {
    setPreviewPage(1);
    setPriorityOverrides({});
  }, [rawRows]);

  // Auto-detect columns from headers
  useEffect(() => {
    if (rawRows.length > 0) {
      const header = rawRows[0].map((h) => h.toLowerCase().trim());
      const mapping: ColumnMapping = {
        name: header.findIndex((h) => h.includes('name') || h === 'prospect'),
        mobile: header.findIndex((h) => h.includes('mobile') || h.includes('phone') || h === 'cell'),
        email: header.findIndex((h) => h.includes('email') || h.includes('mail')),
        whatsapp: header.findIndex((h) => h.includes('whatsapp') || h.includes('wa')),
        location: header.findIndex((h) => h.includes('location') || h.includes('city') || h.includes('address')),
        priority: header.findIndex((h) => h.includes('priority') || h.includes('urgent') || h.includes('prio') || h === 'vip'),
      };

      // Fallback if header doesn't match standard names
      if (mapping.name === -1 && header.length > 0) mapping.name = 0;
      if (mapping.mobile === -1 && header.length > 1) mapping.mobile = 1;
      if (mapping.email === -1 && header.length > 2) mapping.email = 2;
      if (mapping.whatsapp === -1 && header.length > 3) mapping.whatsapp = 3;
      if (mapping.location === -1 && header.length > 4) mapping.location = 4;

      setColMapping(mapping);
    }
  }, [rawRows]);

  // Parse file (.xlsx, .xls, .csv)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', raw: false });
        const cleaned = rows.filter((r) => r.some((c) => String(c).trim().length > 0));
        setRawRows(cleaned);
      } else {
        const text = await file.text();
        parseDelimited(text, file.name);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to read file. Please check the file format.');
    }
  };

  const parseDelimited = (text: string, srcName: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setErrorMsg('No data rows found in input.');
      return;
    }
    const isTsv = lines[0].includes('\t');
    const parsed = lines.map((line) => {
      if (isTsv) return line.split('\t').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      // Basic CSV parser
      const cells: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          cells.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      cells.push(cur.trim());
      return cells;
    });
    setFileName(srcName);
    setRawRows(parsed);
  };

  const handlePasteChange = (text: string) => {
    setPastedText(text);
    if (text.trim().length > 0) {
      parseDelimited(text, 'pasted_data.tsv');
    } else {
      setRawRows([]);
    }
  };

  // Convert raw rows to preview items
  const previewItems: BulkImportRowInput[] = useMemo(() => {
    if (rawRows.length <= 1) return [];
    // Assume row 0 is header if it has letters
    const dataRows = rawRows.slice(1);
    const isColPriority = (row: string[]) => {
      if (colMapping.priority < 0) return false;
      const val = (row[colMapping.priority] ?? '').trim().toLowerCase();
      return (
        val === 'true' ||
        val === 'yes' ||
        val === '1' ||
        val === 'y' ||
        val === 'high' ||
        val === 'urgent' ||
        val === 'priority'
      );
    };

    return dataRows.map((r, idx) => {
      const rowNum = idx + 1;
      const isPriority = priorityOverrides[rowNum] !== undefined ? priorityOverrides[rowNum] : isColPriority(r);
      return {
        rowIndex: rowNum,
        name: (r[colMapping.name] ?? '').trim(),
        mobile: (r[colMapping.mobile] ?? '').trim(),
        email: (r[colMapping.email] ?? '').trim(),
        whatsapp: colMapping.whatsapp >= 0 ? (r[colMapping.whatsapp] ?? '').trim() : '',
        location: colMapping.location >= 0 ? (r[colMapping.location] ?? '').trim() : '',
        isPriority,
      };
    });
  }, [rawRows, colMapping, priorityOverrides]);

  // Pagination & slice calculation for preview items
  const { visiblePreviewRows, totalPreviewPages, currentRangeText } = useMemo(() => {
    const total = previewItems.length;
    if (total === 0) {
      return { visiblePreviewRows: [], totalPreviewPages: 1, currentRangeText: 'No rows' };
    }

    if (previewPageSize === 'all') {
      if (total <= 500) {
        return {
          visiblePreviewRows: previewItems,
          totalPreviewPages: 1,
          currentRangeText: `Showing all ${total} of ${total} rows`,
        };
      }
      // Chunk rendering for 500+ rows to avoid freezing the browser
      const chunkSize = 500;
      const pages = Math.ceil(total / chunkSize);
      const safePage = Math.min(Math.max(1, previewPage), pages);
      const start = (safePage - 1) * chunkSize;
      const end = Math.min(start + chunkSize, total);
      return {
        visiblePreviewRows: previewItems.slice(start, end),
        totalPreviewPages: pages,
        currentRangeText: `Showing ${start + 1}–${end} of ${total} rows (paged for responsiveness)`,
      };
    }

    const pageSizeNum = Number(previewPageSize);
    const pages = Math.ceil(total / pageSizeNum);
    const safePage = Math.min(Math.max(1, previewPage), pages);
    const start = (safePage - 1) * pageSizeNum;
    const end = Math.min(start + pageSizeNum, total);

    return {
      visiblePreviewRows: previewItems.slice(start, end),
      totalPreviewPages: pages,
      currentRangeText: `Showing ${start + 1}–${end} of ${total} rows`,
    };
  }, [previewItems, previewPageSize, previewPage]);

  // Download template
  const downloadTemplate = () => {
    const csvContent =
      'Prospect Name,Primary Mobile,Email Address,WhatsApp Number,Location,Priority\n' +
      'Aarav Sharma,9876543210,aarav.sharma@example.test,9876543210,Mumbai,Yes\n' +
      'Diya Patel,9823456789,diya.patel@example.test,9823456789,Bengaluru,No\n' +
      'Rohan Kulkarni,9812345678,rohan.k@example.test,,Delhi,No\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'finverse_prospect_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Confirm and start import
  const handleStartImport = async () => {
    if (previewItems.length === 0) {
      setErrorMsg('No prospect rows to import.');
      return;
    }
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const job = await createBulkImportJob({
        vertical: selectedVertical as Vertical,
        fileName: fileName || (sourceMode === 'paste' ? 'pasted_data.tsv' : 'import_file.csv'),
        sourceType: sourceMode === 'paste' ? 'paste' : fileName.endsWith('.xlsx') ? 'xlsx' : 'csv',
        rows: previewItems,
      });

      setActiveJob(job);

      // Poll progress and trigger chunk execution
      let currentJob = job;
      while (currentJob.status !== 'completed' && currentJob.status !== 'failed') {
        const step = await processImportJobChunk(currentJob.id, 500);
        currentJob = step;
        setActiveJob(step);
        if (step.processedRows >= step.totalRows || step.status === 'completed') {
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      // Refresh final details
      const finalRes = await getBulkImportJob(currentJob.id);
      setActiveJob(finalRes.job);
      setRecentRows(finalRes.recentRows);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered rows for drilldown table
  const filteredRows = useMemo(() => {
    if (rowFilterStatus === 'all') return recentRows;
    return recentRows.filter((r) => r.status === rowFilterStatus);
  }, [recentRows, rowFilterStatus]);

  const total = activeJob?.totalRows ?? 0;
  const processed = activeJob?.processedRows ?? 0;
  const progressPct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Configuration & Selection Card */}
      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Bulk Prospect Import & Auto-Routing</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload Excel (.xlsx), CSV, or paste spreadsheet rows. Every valid prospect is automatically assigned to an eligible Sales Caller.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 shrink-0">
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-5">
          {/* Vertical Selector */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
              1. Select Destination Vertical *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {normalizedGrants.map((v) => {
                const isSelected = selectedVertical === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSelectedVertical(v)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary font-semibold'
                        : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <span className="text-sm">{VERTICAL_DISPLAY[v] ?? v}</span>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
              2. Data Input Method
            </label>
            <div className="flex gap-2">
              <Button
                variant={sourceMode === 'upload' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSourceMode('upload')}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Upload Spreadsheet (.xlsx, .csv)
              </Button>
              <Button
                variant={sourceMode === 'paste' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSourceMode('paste')}
                className="gap-2"
              >
                <ClipboardPaste className="h-4 w-4" />
                Paste Rows from Excel / Sheets
              </Button>
            </div>
          </div>

          {/* File Upload Box */}
          {sourceMode === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 rounded-xl p-8 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Click to select or drag and drop a file</p>
              <p className="text-xs text-muted-foreground mt-1">Supports Excel Workbook (.xlsx, .xls) and CSV files</p>
              {fileName && (
                <div className="mt-3 inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {fileName} ({rawRows.length > 1 ? `${rawRows.length - 1} rows detected` : 'parsing...'})
                </div>
              )}
            </div>
          )}

          {/* Paste Input Box */}
          {sourceMode === 'paste' && (
            <div className="space-y-2">
              <textarea
                value={pastedText}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder="Copy columns from Excel or Google Sheets (Name, Mobile, Email, WhatsApp, Location) and paste them here..."
                rows={6}
                className="w-full rounded-md border border-input bg-background p-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Tab-separated rows from spreadsheet clipboard accepted.</span>
                <span>{rawRows.length > 1 ? `${rawRows.length - 1} data rows detected` : ''}</span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Column Mapping Section */}
          {rawRows.length > 0 && (
            <div className="pt-2 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  3. Verify Column Mapping
                </span>
                <span className="text-xs text-muted-foreground">Headers detected from Row 1</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {(['name', 'mobile', 'email', 'whatsapp', 'location', 'priority'] as const).map((field) => (
                  <div key={field} className="space-y-1">
                    <label className="text-xs font-medium text-foreground capitalize">
                      {field === 'mobile' ? 'Primary Mobile *' : field === 'name' ? 'Name *' : field === 'email' ? 'Email *' : field}
                    </label>
                    <Select
                      value={String(colMapping[field])}
                      onChange={(e) =>
                        setColMapping((prev) => ({ ...prev, [field]: parseInt(e.target.value, 10) }))
                      }
                      className="w-full text-xs"
                    >
                      <option value="-1">-- Unmapped --</option>
                      {rawRows[0]?.map((header, idx) => (
                        <option key={idx} value={String(idx)}>
                          Col {idx + 1}: {header || `Column ${idx + 1}`}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview & Action Bar */}
          {previewItems.length > 0 && !activeJob && (
            <div className="pt-3 border-t border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm">
                  <span className="font-semibold text-foreground">{previewItems.length} prospects</span> ready for validation and automatic routing into{' '}
                  <span className="font-semibold text-primary">{VERTICAL_DISPLAY[selectedVertical]}</span>.
                </div>
                <Button onClick={handleStartImport} disabled={isProcessing} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm & Start Import
                </Button>
              </div>

              {/* Row-Numbered Preview Table with Responsive Pagination & All-Row View */}
              <div className="rounded-lg border border-border overflow-hidden bg-card">
                {/* Control Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2.5 bg-muted/40 border-b border-border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">View rows:</span>
                    <div className="inline-flex rounded-md border border-border overflow-hidden bg-background">
                      {([15, 50, 100, 'all'] as const).map((size) => {
                        const isSelected = previewPageSize === size;
                        const label = size === 'all'
                          ? (previewItems.length <= 500 ? `All (${previewItems.length})` : 'All')
                          : String(size);
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => {
                              setPreviewPageSize(size);
                              setPreviewPage(1);
                            }}
                            className={`px-3 py-1 text-xs transition-colors ${
                              isSelected
                                ? 'bg-[#113F3D] text-white font-semibold'
                                : 'text-stone-700 hover:bg-muted'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-muted-foreground">{currentRangeText}</span>
                    {totalPreviewPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                          disabled={previewPage <= 1}
                          className="px-2.5 py-1 rounded border border-border text-xs font-medium disabled:opacity-40 hover:bg-muted bg-background"
                        >
                          Prev
                        </button>
                        <span className="text-[11px] font-mono text-muted-foreground px-1">
                          {previewPage} / {totalPreviewPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                          disabled={previewPage >= totalPreviewPages}
                          className="px-2.5 py-1 rounded border border-border text-xs font-medium disabled:opacity-40 hover:bg-muted bg-background"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider sticky top-0 border-b border-border z-10 shadow-sm">
                      <tr>
                        <th className="px-3 py-2 font-mono">#</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Mobile Number</th>
                        <th className="px-3 py-2">Email Address</th>
                        <th className="px-3 py-2">WhatsApp</th>
                        <th className="px-3 py-2">Location</th>
                        <th className="px-3 py-2">Priority</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visiblePreviewRows.map((row, idx) => {
                        const rIndex = row.rowIndex ?? idx + 1;
                        return (
                          <tr key={rIndex} className="hover:bg-muted/40">
                            <td className="px-3 py-2 font-mono text-muted-foreground">{rIndex}</td>
                            <td className="px-3 py-2 font-medium text-foreground">{row.name}</td>
                            <td className="px-3 py-2 font-mono">{row.mobile}</td>
                            <td className="px-3 py-2 font-mono">{row.email}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.whatsapp || '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.location || '—'}</td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setPriorityOverrides((prev) => ({
                                    ...prev,
                                    [rIndex]: !row.isPriority,
                                  }))
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                                  row.isPriority
                                    ? 'bg-amber-500/15 text-amber-900 border-amber-400 dark:text-amber-200 dark:border-amber-600'
                                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                                }`}
                                title="Click to toggle priority for this prospect"
                              >
                                {row.isPriority ? '★ Priority' : '+ Set Priority'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Bar */}
                <div className="p-2.5 text-xs text-muted-foreground bg-muted/20 border-t border-border flex items-center justify-between">
                  <span>{currentRangeText}</span>
                  {totalPreviewPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                        disabled={previewPage <= 1}
                        className="px-2.5 py-1 rounded border border-border text-xs font-medium disabled:opacity-40 hover:bg-muted bg-background"
                      >
                        Prev
                      </button>
                      <span className="text-[11px] font-mono px-1">
                        Page {previewPage} of {totalPreviewPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                        disabled={previewPage >= totalPreviewPages}
                        className="px-2.5 py-1 rounded border border-border text-xs font-medium disabled:opacity-40 hover:bg-muted bg-background"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution Progress & Reconciliation */}
      {activeJob && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-foreground">Import Job: {activeJob.id}</CardTitle>
                <Badge
                  tone={
                    activeJob.status === 'completed'
                      ? 'positive'
                      : activeJob.status === 'processing'
                      ? 'warning'
                      : 'none'
                  }
                >
                  {activeJob.status.toUpperCase()}
                </Badge>
              </div>

              {activeJob.status === 'completed' && (
                <a
                  href={getBulkImportReportUrl(activeJob.id)}
                  download={`bulk_import_${activeJob.id}_report.csv`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Reconciliation Report (CSV)
                </a>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-5">
            {/* Live Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-muted-foreground">
                  Processing Chunks ({processed} of {total} rows)
                </span>
                <span className="text-foreground">{progressPct}%</span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Reconciliation KPI Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border border-border bg-card">
                <p className="text-xs text-muted-foreground">Assigned Prospects</p>
                <p className="text-xl font-bold text-foreground mt-1">{activeJob.assignedCount}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Live CRM prospects</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card">
                <p className="text-xs text-muted-foreground">Duplicates Held</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{activeJob.duplicateCount}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">File or CRM duplicates</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card">
                <p className="text-xs text-muted-foreground">Invalid Rows</p>
                <p className="text-xl font-bold text-destructive mt-1">{activeJob.invalidCount}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Validation failures</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card">
                <p className="text-xs text-muted-foreground">Unassigned Exceptions</p>
                <p className="text-xl font-bold text-primary mt-1">{activeJob.unassignedExceptionCount}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Held in TL queue</p>
              </div>
            </div>

            {/* Invariant Equation Verification Banner */}
            <div className="p-3 rounded-lg bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-2">
              <span className="font-medium text-foreground">
                Reconciliation Balance:{' '}
                <span className="font-mono text-primary font-bold">
                  {total} = {activeJob.assignedCount} + {activeJob.duplicateCount} + {activeJob.invalidCount} +{' '}
                  {activeJob.unassignedExceptionCount}
                </span>
              </span>
              <span className="text-muted-foreground">
                {total === activeJob.assignedCount + activeJob.duplicateCount + activeJob.invalidCount + activeJob.unassignedExceptionCount
                  ? '✓ 100% Reconciled'
                  : 'Reconciling...'}
              </span>
            </div>

            {/* Breakdown by Team & Caller */}
            {activeJob.status === 'completed' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
                {/* By Team */}
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wide">
                    <Building2 className="h-4 w-4 text-primary" />
                    Distribution by Team
                  </div>
                  <div className="space-y-1 text-xs">
                    {Object.entries(activeJob.reconciliation.byTeam).length > 0 ? (
                      Object.entries(activeJob.reconciliation.byTeam).map(([team, count]) => (
                        <div key={team} className="flex justify-between py-1 border-b border-border last:border-0">
                          <span className="text-foreground">{team}</span>
                          <span className="font-mono font-semibold">{count} leads</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-xs">No leads assigned to teams.</p>
                    )}
                  </div>
                </div>

                {/* By Caller */}
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wide">
                    <Users className="h-4 w-4 text-primary" />
                    Distribution by Caller
                  </div>
                  <div className="space-y-1 text-xs">
                    {Object.entries(activeJob.reconciliation.byCaller).length > 0 ? (
                      Object.entries(activeJob.reconciliation.byCaller).map(([caller, count]) => (
                        <div key={caller} className="flex justify-between py-1 border-b border-border last:border-0">
                          <span className="text-foreground">{caller}</span>
                          <span className="font-mono font-semibold">{count} leads</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-xs">No leads assigned to callers.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Row Drill-down */}
            {recentRows.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Recent Processed Rows Inspection
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {['all', 'assigned', 'duplicate', 'invalid', 'unassigned_exception'].map((statusKey) => (
                      <Button
                        key={statusKey}
                        size="sm"
                        variant={rowFilterStatus === statusKey ? 'default' : 'outline'}
                        onClick={() => setRowFilterStatus(statusKey)}
                        className="h-7 text-xs capitalize"
                      >
                        {statusKey.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Row #</th>
                          <th className="px-3 py-2">Prospect</th>
                          <th className="px-3 py-2">Mobile / Email</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Assigned Caller / Team</th>
                          <th className="px-3 py-2">Reconciliation Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredRows.map((row) => (
                          <tr key={row.id} className="hover:bg-muted/40">
                            <td className="px-3 py-2 font-mono text-muted-foreground">{row.rowIndex}</td>
                            <td className="px-3 py-2 font-medium text-foreground">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{row.name}</span>
                                {row.isPriority && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-900 border border-amber-400 dark:text-amber-200 dark:border-amber-600">
                                    ★ Priority
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-mono">{row.mobile}</div>
                              <div className="text-muted-foreground text-[11px]">{row.email}</div>
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                tone={
                                  row.status === 'assigned'
                                    ? 'positive'
                                    : row.status === 'duplicate'
                                    ? 'warning'
                                    : row.status === 'invalid'
                                    ? 'critical'
                                    : 'neutral'
                                }
                              >
                                {row.status.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              {row.assignedEmployeeName ? (
                                <div>
                                  <span className="font-medium text-foreground">{row.assignedEmployeeName}</span>
                                  <div className="text-muted-foreground text-[11px]">{row.assignedTeamName}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic">Unassigned (TL Queue)</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">
                              {row.rejectionReason || (row.canonicalLeadId ? `Canonical Lead: ${row.canonicalLeadId}` : '—')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
