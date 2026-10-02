/**
 * Plain-language cards for the technical terms the interface shows (handoff §3.6). This is the site's own
 * linguistic copy — standard definitions of grammar and source terms, no religious content — and it is
 * flagged for expert review on the method page. Each term: name, category, two or three plain sentences,
 * and optionally a page that goes deeper.
 */

export type TermId =
  | "root" | "lemma" | "wazn" | "verbForm" | "formOne" | "derivedForm" | "activeParticiple" | "passiveParticiple"
  | "verbalNoun" | "perfect" | "imperfect" | "imperative" | "passiveVoice" | "nominative" | "accusative"
  | "genitive" | "jussive" | "prefix" | "suffix" | "stem" | "noRoot" | "tashkeel" | "rasm" | "imlaei"
  | "concordance" | "occurrences" | "lexicon" | "gharib" | "variant" | "gloss" | "transliteration"; // prettier-ignore

type Card = { name: string; body: string };
export type Term = { category: "grammar" | "writing" | "sources" | "meaning"; ar: Card; en: Card; href?: string };

export const CATEGORY = {
  grammar: { ar: "مصطلح صرفي ونحوي", en: "grammar term" },
  writing: { ar: "مصطلح في الكتابة", en: "writing term" },
  sources: { ar: "مصطلح في المصادر", en: "sources term" },
  meaning: { ar: "مصطلح في المعنى", en: "meaning term" },
} as const;

