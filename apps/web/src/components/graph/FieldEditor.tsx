"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { formatNumber, readNumber } from "@/lib/format";
import { getFile, MAX_FILE, putFile } from "@/lib/graph/files";
import type { Field } from "@/lib/graph/types";

/**
 * One field of a card (EDT-093, EDT-108, EDT-109, D16): a draft of its own, kept on blur or Enter and dropped with
 * Escape; tags as chips; a file, an image or a sound kept in this browser (lib/graph/files). The same component
 * on the card ("card": compact, label fixed) and in the details ("panel": the label renamed there).
 */
export function FieldEditor({
  field,
  density,
  editable,
  onValue,
  onRemove,
  onLabel,
  onError,
}: {
  field: Field;
  density: "card" | "panel";
  editable: boolean;
  onValue: (value: Field["value"], fileName?: string) => void;
  onRemove?: () => void;
  onLabel?: (label: string) => void;
  onError?: (message: string) => void;
}) {
  const t = useTranslations("graph");
  const [label, setLabel] = useState<string | null>(null);
  const small = density === "card";
  return (
    <div className={"field-row nodrag" + (small ? " is-card" : "")} onDoubleClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5">
        {onLabel && editable ? (
          <input
            className="field-label-input"
            aria-label={t("fieldLabel")}
            value={label ?? field.label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => {
              if (label !== null && label.trim() && label.trim() !== field.label) onLabel(label.trim());
              setLabel(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              else if (e.key === "Escape") {
                setLabel(null);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        ) : (
          <span className="field-label">{field.label}</span>
        )}
        <span className="flex-1" />
        {editable && onRemove && (
          <button type="button" className="field-remove" onClick={onRemove} aria-label={t("fieldRemove", { label: field.label })} title={t("fieldRemove", { label: field.label })}>
            ×
          </button>
        )}
      </div>
      <FieldValue field={field} editable={editable} onValue={onValue} onError={onError} />
    </div>
  );
}

function FieldValue({ field, editable, onValue, onError }: { field: Field; editable: boolean; onValue: (value: Field["value"], fileName?: string) => void; onError?: (m: string) => void }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const [draft, setDraft] = useState<string | null>(null);
  const keep = (v: string) => {
    setDraft(null);
    const next = field.kind === "number" ? (v.trim() === "" ? 0 : readNumber(v)) : v;
    if (field.kind === "number" && !Number.isFinite(next)) return onError?.(t("fieldNumberBad"));
    if (next !== field.value) onValue(next);
  };
  const keys = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (field.kind !== "notes" || e.metaKey || e.ctrlKey)) (e.target as HTMLElement).blur();
    else if (e.key === "Escape") {
      setDraft(null);
      // the draft is dropped before the blur keeps it
      requestAnimationFrame(() => (e.target as HTMLElement).blur());
    }
  };
  // a number in the interface's digits, read back from either
  const text = draft ?? (Array.isArray(field.value) ? "" : field.kind === "number" ? formatPlain(Number(field.value), locale) : String(field.value));

  if (!editable) return <ReadValue field={field} />;
  switch (field.kind) {
    case "notes":
      return <textarea className="field-input min-h-[56px] resize-y" value={text} aria-label={field.label} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== null && keep(draft)} onKeyDown={keys} />;
    case "select":
      return (
        <select className="field-input" value={String(field.value)} aria-label={field.label} onChange={(e) => onValue(e.target.value)}>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    case "tags":
      return <Tags field={field} onValue={onValue} />;
    case "audio":
    case "image":
    case "file":
      return <FileValue field={field} onValue={onValue} onError={onError} />;
    case "link":
      return (
        <div className="flex items-center gap-1.5">
          <input className="field-input flex-1" type="url" dir="ltr" placeholder="https://" value={text} aria-label={field.label} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== null && (/^https?:\/\/\S+$/.test(draft) || draft === "" ? keep(draft) : (setDraft(null), onError?.(t("fieldLinkBad"))))} onKeyDown={keys} />
          {typeof field.value === "string" && field.value && (
            <a href={field.value} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-word underline">{t("fieldOpen")}</a>
          )}
        </div>
      );
    default:
      return (
        <input
          className="field-input"
          type={field.kind === "date" ? "date" : "text"}
          inputMode={field.kind === "number" ? "decimal" : undefined}
          dir={field.kind === "number" ? (locale === "ar" ? "rtl" : "ltr") : field.kind === "date" ? "ltr" : "auto"}
          value={text}
          aria-label={field.label}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== null && keep(draft)}
          onKeyDown={keys}
        />
      );
  }

}

