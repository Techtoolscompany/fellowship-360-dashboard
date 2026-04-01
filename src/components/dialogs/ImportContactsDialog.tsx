"use client";

import { useState, useRef } from "react";
import { Upload, Download, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { importContacts, type ImportContactRow } from "@/app/actions/contacts";
import {
  getMemberStatusLabel,
  normalizeImportedMemberStatus,
} from "@/lib/contacts/member-status";

// ── CSV parser ──────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field.trim());
        field = "";
      } else if (ch === "\r" && next === "\n") {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = "";
        i++;
      } else if (ch === "\n" || ch === "\r") {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }

  if (field || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.length > 0));
}

// Maps CSV header variants to canonical field names
const HEADER_MAP: Record<string, keyof ImportContactRow> = {
  firstname: "firstName",
  first_name: "firstName",
  "first name": "firstName",
  lastname: "lastName",
  last_name: "lastName",
  "last name": "lastName",
  email: "email",
  "email address": "email",
  phone: "phone",
  mobile: "phone",
  cell: "phone",
  "phone number": "phone",
  memberstatus: "memberStatus",
  member_status: "memberStatus",
  status: "memberStatus",
  source: "source",
  notes: "notes",
  note: "notes",
};

function mapHeaders(headers: string[]): (keyof ImportContactRow | null)[] {
  return headers.map((h) => HEADER_MAP[h.toLowerCase().trim()] ?? null);
}

type ParsedRow = ImportContactRow & { _valid: boolean; _error?: string };

function parseRows(raw: string[][]): ParsedRow[] {
  if (raw.length < 2) return [];
  const [headerRow, ...dataRows] = raw;
  const fieldMap = mapHeaders(headerRow);

  return dataRows.map((cells) => {
    const row: Partial<ImportContactRow> = {};
    cells.forEach((cell, i) => {
      const field = fieldMap[i];
      if (field) row[field] = cell;
    });

    const firstName = row.firstName?.trim() ?? "";
    const lastName = row.lastName?.trim() ?? "";

    if (!firstName || !lastName) {
      return { ...row, firstName, lastName, _valid: false, _error: "firstName and lastName required" };
    }
    return { firstName, lastName, email: row.email, phone: row.phone, memberStatus: row.memberStatus, source: row.source, notes: row.notes, _valid: true };
  });
}

// ── Template download ───────────────────────────────────────────────────────

function downloadTemplate() {
  const headers = "firstName,lastName,email,phone,memberStatus,source,notes";
  const example = "Jane,Doe,jane@example.com,5551234567,new_guest,website,Visited last Sunday";
  const blob = new Blob([`${headers}\n${example}\n`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "contacts_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ───────────────────────────────────────────────────────────────

type Step = "upload" | "preview" | "importing" | "done";

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSuccess?: () => void;
}

export function ImportContactsDialog({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
}: ImportContactsDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; failed: number; errors: { row: number; message: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = rows.filter((r) => r._valid);
  const invalidRows = rows.filter((r) => !r._valid);

  function reset() {
    setStep("upload");
    setRows([]);
    setFileName("");
    setProgress(0);
    setImportResult(null);
  }

  function handleClose(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const raw = parseCSV(text);
      const parsed = parseRows(raw);
      if (parsed.length === 0) {
        toast.error("No data rows found in CSV");
        return;
      }
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setStep("importing");
    setProgress(0);

    const CHUNK_SIZE = 50;
    const chunks: ImportContactRow[][] = [];
    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      chunks.push(validRows.slice(i, i + CHUNK_SIZE).map(({ _valid, _error, ...r }) => r));
    }

    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const result = await importContacts(organizationId, chunks[i]);
      inserted += result.inserted;
      updated += result.updated;
      failed += result.failed;
      errors.push(...result.errors);
      setProgress(Math.round(((i + 1) / chunks.length) * 100));
    }

    setImportResult({ inserted, updated, failed, errors });
    setStep("done");

    if (inserted + updated > 0) {
      onSuccess?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file to bulk import contacts."}
            {step === "preview" && `${rows.length} rows found — ${validRows.length} valid, ${invalidRows.length} with errors.`}
            {step === "importing" && "Importing contacts…"}
            {step === "done" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-[#bbff00] hover:bg-[#bbff00]/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Drop your CSV here, or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Columns: firstName, lastName, email, phone, memberStatus, source, notes
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                `memberStatus` accepts values like visitor, new_guest, regular_attendee, member, leader, inactive.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={downloadTemplate}>
              <Download className="w-4 h-4" /> Download template CSV
            </Button>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{validRows.length}</p>
                <p className="text-xs text-emerald-600">Ready to import</p>
              </div>
              {invalidRows.length > 0 && (
                <div className="flex-1 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{invalidRows.length}</p>
                  <p className="text-xs text-red-600">Will be skipped</p>
                </div>
              )}
            </div>

            <div className="max-h-[240px] overflow-y-auto rounded-lg border border-border text-xs">
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-6">#</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Phone</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.slice(0, 100).map((row, i) => (
                    <tr key={i} className={row._valid ? "" : "bg-red-50 dark:bg-red-900/10"}>
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 2}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          {row._valid
                            ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            : <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
                          {row.firstName} {row.lastName}
                          {row._error && <span className="text-red-500 ml-1">({row._error})</span>}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.email || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.phone || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {getMemberStatusLabel(
                          normalizeImportedMemberStatus(row.memberStatus) ?? "visitor"
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length > 100 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-center text-muted-foreground">
                        …and {rows.length - 100} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Step 3: Importing ── */}
        {step === "importing" && (
          <div className="py-6 space-y-4 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#bbff00] mx-auto" />
            <p className="text-sm text-muted-foreground">Importing {validRows.length} contacts…</p>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === "done" && importResult && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{importResult.inserted}</p>
                <p className="text-xs text-emerald-600">Created</p>
              </div>
              <div className="flex-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                <p className="text-xs text-blue-600">Updated</p>
              </div>
              {importResult.failed > 0 && (
                <div className="flex-1 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
                  <p className="text-xs text-red-600">Failed</p>
                </div>
              )}
            </div>

            {importResult.errors.length > 0 && (
              <div className="max-h-[160px] overflow-y-auto rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3 space-y-1">
                <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-2">Row errors:</p>
                {importResult.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">Row {e.row}: {e.message}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button
                className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a3df00]"
                disabled={validRows.length === 0}
                onClick={handleImport}
              >
                Import {validRows.length} contact{validRows.length !== 1 ? "s" : ""}
              </Button>
            </>
          )}
          {step === "done" && (
            <>
              <Button variant="outline" onClick={reset}>Import another</Button>
              <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a3df00]" onClick={() => handleClose(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
