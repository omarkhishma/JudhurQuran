import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Prose } from "@/components/prose/Prose";
import { localized } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "ar" ? "الخصوصية" : "Privacy", alternates: localized(locale, "/privacy") };
}

/**
 * What the site keeps and for how long, said as the code does it (P6.1, NTB-Q02, PRF-Q03): every period here is a
 * setting of the API (`settings.py`) or the backup service (`infra/compose.prod.yml`) — change them together.
 */
export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (locale === "ar")
    return (
      <Prose>
        <h1>الخصوصية</h1>
        <p className="lead">قراءتك للقرآن وما تتدبّره أمرٌ خاص بك. لذلك يعمل الموقع كله دون حساب ودون تتبّع، والحساب اختياري لمن أراد أن تصحبه بياناته بين أجهزته.</p>

        <h2>دون حساب</h2>
        <ul>
          <li><strong>لا تتبّع ولا إعلانات ولا ملفات تعريف ارتباط.</strong> لا أدوات تحليل ولا تتبّع من أطراف أخرى، ولا نضع أي ملف تعريف ارتباط، حتى للدخول.</li>
          <li><strong>ما تحفظه يبقى في متصفحك:</strong> المحفوظات والملاحظات وسجلّ القراءة وحالات الكلمات وبطاقات المراجعة والخرائط ونصوصك وموضع القراءة والإعدادات، في التخزين المحلي للمتصفح وقاعدة بياناته. تصدّرها كلها أو تحذفها من صفحة «حسابي».</li>
          <li><strong>ما يُرسل ولا يُحفظ:</strong> لتُجلب لك صفحة تُرسل أحيانًا كلمات مما عندك — جذور الكلمات التي تراجعها، وما تغطيه كلماتك من القرآن، وما تذكره في ملاحظاتك، ونصوصك كلمةً كلمة ليُعرف ما فيها. تُرسل في متن الطلب لا في الرابط، ولا تُحفظ ولا تُخزَّن مؤقتًا.</li>
          <li><strong>روابط مشاركة الخرائط</strong> تحمل الخريطة نفسها داخل الرابط بعد علامة #، وهذا الجزء لا يصل إلى خوادمنا.</li>
        </ul>

        <h2>إن دخلت إلى حساب</h2>
        <ul>
          <li><strong>ما نحفظه:</strong> بريدك الإلكتروني؛ والاسم والجهة ورقم ORCID إن كتبتها؛ والأجهزة التي دخلت منها (اسم المتصفح والنظام كما تراه في قائمة أجهزتك، ووقت الدخول وآخر استعمال)؛ وما تزامنه: المحفوظات والملاحظات وحالات الكلمات ومواضع القراءة وبطاقات المراجعة والخرائط ونصوصك وإعدادات القراءة والتلاوة.</li>
          <li><strong>مشفّر على الخادم:</strong> كل عنصر تزامنه يُحفظ مشفّرًا (AES-GCM) مربوطًا بحسابك وموضعه، ولا يُفكّ إلا ليُرسل إلى أجهزتك.</li>
          <li><strong>بلا ملف عامّ:</strong> لا يظهر اسمك إلا على المساهمات التي تُدمج في المعجم، بالاسم الذي تختاره.</li>
          <li><strong>سجلّ القراءة لا يُزامن إلا إن فعّلت ذلك</strong> في «حسابي»، وإن أوقفته حُذف من الخادم كله.</li>
          <li><strong>مشاركة ما تبحث عنه لا تكون إلا إن فعّلتها:</strong> تُحفظ الكلمات والجذور والآيات التي تبحث عنها سنةً ثم تُحذف.</li>
          <li><strong>الدخول عبر Google أو Apple</strong> يصلنا منه بريدك الموثَّق ومعرّف حسابك عندهم فقط.</li>
          <li><strong>رسالة الدخول</strong> تُرسل إلى بريدك عبر مزوّد البريد، ولا نستعمل البريد لغيرها.</li>
        </ul>

        <h2>كم نحفظ</h2>
        <ul>
          <li>رابط الدخول يعمل مرة واحدة خلال ١٥ دقيقة.</li>
          <li>الدخول من جهاز ينتهي بعد ٩٠ يومًا من الدخول، وتُخرج أي جهاز متى شئت.</li>
          <li>حين تتعارض نسختان من عنصر تُؤخذ الأحدث وتُحفظ الأخرى ٣٠ يومًا لتسترجعها، ثم تُحذف.</li>
          <li>ما تشاركه مما تبحث عنه: سنة واحدة.</li>
          <li>حذف الحساب يحذف كل ما فيه من الخادم فورًا. ونسخنا الاحتياطية لبيانات الحسابات تُحفظ ١٤ يومًا، فيخرج منها الحساب المحذوف خلال ١٤ يومًا.</li>
        </ul>

        <h2>حقوقك</h2>
        <ul>
          <li>تصدّر ما على جهازك ونسخة حسابك من الخادم من «حسابي» ← «بياناتك».</li>
          <li>تحذف ما على جهازك بضغطتين، وتحذف حسابك بخطوتين؛ وحذف بيانات الجهاز يُخرجه من الحساب أولًا فلا يحذف ما في الحساب.</li>
        </ul>

        <h2>ما يصل إلى الخادم في كل حال</h2>
        <ul>
          <li><strong>سجلات الخادم:</strong> يتلقى الخادم عنوان IP لكل طلب كما في أي موقع، ويُستعمل مؤقتًا للحماية من الإفراط في الطلبات فقط.</li>
          <li><strong>الصوت:</strong> عند تشغيل التلاوة يُجلب الملف من خادم التلاوات المذكور في صفحة المصادر.</li>
        </ul>
      </Prose>
    );
  return (
    <Prose>
      <h1>Privacy</h1>
      <p className="lead">Your reading of the Quran and what you reflect on are yours. The whole site works with no account and no tracking; an account is optional, for those who want their data with them across devices.</p>

      <h2>Without an account</h2>
      <ul>
        <li><strong>No tracking, no ads, no cookies.</strong> No third-party analytics or tracking tools, and we set no cookie at all, not even to sign in.</li>
        <li><strong>What you keep stays in your browser:</strong> saved items, notes, the reading journal, word states, review cards, maps, your own texts, your reading position and settings, in the browser&apos;s local storage and database. Export or delete them all from the Profile page.</li>
        <li><strong>What is sent and not kept:</strong> to fetch a page, words from what you have are sometimes sent — the roots of the words you review, how much of the Quran your words cover, what your notes mention, your own texts word by word to read them. They travel in the request body, never in a link, and are neither stored nor cached.</li>
        <li><strong>Map share links</strong> carry the map inside the link after the # sign, a part of the URL that never reaches our servers.</li>
      </ul>

      <h2>If you sign in</h2>
      <ul>
        <li><strong>What we keep:</strong> your e-mail address; the name, affiliation and ORCID if you give them; the devices you signed in from (browser and system as shown in your device list, when you signed in and last used it); and what you sync: saved items, notes, word states, reading positions, review cards, maps, your texts, reading and recitation settings.</li>
        <li><strong>Encrypted on the server:</strong> each synced item is stored encrypted (AES-GCM), bound to your account and its place, and decrypted only to send it to your devices.</li>
        <li><strong>No public profile:</strong> your name appears only on contributions merged into the lexicon, under the name you choose.</li>
        <li><strong>The reading journal syncs only if you turn that on</strong> in your Profile; turned off, it is removed from the server entirely.</li>
        <li><strong>Sharing what you look up happens only if you turn it on:</strong> the words, roots and verses you look up are kept for a year, then deleted.</li>
        <li><strong>Signing in with Google or Apple</strong> gives us only your verified e-mail address and their identifier for your account.</li>
        <li><strong>The sign-in e-mail</strong> is sent through an e-mail provider, and we use your address for nothing else.</li>
      </ul>

      <h2>How long</h2>
      <ul>
        <li>A sign-in link works once, within 15 minutes.</li>
        <li>A device stays signed in for 90 days from signing in, and you can sign any device out at any time.</li>
        <li>When two versions of an item conflict the newer is kept and the other for 30 days, for you to restore, then deleted.</li>
        <li>Lookups you share: one year.</li>
        <li>Deleting your account removes everything it holds from the server at once. Our backups of account data are kept 14 days, so a deleted account leaves them within 14 days.</li>
      </ul>

      <h2>Your rights</h2>
      <ul>
        <li>Export what is on your device and your account&apos;s copy from the server, under Profile → Your data.</li>
        <li>Delete what is on your device in two clicks and your account in two steps; deleting a device&apos;s data signs it out first, so it never deletes the account&apos;s.</li>
      </ul>

      <h2>What reaches the server in any case</h2>
      <ul>
        <li><strong>Server logs:</strong> like any website, the server receives each request&apos;s IP address; it is used transiently for rate limiting only.</li>
        <li><strong>Audio:</strong> when you play a recitation, the file is fetched from the recitation server named on the sources page.</li>
      </ul>
    </Prose>
  );
}
