import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Prose } from "@/components/prose/Prose";
import { localized } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "ar" ? "عن المشروع ومنهجه" : "About and method", alternates: localized(locale, "/about") };
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return locale === "ar" ? <AboutAr /> : <AboutEn />;
}

function AboutAr() {
  return (
    <Prose>
      <h1>عن المشروع ومنهجه</h1>
      <p className="lead">جُذور موقع لقراءة القرآن الكريم وتدبّر كلماته من جذورها: كل كلمة في المصحف نصٌّ حقيقي تنقره فترى معناها وجذرها، وكم مرة ورد الجذر في القرآن، وكل الكلمات التي تفرّعت منه، ثم تتبّعها في آياتها أو على خريطة.</p>

      <h2 id="principles">مبادئنا</h2>
      <ul>
        <li><strong>النص القرآني أمانة.</strong> نعرض نص مصحف المدينة النبوية برواية حفص عن عاصم كما نشره مجمع الملك فهد لطباعة المصحف الشريف، حرفًا بحرف وبخطّه الرسمي دون تعديل، ونتحقق من سلامته آليًا ببصمة رقمية عند كل تحديث للبيانات.</li>
        <li><strong>لا نكتب معاني من عندنا.</strong> كل تفسير ومعنى ومادة معجمية منسوبٌ إلى مؤلفه ومصدره وطبعته. لا نستعمل الذكاء الاصطناعي في توليد المعاني أو التفسير أو في نسبة الكلمات إلى جذورها.</li>
        <li><strong>نُظهر الخلاف ولا نخفيه.</strong> حين تختلف المصادر في ردّ كلمة إلى جذرها نذكر النسبة الأساسية ونذكر معها ما قاله غيرها، منسوبًا إلى صاحبه.</li>
        <li><strong>ما لا جذر له لا نخترع له جذرًا.</strong> الحروف والضمائر وأسماء الإشارة والأسماء الموصولة وكثير من الأعلام الأعجمية لا تُردّ إلى جذر عند علماء الصرف، فنقول ذلك صراحة.</li>
        <li><strong>أرقام تصف ولا تدّعي.</strong> نعدّ المواضع ونصف توزيعها في السور، ولا نستخرج من الأعداد دلالات أو «إعجازًا عدديًا».</li>
        <li><strong>احترام القارئ.</strong> لا إعلانات، ولا تتبّع، ولا أساليب لإطالة بقائك. كل ما تحفظه يبقى في جهازك.</li>
      </ul>

      <h2 id="counting">كيف نعدّ</h2>
      <p>اختلاف الأرقام بين المواقع سببه غالبًا أن كلًّا منها يعدّ شيئًا مختلفًا. لذلك نحدّد ما نعدّه:</p>
      <ul>
        <li><strong>مواضع الجذر:</strong> كل كلمة في المصحف تعود إلى الجذر، تُعدّ مرة واحدة. نعتمد تقسيم «المدونة القرآنية اللغوية» للكلمات (٧٧٬٤٢٩ كلمة)، وهو يتبع رسم المصحف إلا في مواضع قليلة نوضحها في صفحات الكلمات.</li>
        <li><strong>الآيات:</strong> عدد الآيات المختلفة التي ورد فيها الجذر؛ فإن تكرر الجذر في آية واحدة عُدّت الآية مرة.</li>
        <li><strong>الصيغ:</strong> الصيغ المعجمية المختلفة المشتقة من الجذر (مثل: عَلِمَ، عِلْم، عَلِيم).</li>
        <li><strong>صور الكلمة:</strong> الكلمة كما وردت بسوابقها ولواحقها (مثل: يعلمون، والعلم)، وتُجمع بحسب رسمها الإملائي.</li>
        <li><strong>البسملة:</strong> تُعدّ آيةً في الفاتحة فقط، كما في مصحف المدينة؛ وبسملات السور الأخرى غير مرقمة فلا تدخل في العدّ.</li>
      </ul>

      <h2 id="wazn">كيف نحدّد الوزن</h2>
      <p>الوزن (الميزان الصرفي) يُرمز فيه لحروف الجذر بالفاء والعين واللام، وتُكتب الحروف الزائدة كما هي: «عَلِيم» على وزن فَعِيل، و«مُسْتَغْفِر» على وزن مُسْتَفْعِل. نحدّد الوزن من ثلاثة طرق، ولا نذكره إلا إذا تعيّن وزن واحد:</p>
      <ul>
        <li><strong>الأفعال:</strong> وزن الفعل المزيد من بابه في «المدونة القرآنية اللغوية» (أَفْعَلَ، تَفَعَّلَ، اسْتَفْعَلَ…). والثلاثي المجرد نذكر حركة عينه (فَعَلَ، فَعِلَ، فَعُلَ) إذا ظهرت في صيغة الماضي، وإلا اكتفينا بأنه ثلاثي مجرد.</li>
        <li><strong>المشتقات الموسومة:</strong> اسم الفاعل واسم المفعول والمصدر في الأبواب المزيدة لها وزن ثابت بحسب الباب (مُفْعِل، مُفْتَعَل، اسْتِفْعَال…).</li>
        <li><strong>سائر الأسماء:</strong> نطابق حروف الكلمة بحروف جذرها حرفًا حرفًا، ولا نقبل النتيجة إلا إذا كانت وزنًا واحدًا من قائمة مغلقة لأوزان العربية القياسية. فإن احتملت الكلمة وزنين (مثل «سَيَّارَة»: فَعَّالَة أو فَيْعَالَة) أو حُذف منها حرف من أصولها (مثل «يَد» و«ابْن») تركناها بلا وزن.</li>
      </ul>
      <p>ونذكر الوزن على أصل الكلمة قبل الإعلال، كما جرى عليه علماء الصرف: «قَالَ» على فَعَلَ، و«مِيزَان» على مِفْعَال، و«مَقَام» على مَفْعَل. هذه الأوزان تحليل آلي راجعنا عيّنات منه، وما زال قيد المراجعة اللغوية؛ فإن رأيت وزنًا غير صحيح فأخبرنا.</p>

      <h2 id="sources">من أين البيانات</h2>
      <p>النص من مجمع الملك فهد، ونتحقق منه بنص مشروع تنزيل. التحليل الصرفي (الجذر والصيغة ونوع الكلمة وأجزاؤها) من «المدونة القرآنية اللغوية». التفاسير والترجمات من مصادر تأذن بإعادة النشر أو من مؤلفين قدامى نصوصهم في الملك العام. معاني الجذور من المعاجم الكلاسيكية: المفردات للراغب، ومقاييس اللغة لابن فارس، ولسان العرب، والصحاح، ومعجم لين. التفاصيل والتراخيص في <Link href="/sources">صفحة المصادر والتراخيص</Link>.</p>

      <h2 id="limits">حدود العمل الحالية</h2>
      <ul>
        <li>بعض مواد المعاجم رُبطت بجذورها ربطًا تقريبيًا (اختلاف رسم الهمزة أو حروف العلة)؛ نعرض عالي الثقة منها مع تنبيه، ونحجب الباقي حتى تُراجَع.</li>
        <li>أوزان الكلمات تحليل آلي قيد المراجعة اللغوية، ولم نُضف بعدُ شرح ما يضيفه كل وزن إلى المعنى؛ سنضيفه من كتب الصرف منسوبًا إليها.</li>
      </ul>
      <p>إن وجدت خطأً فأخبرنا؛ فالدقة أولى عندنا من السرعة.</p>
    </Prose>
  );
}

