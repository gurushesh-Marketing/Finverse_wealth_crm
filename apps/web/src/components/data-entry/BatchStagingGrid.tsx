import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';

export const STAGING_COLUMNS = [
  { key: 'name', label: 'Client Name', required: true, width: 'min-w-48' },
  { key: 'mobile', label: 'Primary Mobile', required: true, width: 'min-w-44' },
  { key: 'email', label: 'Email Address', required: true, width: 'min-w-56' },
  { key: 'product', label: 'Target Product', required: true, width: 'min-w-56' },
  { key: 'consent', label: 'Consent Reference', required: true, width: 'min-w-48' },
  { key: 'date', label: 'Consent Date', required: true, width: 'min-w-40' },
  { key: 'need', label: 'Need Summary', required: false, width: 'min-w-56' },
] as const;

export type StagingField = (typeof STAGING_COLUMNS)[number]['key'];
export type StagingRow = Record<StagingField, string> & { id: string };
const headers = STAGING_COLUMNS.map((column) => column.label);

export function emptyStagingRow(): StagingRow {
  return { id: crypto.randomUUID(), name: '', mobile: '', email: '', product: '', consent: '', date: '', need: '' };
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function stagingRowsToCsv(rows: StagingRow[]): string {
  return [headers.join(','), ...rows.map((row) => STAGING_COLUMNS.map(({ key }) => escapeCsv(row[key])).join(','))].join('\n');
}

export function stagingRowErrors(row: StagingRow, products?: string[]): Partial<Record<StagingField, string>> {
  const errors: Partial<Record<StagingField, string>> = {};
  if (!row.name.trim()) errors.name = 'Enter a client name.';
  const digits = row.mobile.replace(/\D/g, '');
  if (digits.length !== 10 && !(digits.length === 12 && digits.startsWith('91'))) errors.mobile = 'Enter a valid 10-digit mobile number.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) errors.email = 'Enter a valid email address.';
  if (!row.product.trim()) errors.product = 'Select a product.';
  else if (products && !products.includes(row.product)) errors.product = 'Select a product for this vertical.';
  if (!row.consent.trim()) errors.consent = 'Enter the consent reference.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || Number.isNaN(Date.parse(row.date))) errors.date = 'Enter a valid consent date.';
  return errors;
}

// The API currently accepts the seven canonical CSV headers. Reject unfamiliar files
// rather than silently dropping columns or claiming that column mapping already works.
function parseTemplateCsv(content: string): StagingRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (quoted && content[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      record.push(cell.trim()); cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && content[i + 1] === '\n') i++;
      record.push(cell.trim()); cell = '';
      if (record.some(Boolean)) records.push(record);
      record = [];
    } else if ((char === '\n' || char === '\r') && quoted) {
      throw new Error('Line breaks inside cells are not supported. Remove them and upload the CSV again.');
    } else cell += char;
  }
  if (quoted) throw new Error('The CSV contains an unclosed quotation mark.');
  record.push(cell.trim());
  if (record.some(Boolean)) records.push(record);
  const first = records.shift();
  if (!first || first.length !== headers.length || first.some((value, index) => value.replace(/^\uFEFF/, '') !== headers[index])) {
    throw new Error('Use the downloaded template with the seven headers in the shown order.');
  }
  if (!records.length) throw new Error('The file has headers but no prospect rows.');
  if (records.length > 500) throw new Error('A batch can contain at most 500 rows.');
  return records.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${index + 1} has ${values.length} columns; expected ${headers.length}.`);
    return Object.fromEntries([['id', crypto.randomUUID()], ...STAGING_COLUMNS.map((column, columnIndex) => [column.key, values[columnIndex] ?? ''])]) as StagingRow;
  });
}

interface BatchStagingGridProps {
  rows: StagingRow[];
  onChange: (rows: StagingRow[]) => void;
  onFileNameChange: (name: string) => void;
  products: string[];
}

export function BatchStagingGrid({ rows, onChange, onFileNameChange, products }: BatchStagingGridProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const invalidRows = rows.filter((row) => Object.keys(stagingRowErrors(row, products)).length > 0).length;

  const updateCell = (id: string, key: StagingField, value: string) => {
    onChange(rows.map((row) => row.id === id ? { ...row, [key]: value } : row));
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([`${headers.join(',')}\n`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'finverse-intake-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setMessage(null);
    if (!file.name.toLowerCase().endsWith('.csv')) { setMessage('Choose a CSV file. XLSX import is not connected yet.'); return; }
    if (file.size > 2_000_000) { setMessage('Choose a CSV file smaller than 2 MB.'); return; }
    try {
      const parsed = parseTemplateCsv(await file.text());
      onChange(parsed);
      onFileNameChange(file.name);
      setShowErrors(true);
      setMessage(`${parsed.length} ${parsed.length === 1 ? 'row' : 'rows'} loaded. Review the fields below before staging.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read this CSV file.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const rowInput = (row: StagingRow, index: number, key: StagingField, label: string, error?: string) => <>
    {key === 'product' ? <Select aria-label={`Row ${index + 1} ${label}`} value={row.product} onChange={(event) => updateCell(row.id, key, event.target.value)} aria-invalid={Boolean(error)} className="min-w-0 w-full"><option value="">Select product</option>{products.map((product) => <option key={product} value={product}>{product}</option>)}</Select> :
      <Input aria-label={`Row ${index + 1} ${label}`} type={key === 'date' ? 'date' : key === 'email' ? 'email' : key === 'mobile' ? 'tel' : 'text'} value={row[key]} onChange={(event) => updateCell(row.id, key, event.target.value)} aria-invalid={Boolean(error)} className="min-w-0 w-full" />}
    {error && <span className="mt-1 block text-[11px] text-rose-700">{error}</span>}
  </>;

  return (
    <section aria-labelledby="staging-grid-heading" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="staging-grid-heading" className="text-sm font-semibold text-foreground">Prospect rows</h3>
          <p className="text-xs text-muted-foreground">Enter records in the columns below, or import the Finverse CSV template. Required fields are marked *.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}><Download className="mr-1.5 size-4" />Download template</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}><Upload className="mr-1.5 size-4" />Import CSV</Button>
          <input ref={fileInput} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Import a CSV file" onChange={(event) => void importFile(event.target.files?.[0])} />
        </div>
      </div>
      {message && <p role="status" className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-foreground">{message}</p>}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-[#113F3D]/10 px-2.5 py-1 font-semibold text-[#113F3D]">{rows.length} {rows.length === 1 ? 'row' : 'rows'}</span>
        {rows.length > 0 && <span className={invalidRows ? 'text-amber-700' : 'text-emerald-700'}>{invalidRows ? `${invalidRows} need attention` : 'All required cells complete'}</span>}
        <span className="text-muted-foreground">Maximum 500 rows. The selected vertical applies to this batch.<span className="hidden md:inline"> Scroll sideways for more columns.</span></span>
      </div>
      <div className="hidden max-w-full overflow-x-auto rounded-lg border border-border md:block" role="region" aria-label="Editable prospect rows" tabIndex={0}>
        <table className="min-w-[1260px] w-full border-collapse text-left text-xs">
          <thead className="bg-[#113F3D] text-white">
            <tr>
              <th scope="col" className="w-12 px-3 py-3 font-semibold">#</th>
              {STAGING_COLUMNS.map((column) => <th key={column.key} scope="col" className={`${column.width} px-2 py-3 font-semibold`}>{column.label}{column.required && <span aria-label="required"> *</span>}</th>)}
              <th scope="col" className="w-14 px-2 py-3 font-semibold">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, index) => {
              const errors = showErrors ? stagingRowErrors(row, products) : {};
              return <tr key={row.id} className="align-top even:bg-muted/20">
                <th scope="row" className="px-3 py-3 font-mono text-muted-foreground">{index + 1}</th>
                {STAGING_COLUMNS.map(({ key, label }) => <td key={key} className="px-2 py-2">
                  {rowInput(row, index, key, label, errors[key])}
                </td>)}
                <td className="px-2 py-2"><Button type="button" variant="ghost" size="sm" aria-label={`Remove row ${index + 1}`} onClick={() => onChange(rows.filter((candidate) => candidate.id !== row.id))}><Trash2 className="size-4" /></Button></td>
              </tr>;
            })}
            {!rows.length && <tr><td colSpan={9} className="px-5 py-8 text-center text-muted-foreground"><FileSpreadsheet className="mx-auto mb-2 size-6 text-[#113F3D]" />No rows yet. Add a row or import a CSV file.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden" aria-label="Editable prospect rows">
        {rows.map((row, index) => {
          const errors = showErrors ? stagingRowErrors(row, products) : {};
          return <div key={row.id} className="rounded-lg border border-border bg-background p-3">
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold text-[#113F3D]">Prospect row {index + 1}</span>
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove row ${index + 1}`} onClick={() => onChange(rows.filter((candidate) => candidate.id !== row.id))}><Trash2 className="size-4" /></Button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {STAGING_COLUMNS.map(({ key, label, required }) => <label key={key} className="block text-xs font-medium text-foreground">
                <span className="mb-1 block">{label}{required && ' *'}</span>
                {rowInput(row, index, key, label, errors[key])}
              </label>)}
            </div>
          </div>;
        })}
        {!rows.length && <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No prospect rows yet. Add a row or import a CSV file.</p>}
      </div>
      <Button type="button" variant="outline" size="sm" disabled={rows.length >= 500} onClick={() => { onChange([...rows, emptyStagingRow()]); setShowErrors(false); }}><Plus className="mr-1.5 size-4" />Add row</Button>
      {rows.length > 0 && invalidRows > 0 && <button type="button" className="ml-3 text-xs font-semibold text-[#113F3D] underline" onClick={() => setShowErrors(true)}>Show missing fields</button>}
    </section>
  );
}
