"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Icon } from "@/components/Icon";

export function HomeSearch() {
  const t = useTranslations("search");
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="flex items-center gap-2 rounded-2xl border border-line bg-card px-4 shadow-open focus-within:border-ring"
    >
      <Icon name="search" size={18} className="text-t3" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("placeholder")}
        aria-label={t("placeholder")}
        className="h-14 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-t3"
        enterKeyHint="search"
      />
    </form>
  );
}
