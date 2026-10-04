import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Prose } from "@/components/prose/Prose";
import { localized } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "ar" ? "الخصوصية" : "Privacy", alternates: localized(locale, "/privacy") };
}

/**
 * What the site keeps and for how long, said as the code does it (P6.1, P6.5, NTB-Q02, PRF-Q01, PRF-Q03): every period
 * here is a setting of the API (`settings.py`, `sync.py`), the web server's log (`infra/Caddyfile`) or the backup
 * service (`infra/compose.prod.yml`) — change them together.
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
          <li><strong>ما يُرسل ولا يُحفظ:</strong> لتُجلب لك صفحة تُرسل أحيانًا كلمات مما عندك — جذور الكلمات التي تراجعها، وما تغطيه كلماتك من القرآن ومن كل كتاب من كتب الحديث والتراث، وما تذكره في ملاحظاتك، ونصوصك كلمةً كلمة ليُعرف ما فيها. تُرسل في متن الطلب لا في الرابط، ولا تُحفظ ولا تُخزَّن مؤقتًا. وإن أضفت نصًّا من صفحة على الويب أو من ملف PDF، جلب خادمُنا الصفحة أو قرأ الملف وأعاد إليك نصه، ثم لا يحفظ العنوان ولا الملف ولا النص ولا يسجّلها؛ ويبقى النص بعدها في متصفحك كسائر نصوصك.</li>
          <li><strong>ما بعد علامة # في الرابط لا يصل إلى خوادمنا:</strong> فيه تحمل روابط مشاركة الخرائط الخريطة نفسها، وفيه يُذكر الدفتر الملاحظة المفتوحة، فلا يعرف الخادم على أي آية كتبت.</li>
        </ul>

        <h2>إن دخلت إلى حساب</h2>
        <ul>
          <li><strong>ما نحفظه:</strong> بريدك الإلكتروني؛ والاسم والجهة ورقم ORCID إن كتبتها؛ والأجهزة التي دخلت منها (اسم المتصفح والنظام كما تراه في قائمة أجهزتك، ووقت الدخول وآخر استعمال)؛ وما تزامنه: المحفوظات والملاحظات على الآيات، وملاحظات الدفتر، وحالات الكلمات، ومواضع القراءة وأبعد آية قرأتها في كل سورة، ومسودات المقترحات، والمسارات المحفوظة، وروابط الآيات وموضوعاتها، وبطاقات المراجعة، والخرائط، ونصوصك، واختيارات المحلّل، وإعدادات القراءة والتلاوة، واختياراتك في الصفحة الرئيسية.</li>
          <li><strong>مشفّر على الخادم:</strong> كل عنصر تزامنه — ما فيه واسمه معًا — يُحفظ مشفّرًا (AES-GCM) مربوطًا بحسابك، ويجده الخادم ببصمة مفتاحية لا تُقرأ منها الكلمة، ولا يُفكّ إلا ليُرسل إلى أجهزتك. أما غير المشفّر فبيانات حسابك المذكورة أعلاه، ونوع كل عنصر (ملاحظة أو إعداد مثلًا)، وحجمه، ووقت تغيّره.</li>
          <li><strong>سجلّ القراءة لا يُزامن إلا إن فعّلت ذلك</strong> في «حسابي»: ما بحثت عنه يومًا بيوم، وكل جذر مررت به ومتى، وآخر موضع بحثت فيه. وإن أوقفته حُذف ذلك كله من الخادم.</li>
          <li><strong>مشاركة ما تبحث عنه لا تكون إلا إن فعّلتها:</strong> تُحفظ الكلمات والجذور والآيات التي تبحث عنها مشفّرةً سنةً ثم تُحذف، وإن أوقفتها حُذف ما شاركته فورًا.</li>
          <li><strong>بلا ملف عامّ:</strong> لا صفحة لك يراها الناس. يظهر الاسم الذي تختاره — أو «مساهم» إن لم تختر اسمًا — على مقترحاتك وقراراتك في طلبات التعديل، وهي مفتوحة للجميع، وعلى ما يُعتمد منها. وإن غيّرت اسمك أو محوته تغيّر حيث يظهر.</li>
          <li><strong>مساهماتك:</strong> المقترحات التي ترسلها ومصادرها وقرارات المراجعين وملاحظاتهم تُحفظ سجلًّا عامًّا لما تغيّر في المعجم. وحذف الحساب يحذف مقترحاتك التي لم تُدمج ويمحو اسمك من كل ما دُمج، وتبقى الصياغة المدموجة في المعجم منسوبةً إلى «مساهم سابق».</li>
          <li><strong>الدخول عبر Google أو Apple</strong> يصلنا منه بريدك الموثَّق ومعرّف حسابك عندهم فقط.</li>
          <li><strong>رسالة الدخول</strong> تُرسل إلى بريدك عبر مزوّد البريد، ولا نستعمل البريد لغيرها.</li>
        </ul>

        <h2>كم نحفظ</h2>
        <ul>
          <li>رابط الدخول يعمل مرة واحدة خلال ١٥ دقيقة، ولا يُستعمل إلا حين تضغط الزر في الصفحة التي يفتحها.</li>
          <li>الدخول من جهاز ينتهي بعد ٩٠ يومًا من الدخول، وتُخرج أي جهاز متى شئت.</li>
          <li>حين تتعارض نسختان من عنصر تُؤخذ الأحدث وتُحفظ الأخرى ٣٠ يومًا لتسترجعها، ثم تُحذف.</li>
          <li>ما تحذفه يصل حذفه إلى أجهزتك الأخرى بعلامة تقول أي عنصر حُذف ومتى، تُحفظ ٩٠ يومًا ثم تُحذف؛ والجهاز الذي غاب أطول من ذلك يأخذ حسابك من جديد.</li>
          <li>ما تشاركه مما تبحث عنه: سنة واحدة.</li>
          <li>حذف الحساب يحذف كل ما فيه من الخادم فورًا. ونسخنا الاحتياطية لبيانات الحسابات — ونُسخها حيث كانت — تُحفظ ١٤ يومًا، فيخرج منها الحساب المحذوف خلال ١٤ يومًا. ويبقى الرقم الداخلي للحساب وحده ١٥ يومًا، لتُحذف بقاياه إن استُرجعت نسخة احتياطية في تلك المدة.</li>
          <li>يتسع الحساب لعشرين ألف عنصر؛ وما زاد يبقى على جهازك، وتقول ذلك صفحة «حسابي».</li>
        </ul>

        <h2>حقوقك</h2>
        <ul>
          <li>تصدّر ما على جهازك ونسخة حسابك من الخادم من «حسابي» ← «بياناتك». ونسخة الحساب فيها كل ما يحفظه الخادم لك: ما تزامنه، والنسخ المستبدلة، وعلامات الحذف، وما شاركته مما تبحث عنه، وطرق دخولك، ومساهماتك: مقترحاتك وقراراتك وبلاغاتك وما يُنسب إليك.</li>
          <li>تحذف ما على جهازك بضغطتين، وتحذف حسابك بخطوتين؛ وحذف بيانات الجهاز يُخرجه من الحساب أولًا فلا يحذف ما في الحساب.</li>
        </ul>

        <h2>ما يصل إلى الخادم في كل حال</h2>
        <ul>
          <li><strong>سجلّ الخادم:</strong> يسجّل خادم الويب كل طلب: وقته، والصفحة المطلوبة دون ما بعد علامة ? في الرابط، وعنوان IP مختصرًا لا يدل على اتصال بعينه (يبقى من عنوان IPv4 جزآه الأولان)، ويُحذف السجلّ بعد سبعة أيام. ولا تسجّل واجهة البرمجة الطلبات. وللحدّ من الإفراط في الطلبات يُحفظ العنوان في الذاكرة دقيقة بعد آخر طلب منه، وساعة لرسائل الدخول.</li>
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
        <li><strong>What is sent and not kept:</strong> to fetch a page, words from what you have are sometimes sent — the roots of the words you review, how much of the Quran and of each hadith collection and book your words cover, what your notes mention, your own texts word by word to read them. They travel in the request body, never in a link, and are neither stored nor cached. If you add a text from a web page or a PDF, our server fetches the page or reads the file and hands its text back to you, then keeps neither the address, the file nor the text, nor logs them; the text then lives in your browser like your other texts.</li>
        <li><strong>What follows the # in an address never reaches our servers:</strong> map share links carry the map there, and the Notebook names the note you have open there, so the server never learns which verse you wrote on.</li>
      </ul>

      <h2>If you sign in</h2>
      <ul>
        <li><strong>What we keep:</strong> your e-mail address; the name, affiliation and ORCID if you give them; the devices you signed in from (browser and system as shown in your device list, when you signed in and last used it); and what you sync: saved items and notes on verses, Notebook notes, word states, reading positions and the furthest verse read in each sūra, proposal drafts, saved trails, verse links and topics, review cards, maps, your texts, the Analyser&apos;s choices, reading and recitation settings, and your choices on the home page.</li>
        <li><strong>Encrypted on the server:</strong> each synced item — what it says and what it is called — is stored encrypted (AES-GCM), bound to your account; the server finds it by a keyed fingerprint that does not give the word back, and decrypts it only to send it to your devices. Not encrypted: your account details above, the kind of each item (a note, a setting), its size and when it changed.</li>
        <li><strong>The reading journal syncs only if you turn that on</strong> in your Profile: what you looked up day by day, every root you have met and when, and the last place you looked something up. Turned off, all of it is removed from the server.</li>
        <li><strong>Sharing what you look up happens only if you turn it on:</strong> the words, roots and verses you look up are kept encrypted for a year, then deleted; turned off, what you shared is removed at once.</li>
        <li><strong>No public profile:</strong> there is no page about you. The name you choose — or &ldquo;a contributor&rdquo; without one — appears on your proposals and decisions in the review queue, which anyone can read, and on what is merged from them; change or clear it and it changes wherever it appears.</li>
        <li><strong>Your contributions:</strong> the proposals you send, their sources, and the reviewers&apos; decisions and notes are kept as the public record of what changed in the lexicon. Deleting your account removes your unmerged proposals and your name from everything merged; merged wording stays in the lexicon, credited to a former contributor.</li>
        <li><strong>Signing in with Google or Apple</strong> gives us only your verified e-mail address and their identifier for your account.</li>
        <li><strong>The sign-in e-mail</strong> is sent through an e-mail provider, and we use your address for nothing else.</li>
      </ul>

      <h2>How long</h2>
      <ul>
        <li>A sign-in link works once, within 15 minutes, and only when you press the button on the page it opens.</li>
        <li>A device stays signed in for 90 days from signing in, and you can sign any device out at any time.</li>
        <li>When two versions of an item conflict the newer is kept and the other for 30 days, for you to restore, then deleted.</li>
        <li>Something you delete reaches your other devices as a marker of which item went and when, kept 90 days, then deleted; a device away for longer takes your account afresh.</li>
        <li>Lookups you share: one year.</li>
        <li>Deleting your account removes everything it holds from the server at once. Our backups of account data — and any copies of them — are kept 14 days, so a deleted account leaves them within 14 days. The account&apos;s internal number alone is kept 15 days, so that if a backup is restored in that time, what is left of the account is deleted again.</li>
        <li>An account holds up to 20,000 items; anything beyond stays on your device, and your Profile says so.</li>
      </ul>

      <h2>Your rights</h2>
      <ul>
        <li>Export what is on your device and your account&apos;s copy from the server, under Profile → Your data. The account&apos;s copy holds everything the server keeps for you: what you sync, the replaced versions, the deletion markers, the lookups you shared, the ways you sign in, and your contributions: your proposals, decisions and reports, and what is credited to you.</li>
        <li>Delete what is on your device in two clicks and your account in two steps; deleting a device&apos;s data signs it out first, so it never deletes the account&apos;s.</li>
      </ul>

      <h2>What reaches the server in any case</h2>
      <ul>
        <li><strong>Server log:</strong> the web server records each request — its time, the page asked for without the part of the address after ?, and your IP address shortened so it no longer points to one connection (an IPv4 address keeps its first two parts) — and deletes the log after seven days. The API keeps no log of requests. To limit excessive requests, an address is held in memory for a minute after its last request, and for an hour for sign-in e-mails.</li>
        <li><strong>Audio:</strong> when you play a recitation, the file is fetched from the recitation server named on the sources page.</li>
      </ul>
    </Prose>
  );
}
