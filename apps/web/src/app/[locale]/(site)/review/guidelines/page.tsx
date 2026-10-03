import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Prose } from "@/components/prose/Prose";
import { Link } from "@/i18n/navigation";
import { localized } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/review/guidelines">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "ar" ? "كيف يقرّر المراجعون" : "How reviewers decide", alternates: localized(locale, "/review/guidelines") };
}

/**
 * Written reviewer guidelines (RVQ-Q06; audit 12): what a reviewer checks and how they decide, so theological framing
 * does not drift into the lexicon and competing senses are shown with their sources rather than one winning. A draft
 * for the editorial board and the advisors of decision D15 — it describes what the queue already enforces and asks
 * reviewers to check the rest. Our own copy, flagged for review like terms.ts.
 */
export default async function Page({ params }: PageProps<"/[locale]/review/guidelines">) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (locale === "ar")
    return (
      <Prose>
        <h1>كيف يقرّر المراجعون</h1>
        <p className="lead">مسودة لهيئة التحرير ومستشاريها، تُراجَع قبل اعتمادها. تصف ما تفرضه طلبات التعديل اليوم، وما يُطلب من المراجع أن يتحقق منه بنفسه.</p>
        <h2>ما لا يتغيّر</h2>
        <ul>
          <li>النص القرآني لا يدخل في أي مقترح: لا يُقبل ما يمس رسم المصحف أو ضبطه.</li>
          <li>يُعتمد المقترح بموافقتين مستقلتين إحداهما من هيئة التحرير، ولا يقرّر صاحبه فيه، ولا يوافق مراجع مرتين.</li>
          <li>المعتمد يظهر بجانب مصدره، منسوبًا إلى صاحبه ومراجعيه، ولا يُكتب فوق مصدر أبدًا. ويمكن لهيئة التحرير ردّه، ويبقى أثره في سجل التغييرات.</li>
        </ul>
        <h2>المصدر قبل الرأي</h2>
        <p>لا يُعتمد معنى ولا صياغة معنى إلا بمصدر يستطيع المراجع أن يتحقق منه بنفسه: معجم مع مادته أو صفحته، أو آية، أو كتاب في النحو أو الصرف مع موضعه. «مصدر آخر» وحده لا يكفي، ولا اسم كتاب بلا موضع. افتح الموضع المذكور واقرأه قبل أن توافق.</p>
        <h2>ما يقوله المصدر، لا ما نزيده عليه</h2>
        <p>قارن الصياغة المقترحة بنص المصدر. لا يُقبل ما يُدخل في المعنى تفسيرًا عقديًا أو توجيهًا لم يقله المصدر، ولو كان صحيحًا في ذاته؛ فالمعجم هنا ناقل لأقوال أهله لا مفسّر. اطلب حينها تعديل الصياغة لتطابق المصدر، أو ارفض.</p>
        <h2>المعاني المتنافسة تُعرض ولا تُحسم</h2>
        <p>إذا ذكر مصدران معتبران معنيين، فالأصل أن يُضاف المعنى الثاني منسوبًا إلى مصدره لا أن يحل محل الأول. لا ترفض مقترحًا لأنه يخالف معنى تفضّله إذا كان له مصدر معتبر.</p>
        <h2>متى يُطلب تعديل ومتى يُرفض</h2>
        <ul>
          <li>اطلب تعديلًا إذا كان المقترح صالحًا في أصله وينقصه مصدر أو موضع أو صياغة أدق، واذكر في ملاحظتك ما ينقصه بالتحديد.</li>
          <li>ارفض إذا خالف المصدر الذي ذكره، أو خرج عن معنى الكلمة في هذا الموضع، أو كرّر ما هو موجود.</li>
          <li>التصحيح الصرفي يُقارن بالموضع نفسه في الآية لا بالكلمة في غيره، ويُذكر له مرجع في النحو أو الصرف.</li>
        </ul>
        <h2>الملاحظة والحياد</h2>
        <ul>
          <li>ملاحظتك تظهر لصاحب المقترح وللناس: اكتبها بلطف وتحديد.</li>
          <li>لا تقرّر في مقترح بينك وبين صاحبه مصلحة، ولا توافق على ما لم تتحقق من مصدره بنفسك.</li>
          <li>البلاغات تقرؤها هيئة التحرير كلها، ويُسجّل ما اتُّخذ في كل بلاغ.</li>
        </ul>
        <p>
          <Link href="/review">عُد إلى طلبات التعديل</Link>
        </p>
      </Prose>
    );
  return (
    <Prose>
      <h1>How reviewers decide</h1>
      <p className="lead">A draft for the editorial board and its advisors, to be reviewed before it is adopted. It describes what the review queue already enforces, and what a reviewer is asked to check for themselves.</p>
      <h2>What does not change</h2>
      <ul>
        <li>The Quranic text is never the subject of a proposal: nothing that touches the mushaf&apos;s writing or vowelling is accepted.</li>
        <li>A proposal is merged by two independent approvals, one of them the editorial board&apos;s; its author does not decide on it, and no reviewer approves twice.</li>
        <li>What is merged is shown beside its source, credited to its author and reviewers, never over a source. The board can take it back, and the changelog keeps both.</li>
      </ul>
      <h2>The source before the opinion</h2>
      <p>No meaning or wording of meaning is approved without a source the reviewer can check for themselves: a lexicon with its entry or page, a verse, or a work of grammar or morphology with its place. &ldquo;Other source&rdquo; alone is not enough, nor is a book&apos;s title without a place. Open the place cited and read it before approving.</p>
      <h2>What the source says, not what we add to it</h2>
      <p>Compare the proposed wording with the source&apos;s text. Wording that brings into a meaning a theological reading or framing the source does not state is not accepted, even if it is true in itself: the lexicon passes on what its authorities said, it does not interpret. Ask for the wording to follow the source, or decline.</p>
      <h2>Competing senses are shown, not settled</h2>
      <p>When two recognised sources give two senses, the second is added, credited to its source, rather than replacing the first. Do not decline a proposal because it differs from a sense you prefer when it has a recognised source.</p>
      <h2>When to send back, when to decline</h2>
      <ul>
        <li>Request changes when the proposal is sound but lacks a source, a place or a closer wording, and say in your note exactly what it lacks.</li>
        <li>Decline when it contradicts the source it cites, leaves the word&apos;s meaning at this place, or repeats what is already there.</li>
        <li>A morphology correction is checked against the same place in the verse, not the word elsewhere, and cites a grammar or morphology reference.</li>
      </ul>
      <h2>Notes and impartiality</h2>
      <ul>
        <li>Your note is read by the author and by everyone: write it kindly and precisely.</li>
        <li>Do not decide on a proposal whose author you have an interest with, and do not approve what you have not checked against its source yourself.</li>
        <li>Reports are read by the whole editorial board, and what was done about each is recorded.</li>
      </ul>
      <p>
        <Link href="/review">Back to the review queue</Link>
      </p>
    </Prose>
  );
}
