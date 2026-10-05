"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { PAGES } from "./pageCount";

/** A page of the mushaf by its number, Arabic or Latin digits alike (B1). */
export function PageJumpForm() {
  const t = useTranslations("rd");
  const router = useRouter();
  const id = useId();
  const [page, setPage] = useState("");
  const n = Number(page.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  const valid = Number.isInteger(n) && n >= 1 && n <= PAGES;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(`/mushaf/${n}`);
      }}
    >
      <label className="flex flex-col gap-1 text-[13px]" htmlFor={id}>
        {t("pageJumpLabel")}
        <input id={id} className="field-input w-[160px]" inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value)} placeholder="١–٦٠٤" dir="auto" />
      </label>
      <button type="submit" className="btn btn-primary min-h-[40px]" disabled={!valid}>{t("openPage")}</button>
    </form>
  );
}
