// Only reached by paths the locale proxy does not handle (for example a missing file such as /x.php);
// every other unknown path renders the localized 404 in [locale]/not-found. There is no root layout,
// so this page brings its own document.
import Link from "next/link";
import "./globals.css";

export default function RootNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center text-t1">
        <h1 className="text-[24px] font-semibold">الصفحة غير موجودة</h1>
        <p className="text-t2" lang="en" dir="ltr">Page not found</p>
        <p className="flex gap-3">
          <Link className="btn min-h-[40px] px-5" href="/">الرئيسية</Link>
          <Link className="btn min-h-[40px] px-5" href="/en" lang="en">Home</Link>
        </p>
      </body>
    </html>
  );
}