export const TERMS: Record<TermId, Term> = {
  root: {
    category: "grammar",
    href: "/roots",
    ar: { name: "الجذر", body: "الحروف الأصلية في الكلمة، وهي في الغالب ثلاثة وأحيانًا أربعة، تحمل معنى عامًّا تشترك فيه كل الكلمات المشتقة منها. من الجذر (ك ت ب) تأتي: كَتَبَ، وكِتَاب، ومَكْتُوب." },
    en: { name: "Root", body: "The core letters of a word — usually three, sometimes four — carrying a general meaning shared by every word built from them. From k-t-b come kataba (he wrote), kitāb (book) and maktūb (written)." },
  },
  lemma: {
    category: "grammar",
    ar: { name: "الصيغة المعجمية", body: "الكلمة في صورتها الأساسية كما تُذكر في المعجم، بلا سوابق ولا لواحق ولا تصريف. «يعلمون» و«علمتم» صيغتهما المعجمية «عَلِمَ»." },
    en: { name: "Lemma", body: "The dictionary form of a word, without prefixes, suffixes or inflection. Both yaʿlamūna (they know) and ʿalimtum (you knew) have the lemma ʿalima (to know)." },
  },
  wazn: {
    category: "grammar",
    href: "/about#wazn",
    ar: { name: "الوزن الصرفي", body: "قالب تُصبّ فيه حروف الجذر، ويُرمز فيه للحروف الأصلية بالفاء والعين واللام: «كَاتِب» على وزن فَاعِل، و«مَكْتُوب» على وزن مَفْعُول. الكلمات التي على وزن واحد تتشابه غالبًا في وظيفتها." },
    en: { name: "Pattern (wazn)", body: "A mould the root letters are poured into, written with the letters f-ʿ-l: kātib (writer) has the pattern fāʿil, maktūb (written) the pattern mafʿūl. Words on one pattern often share a job — the doer, the thing done, the place." },
  },
  verbForm: {
    category: "grammar",
    ar: { name: "الباب (وزن الفعل)", body: "الصورة التي يأتي عليها الفعل: إما ثلاثي مجرد مثل «عَلِمَ»، وإما مزيد بحرف أو أكثر يضيف إلى معناه، مثل «عَلَّمَ» أي جعل غيره يعلم، و«تَعَلَّمَ» أي حصّل العلم." },
    en: { name: "Verb form", body: "The shape a verb takes: the plain Form I (ʿalima, to know) or a derived form whose added letters add to the meaning — ʿallama (Form II, to teach: make someone know), taʿallama (Form V, to learn)." },
  },
  formOne: {
    category: "grammar",
    ar: { name: "الثلاثي المجرد", body: "الفعل المكوَّن من حروفه الأصلية الثلاثة وحدها، بلا حرف زائد: كَتَبَ، عَلِمَ، حَسُنَ. وبقية أبواب الفعل تُبنى عليه." },
    en: { name: "Form I", body: "The plain verb, made of its three root letters only: kataba (he wrote), ʿalima (he knew). Every other verb form is built on it." },
  },
  derivedForm: {
    category: "grammar",
    ar: { name: "الفعل المزيد", body: "فعل زيد على حروفه الأصلية حرف أو أكثر فتغيّر معناه أو زاد: أَكْرَمَ، قَاتَلَ، اسْتَغْفَرَ. ولكل زيادة معانٍ مشهورة يذكرها علماء الصرف." },
    en: { name: "Derived verb form", body: "A verb with letters added to its root, which shifts or adds to its meaning: akrama (Form IV, to honour), qātala (Form III, to fight), istaghfara (Form X, to seek forgiveness)." },
  },
  activeParticiple: {
    category: "grammar",
    ar: { name: "اسم الفاعل", body: "اسم يدل على من قام بالفعل: «كَاتِب» من كَتَبَ، و«مُؤْمِن» من آمَنَ. يأتي من الثلاثي على وزن فَاعِل." },
    en: { name: "Active participle", body: "The word for the one who does the action: kātib (writer) from kataba, muʾmin (believer) from āmana. From Form I it has the pattern fāʿil." },
  },
  passiveParticiple: {
    category: "grammar",
    ar: { name: "اسم المفعول", body: "اسم يدل على من وقع عليه الفعل: «مَكْتُوب» من كَتَبَ، و«مُكْرَم» من أَكْرَمَ. يأتي من الثلاثي على وزن مَفْعُول." },
    en: { name: "Passive participle", body: "The word for what the action was done to: maktūb (written) from kataba, mukram (honoured) from akrama. From Form I it has the pattern mafʿūl." },
  },
  verbalNoun: {
    category: "grammar",
    ar: { name: "المصدر", body: "اسم يدل على الحدث نفسه مجرّدًا من الزمن: «الكِتَابَة» و«العِلْم» و«الاسْتِغْفَار»." },
    en: { name: "Verbal noun (maṣdar)", body: "The action itself as a noun, without time: kitāba (writing), ʿilm (knowing, knowledge), istighfār (seeking forgiveness)." },
  },
  perfect: {
    category: "grammar",
    ar: { name: "الفعل الماضي", body: "ما دلّ على حدث وقع وانقضى: كَتَبَ، آمَنُوا." },
    en: { name: "Perfect", body: "The verb of a completed action — kataba (he wrote), āmanū (they believed). It names the action as done, not perfection." },
  },
  imperfect: {
    category: "grammar",
    ar: { name: "الفعل المضارع", body: "ما دلّ على حدث يقع في الحال أو في المستقبل: يَكْتُبُ، يُؤْمِنُونَ." },
    en: { name: "Imperfect", body: "The verb of an action still happening or yet to happen — yaktubu (he writes, will write), yuʾminūna (they believe)." },
  },
  imperative: {
    category: "grammar",
    ar: { name: "فعل الأمر", body: "ما يُطلب به حدوث الفعل: اكْتُبْ، اقْرَأْ." },
    en: { name: "Imperative", body: "The verb of a command or request: uktub (write!), iqraʾ (read!)." },
  },
  passiveVoice: {
    category: "grammar",
    ar: { name: "المبني للمجهول", body: "فعل لم يُذكر فاعله: «كُتِبَ» أي كتبه أحدٌ لم يُذكر، و«قُضِيَ» أي قضاه من لم يُسمَّ." },
    en: { name: "Passive voice", body: "A verb whose doer is not named: kutiba (it was written), quḍiya (it was decreed)." },
  },
  nominative: {
    category: "grammar",
    ar: { name: "المرفوع", body: "حالة الاسم حين يكون فاعلًا أو مبتدأً أو خبرًا ونحوها، وحالة الفعل المضارع حين لا يسبقه ناصب ولا جازم. علامتها الأصلية الضمة." },
    en: { name: "Nominative (and indicative)", body: "The case of a noun that is the subject or the predicate, and the plain mood of an imperfect verb. Its basic sign is the ḍamma (-u)." },
  },
  accusative: {
    category: "grammar",
    ar: { name: "المنصوب", body: "حالة الاسم حين يكون مفعولًا به أو حالًا أو تمييزًا ونحوها، وحالة الفعل المضارع بعد أدوات النصب مثل «أن» و«لن». علامتها الأصلية الفتحة." },
    en: { name: "Accusative (and subjunctive)", body: "The case of a noun that is an object, a circumstance and the like, and the mood of an imperfect verb after an and lan. Its basic sign is the fatḥa (-a)." },
  },
  genitive: {
    category: "grammar",
    ar: { name: "المجرور", body: "حالة الاسم بعد حرف الجر، أو حين يكون مضافًا إليه. علامتها الأصلية الكسرة." },
    en: { name: "Genitive", body: "The case of a noun after a preposition, or after another noun it belongs to (“of”). Its basic sign is the kasra (-i)." },
  },
  jussive: {
    category: "grammar",
    ar: { name: "المجزوم", body: "حالة الفعل المضارع بعد أدوات الجزم مثل «لم» و«لا» الناهية وأدوات الشرط. علامتها الأصلية السكون." },
    en: { name: "Jussive", body: "The mood of an imperfect verb after lam (did not), a forbidding lā, or a condition. Its basic sign is the sukūn (no vowel)." },
  },
  prefix: {
    category: "grammar",
    ar: { name: "السابقة", body: "حرف أو أكثر يتصل بأول الكلمة وليس من أصلها: واو العطف، وباء الجر، و«ال» التعريف." },
    en: { name: "Prefix", body: "A letter or two joined to the front of a word but not part of it: wa- (and), bi- (with, by), al- (the)." },
  },
  suffix: {
    category: "grammar",
    ar: { name: "اللاحقة", body: "ما يتصل بآخر الكلمة: الضمائر المتصلة مثل «ـهم» و«ـكم»، وعلامات الجمع والتأنيث." },
    en: { name: "Suffix", body: "What is joined to the end of a word: attached pronouns such as -hum (them) and -kum (you), and plural or feminine endings." },
  },
  stem: {
    category: "grammar",
    ar: { name: "الجذع", body: "قلب الكلمة بعد نزع السوابق واللواحق، وفيه حروف الجذر." },
    en: { name: "Stem", body: "The core of a word once prefixes and suffixes are taken off; it holds the root letters." },
  },
  noRoot: {
    category: "grammar",
    href: "/about#principles",
    ar: { name: "كلمات بلا جذر", body: "الحروف (مثل: مِن، في، إنّ) والضمائر وأسماء الإشارة والأسماء الموصولة وكثير من الأعلام الأعجمية لا تُردّ إلى جذر عند علماء الصرف، فلا نخترع لها جذرًا." },
    en: { name: "Words without a root", body: "Particles (min, fī, inna), pronouns, demonstratives, relative pronouns and many foreign names are not traced to a root in Arabic morphology, so none is invented for them." },
  },
  tashkeel: {
    category: "writing",
    ar: { name: "التشكيل", body: "الحركات الصغيرة فوق الحروف وتحتها: الفتحة والضمة والكسرة والسكون والشدة. البحث في الموقع لا يتأثر بها، فاكتب بها أو بدونها." },
    en: { name: "Vowel marks (tashkīl)", body: "The small marks above and below letters that show short vowels, doubling and silence. Search ignores them — type with or without." },
  },
  rasm: {
    category: "writing",
    ar: { name: "الرسم العثماني", body: "طريقة كتابة المصحف الموروثة، وتخالف الإملاء المعتاد في كلمات مثل «ٱلصَّلَوٰة» و«ٱلْكِتَٰب». نعرض نص مصحف المدينة كما نشره مجمع الملك فهد دون أي تغيير." },
    en: { name: "Uthmani script (rasm)", body: "The inherited spelling of the mushaf, which differs from everyday spelling in some words — ṣalāh (prayer) is written with a wāw: ٱلصَّلَوٰة. The Madinah mushaf text is shown exactly as the King Fahd Complex published it." },
  },
  imlaei: {
    category: "writing",
    ar: { name: "الرسم الإملائي", body: "الكلمة مكتوبة بقواعد الإملاء الحديثة، ونستعمله للبحث والفهرسة فقط: «الصلاة» مقابل «ٱلصَّلَوٰة»." },
    en: { name: "Standard spelling", body: "The word in modern spelling, used only for search and indexing — الصلاة beside the mushaf's ٱلصَّلَوٰة." },
  },
  concordance: {
    category: "sources",
    ar: { name: "الفهرس السياقي", body: "قائمة بكل مواضع الكلمة أو الجذر في القرآن، يظهر كل موضع ومعه ما قبله وما بعده من كلمات." },
    en: { name: "Concordance", body: "A list of every place a word or root occurs in the Quran, each shown with the words around it." },
  },
  occurrences: {
    category: "sources",
    href: "/about#counting",
    ar: { name: "المواضع", body: "عدد المرات التي ورد فيها الجذر أو الكلمة في المصحف؛ تُعدّ كل كلمة مرة واحدة، وطريقة العدّ مبيّنة في صفحة المنهج." },
    en: { name: "Occurrences", body: "How many times the root or word appears in the mushaf, counting each word once. How we count is set out on the method page." },
  },
  lexicon: {
    category: "sources",
    ar: { name: "المعجم", body: "كتاب يجمع ألفاظ اللغة ويشرح معانيها. نعرض هنا معاجم العربية الكبرى مثل «مقاييس اللغة» و«لسان العرب»، كلٌّ منسوب إلى مؤلفه وطبعته." },
    en: { name: "Lexicon", body: "A dictionary of the language. The site shows the great classical Arabic dictionaries — Maqāyīs al-Lugha, Lisān al-ʿArab and others — each credited to its author and edition." },
  },
  gharib: {
    category: "sources",
    ar: { name: "غريب القرآن", body: "كتب تشرح الكلمات القرآنية التي قد يخفى معناها على القارئ، مثل «تفسير غريب القرآن» لابن قتيبة." },
    en: { name: "Gharīb al-Qurʾān", body: "Books that explain the Quran's less familiar words, such as Ibn Qutaybah's Tafsīr Gharīb al-Qurʾān." },
  },
  variant: {
    category: "sources",
    href: "/about#principles",
    ar: { name: "اختلاف نسبة الجذر", body: "حين تردّ المصادر كلمةً إلى جذرين مختلفين نذكر النسبة الأساسية ونذكر معها ما قاله غيرها، منسوبًا إلى صاحبه." },
    en: { name: "Root variant", body: "When sources trace a word to different roots, the primary attribution is shown together with the others, each credited." },
  },
  gloss: {
    category: "meaning",
    ar: { name: "الترجمة الحرفية", body: "ترجمة قصيرة لكلمة واحدة في سياقها، وليست ترجمة لمعنى الآية." },
    en: { name: "Gloss", body: "A short translation of one word in its context — not a translation of the verse." },
  },
  transliteration: {
    category: "writing",
    ar: { name: "النقحرة", body: "كتابة الكلمة العربية بحروف لاتينية تقرّب نطقها لمن لا يقرأ العربية: ʿilm، kitāb." },
    en: { name: "Transliteration", body: "An Arabic word written in Latin letters so its sound can be read: ʿilm, kitāb." },
  },
};

/** Corpus feature tags → the term that explains them. */
export const TAG_TERM: Record<string, TermId> = {
  PERF: "perfect", IMPF: "imperfect", IMPV: "imperative", PASS: "passiveVoice",
  ACT_PCPL: "activeParticiple", PASS_PCPL: "passiveParticiple", VN: "verbalNoun",
  NOM: "nominative", ACC: "accusative", GEN: "genitive", IND: "nominative", SUBJ: "accusative", JUS: "jussive",
}; // prettier-ignore