function AboutEn() {
  return (
    <Prose>
      <h1>About and method</h1>
      <p className="lead">Judhur is a site for reading the Quran and reflecting on its words through their roots: every word of the mushaf is real text you can tap to see its meaning and root, how often that root occurs in the Quran, and every word that branches from it — then follow it through its verses or on a map.</p>
      <h2 id="principles">Our principles</h2>
      <ul>
        <li><strong>The Quranic text is a trust.</strong> We show the Madinah mushaf (Hafs ʿan ʿĀṣim) exactly as published by the King Fahd Glorious Quran Printing Complex, in its official script, unaltered, and verify it automatically with a digital fingerprint on every data update.</li>
        <li><strong>We do not write meanings ourselves.</strong> Every tafsir, meaning and dictionary article is credited to its author, source and edition. We never use AI to generate meanings or tafsir, or to assign roots.</li>
        <li><strong>We show disagreement instead of hiding it.</strong> Where sources trace a word to different roots, we show the primary attribution together with the others, credited.</li>
        <li><strong>No invented roots.</strong> Particles, pronouns, demonstratives, relative pronouns and many foreign proper names have no root in Arabic morphology, and we say so plainly.</li>
        <li><strong>Numbers that describe, never claim.</strong> We count and show distributions; we do not draw “numerical miracle” conclusions.</li>
        <li><strong>Respect for the reader.</strong> No ads, no tracking, no tricks to keep you longer. Everything you save stays on your device.</li>
      </ul>
      <h2 id="counting">How we count</h2>
      <ul>
        <li><strong>Occurrences of a root:</strong> every word of the mushaf that goes back to the root, counted once, following the Quranic Arabic Corpus word division (77,429 words).</li>
        <li><strong>Verses:</strong> distinct verses containing the root.</li>
        <li><strong>Lemmas:</strong> distinct dictionary forms derived from the root.</li>
        <li><strong>Word forms:</strong> the word as it occurs with its prefixes and suffixes, grouped by standard spelling.</li>
        <li><strong>Basmala:</strong> a numbered verse only in al-Fātiḥa, as in the Madinah mushaf; the basmalas of other surahs are unnumbered and not counted.</li>
      </ul>
      <h2 id="wazn">How patterns are found</h2>
      <p>A pattern (wazn) writes the root letters as f-ʿ-l and keeps the added letters as they are: «عَلِيم» is on the pattern فَعِيل, «مُسْتَغْفِر» on مُسْتَفْعِل. We find it in three ways and show it only when a single pattern is certain:</p>
      <ul>
        <li><strong>Verbs:</strong> the pattern of the verb form given in the Quranic Arabic Corpus (أَفْعَلَ، تَفَعَّلَ، اسْتَفْعَلَ…). For Form I we give the middle vowel (فَعَلَ، فَعِلَ، فَعُلَ) only when the past-tense dictionary form shows it; otherwise we say only “Form I”.</li>
        <li><strong>Tagged derived forms:</strong> participles and verbal nouns of the derived forms have a fixed pattern (مُفْعِل، مُفْتَعَل، اسْتِفْعَال…).</li>
        <li><strong>Other nouns:</strong> the word is matched letter by letter against its root, and the result is accepted only if it is exactly one pattern from a closed list of classical patterns. Words that fit two patterns (سَيَّارَة: فَعَّالَة or فَيْعَالَة) or have lost a root letter (يَد، ابْن) get none.</li>
      </ul>
      <p>As in classical morphology, the pattern describes the underlying form before vowel changes: قَالَ is فَعَلَ, مِيزَان is مِفْعَال, مَقَام is مَفْعَل. These patterns are an automatic analysis, checked on samples and still under linguistic review; please tell us about any error.</p>
      <h2 id="sources">Where the data comes from</h2>
      <p>Text from the King Fahd Complex, verified against the Tanzil Project; morphology from the Quranic Arabic Corpus; tafsir and translations from sources that permit re-publication or from public-domain classical authors; root meanings from the classical dictionaries. Details and licenses: <Link href="/sources">Sources & licenses</Link>.</p>
      <h2 id="limits">Current limits</h2>
      <ul>
        <li>Some dictionary articles are matched to their root approximately; high-confidence ones are shown with a caveat, the rest wait for review.</li>
        <li>Word patterns are an automatic analysis under linguistic review; what each pattern adds to the meaning is not described yet and will come, credited, from the classical morphology books.</li>
      </ul>
    </Prose>
  );
}
