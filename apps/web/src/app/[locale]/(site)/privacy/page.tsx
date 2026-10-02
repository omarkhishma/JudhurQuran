import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Prose } from "@/components/prose/Prose";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "ar" ? "الخصوصية" : "Privacy" };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (locale === "ar")
    return (
      <Prose>
        <h1>الخصوصية</h1>
        <p className="lead">قراءتك للقرآن وما تتدبّره أمرٌ خاص بك. لذلك بُني الموقع ليعمل دون حساب ودون تتبّع.</p>
        <ul>
          <li><strong>لا حسابات ولا تتبّع ولا إعلانات.</strong> لا نستعمل أدوات تحليل أو تتبّع من أطراف أخرى، ولا ملفات تعريف ارتباط إعلانية.</li>
          <li><strong>ما تحفظه يبقى في جهازك.</strong> المحفوظات والملاحظات والخرائط وموضع القراءة والتفضيلات تُخزَّن في متصفحك (التخزين المحلي) ولا تُرسل إلينا. يمكنك تصديرها أو حذفها كلها من صفحة «محفوظاتي».</li>
          <li><strong>روابط مشاركة الخرائط</strong> تحمل الخريطة نفسها داخل الرابط بعد علامة #، وهذا الجزء لا يصل إلى خوادمنا.</li>
          <li><strong>سجلات الخادم:</strong> يتلقى الخادم عنوان IP لكل طلب كما في أي موقع، ويُستعمل مؤقتًا للحماية من الإفراط في الطلبات فقط.</li>
          <li><strong>الصوت:</strong> عند تشغيل التلاوة يُجلب الملف من خادم التلاوات المذكور في صفحة المصادر.</li>
        </ul>
      </Prose>
    );
  return (
    <Prose>
      <h1>Privacy</h1>
      <p className="lead">Your reading of the Quran and what you reflect on are yours. The site is built to work with no account and no tracking.</p>
      <ul>
        <li><strong>No accounts, no tracking, no ads.</strong> No third-party analytics or tracking tools, no advertising cookies.</li>
        <li><strong>What you save stays on your device.</strong> Bookmarks, notes, maps, reading position and preferences live in your browser’s local storage and are never sent to us. Export or delete them all from the Saved page.</li>
        <li><strong>Map share links</strong> carry the map inside the link after the # sign, a part of the URL that never reaches our servers.</li>
        <li><strong>Server logs:</strong> like any website, the server receives each request’s IP address; it is used transiently for rate limiting only.</li>
        <li><strong>Audio:</strong> when you play a recitation, the file is fetched from the recitation server named on the sources page.</li>
      </ul>
    </Prose>
  );
}