/** A number in the interface's digits, without grouping (it is edited as typed). */
const formatPlain = (n: number, locale: string) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { useGrouping: false, maximumFractionDigits: 10 }).format(n);

/** A field as a read-only map shows it. */
function ReadValue({ field: f }: { field: Field }) {
  const locale = useLocale();
  if (Array.isArray(f.value)) return <p className="flex flex-wrap gap-1">{f.value.map((x) => <span key={x} className="field-chip">{x}</span>)}</p>;
  if (f.kind === "audio" || f.kind === "image" || f.kind === "file") return <FileValue field={f} onValue={() => {}} readOnly />;
  if (f.kind === "number") return <p className="text-[13px] text-t1">{formatNumber(Number(f.value), locale)}</p>;
  if (f.kind === "link" && f.value) return <a href={String(f.value)} target="_blank" rel="noopener noreferrer" className="text-[13px] text-word underline" dir="ltr">{String(f.value)}</a>;
  return <p className="whitespace-pre-wrap text-[13px] text-t1" dir="auto">{String(f.value) || "—"}</p>;
}

/** Tags as chips: Enter or a comma adds one, × removes it (EDT-109). */
function Tags({ field, onValue }: { field: Field; onValue: (value: Field["value"]) => void }) {
  const t = useTranslations("graph");
  const [draft, setDraft] = useState("");
  const tags = Array.isArray(field.value) ? field.value : [];
  const add = () => {
    const v = draft.trim();
    setDraft("");
    if (v && !tags.includes(v)) onValue([...tags, v]);
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((x) => (
        <span key={x} className="field-chip">
          {x}
          <button type="button" onClick={() => onValue(tags.filter((y) => y !== x))} aria-label={t("tagRemove", { tag: x })}>×</button>
        </span>
      ))}
      <input
        className="field-input min-w-[80px] flex-1"
        value={draft}
        placeholder={t("tagAdd")}
        aria-label={t("tagAddLabel", { label: field.label })}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Escape") setDraft("");
        }}
      />
    </div>
  );
}

/** A file, an image or a sound kept in this browser; said so when it is not here (another device, a shared link). */
function FileValue({ field, onValue, onError, readOnly }: { field: Field; onValue: (value: Field["value"], fileName?: string) => void; onError?: (m: string) => void; readOnly?: boolean }) {
  const t = useTranslations("graph");
  const input = useRef<HTMLInputElement>(null);
  const id = typeof field.value === "string" ? field.value : "";
  const stored = useQuery({ queryKey: ["graph-file", id], queryFn: async () => (await getFile(id)) ?? null, enabled: !!id, staleTime: Infinity });
  const accept = field.kind === "audio" ? "audio/*" : field.kind === "image" ? "image/*" : undefined;
  return (
    <div className="flex flex-col gap-1">
      {id && stored.data === null && <p className="text-[11.5px] text-t3">{t("fileNotHere", { name: field.fileName ?? "" })}</p>}
      {/* a data URL from this browser: there is nothing for the image optimiser to fetch */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {stored.data && field.kind === "image" && <img src={stored.data.url} alt={field.fileName ?? field.label} className="max-h-40 rounded-md object-contain" />}
      {stored.data && field.kind === "audio" && <audio controls src={stored.data.url} className="w-full" />}
      {stored.data && field.kind === "file" && (
        <a href={stored.data.url} download={stored.data.name} className="text-[12.5px] text-word underline">{stored.data.name}</a>
      )}
      {!readOnly && (
        <>
          <input
            ref={input}
            type="file"
            hidden
            accept={accept}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > MAX_FILE) return onError?.(t("fileTooLarge"));
              try {
                onValue(await putFile(f), f.name);
              } catch {
                onError?.(t("fileFailed"));
              }
            }}
          />
          <button type="button" className="btn self-start text-[12px]" onClick={() => input.current?.click()}>
            {id ? t("fileReplace") : t(field.kind === "image" ? "filePickImage" : field.kind === "audio" ? "filePickAudio" : "filePick")}
          </button>
        </>
      )}
    </div>
  );
}
