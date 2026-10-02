// Shared lexicon data for all Jadhr pages (prototype data — same set the Reader uses).
const FORM_META = {
  'فَعَلَ': ['faʿala', 'Form I — base verb'],
  'فَعِلَ': ['faʿila', 'Form I — stative verb'],
  'فَعَّلَ': ['faʿʿala', 'Form II — causative verb'],
  'أَفْعَلَ': ['afʿala', 'Form IV — causative verb'],
  'فَاعِل': ['fāʿil', 'active participle'],
  'مُفَعِّل': ['mufaʿʿil', 'Form II participle'],
  'مُسْتَفْعِل': ['mustafʿil', 'Form X participle'],
  'مَفْعُول': ['mafʿūl', 'passive participle'],
  'مَفْعُولَة': ['mafʿūla', 'passive participle (fem.)'],
  'مَفْعَل': ['mafʿal', 'noun of place'],
  'مَفْعِل': ['mafʿil', 'noun of place'],
  'مَفْعَلَة': ['mafʿala', 'noun of place (fem.)'],
  'فِعَال': ['fiʿāl', 'verbal noun'],
  'فِعَالَة': ['fiʿāla', 'verbal noun (fem.)'],
  'فَعْل': ['faʿl', 'verbal noun'],
  'فِعْل': ['fiʿl', 'verbal noun'],
  'فَعَالَة': ['faʿāla', 'noun of quality'],
  'فَاعَل': ['fāʿal', 'noun'],
  'فَعُّول': ['faʿʿūl', 'intensive noun'],
  'تَفْعِيل': ['tafʿīl', 'Form II verbal noun'],
  'مُفَاعَلَة': ['mufāʿala', 'Form III verbal noun']
};

const ROOTS = [
  { key: 'ktb', ar: 'ك ت ب', bare: 'كتب', tr: 'k-t-b', en: 'writing, inscribing, setting down', arGist: 'الخطِّ والرسمِ وجمعِ الشيء إلى الشيء', corpus: 319 },
  { key: 'drs', ar: 'د ر س', bare: 'درس', tr: 'd-r-s', en: 'studying, wearing a path by repetition', arGist: 'إعادةِ الشيء حتى يُعرَف، ومنه الدَّرْسُ', corpus: 144 },
  { key: 'ilm', ar: 'ع ل م', bare: 'علم', tr: 'ʿ-l-m', en: 'knowing, marking, signposting', arGist: 'الأثرِ والعلامةِ يُستدَلُّ بها', corpus: 854 },
  { key: 'qra', ar: 'ق ر أ', bare: 'قرأ', tr: 'q-r-ʾ', en: 'reading, gathering into recitation', arGist: 'جمعِ الحروفِ وإخراجِها نُطقًا', corpus: 88 },
  { key: 'jls', ar: 'ج ل س', bare: 'جلس', tr: 'j-l-s', en: 'sitting, being seated', arGist: 'القعودِ ولزومِ الموضع', corpus: 41 },
  { key: 'qwm', ar: 'ق و م', bare: 'قوم', tr: 'q-w-m', en: 'standing, rising, upholding an affair', arGist: 'الانتصابِ والعزمِ وتولِّي الأمر', corpus: 660 }
];

const W = (id, ar, tr, en, pos, root, form, arDef, freq, senses) => ({ id, ar, tr, en, pos, root, form, arDef, freq, senses });
const WORDS = [
  W('kataba', 'كَتَبَ', 'kataba', 'he wrote', 'verb', 'ktb', 'فَعَلَ', 'خطَّ الحرفَ بالقلمِ وأثبتَه', 43, ['to write, set down in writing', 'to prescribe, ordain, make binding', 'to enrol or register a name']),
  W('katib', 'كَاتِب', 'kātib', 'writer, clerk, scribe', 'noun', 'ktb', 'فَاعِل', 'مَن يتولَّى الكتابةَ صناعةً', 12, ['one who writes; an author', 'a secretary or registrar of accounts']),
  W('maktub', 'مَكْتُوب', 'maktūb', 'written; a letter', 'participle', 'ktb', 'مَفْعُول', 'ما أُثبِتَ خطًّا، والرسالةُ نفسُها', 9, ['written, inscribed', 'a letter or written notice', 'decreed, appointed beforehand']),
  W('maktab', 'مَكْتَب', 'maktab', 'desk, writing place, office', 'noun', 'ktb', 'مَفْعَل', 'موضعُ الكتابة', 6, ['the place where one writes', 'an office or bureau']),
  W('maktaba', 'مَكْتَبَة', 'maktaba', 'library, bookshop', 'noun', 'ktb', 'مَفْعَلَة', 'موضعُ الكتبِ وجمعُها', 7, ['a collection of books; a library', 'a shop where books are sold']),
  W('kitab', 'كِتَاب', 'kitāb', 'book; writing', 'noun', 'ktb', 'فِعَال', 'المكتوبُ المجموعُ بين لوحين', 38, ['a book, a written volume', 'a written decree or prescription', 'a letter sent to someone']),
  W('kitaba', 'كِتَابَة', 'kitāba', 'writing, script, the craft of writing', 'noun', 'ktb', 'فِعَالَة', 'صناعةُ الخطِّ وحرفتُه', 11, ['the act or art of writing', 'a script or hand']),
  W('mukataba', 'مُكَاتَبَة', 'mukātaba', 'correspondence', 'noun', 'ktb', 'مُفَاعَلَة', 'أن يكتبَ كلُّ واحدٍ إلى صاحبِه', 4, ['an exchange of letters between two parties', 'a written contract of manumission']),
  W('darasa', 'دَرَسَ', 'darasa', 'he studied', 'verb', 'drs', 'فَعَلَ', 'أعادَ الشيءَ حتى حفظَه، وأصلُه أن يُعفَى الأثرُ بالوطء', 17, ['to study, to learn by repetition', 'to efface or wear away by treading']),
  W('darrasa', 'دَرَّسَ', 'darrasa', 'he taught', 'verb', 'drs', 'فَعَّلَ', 'جعلَ غيرَه يدرُسُ ويُعيدُ', 8, ['to teach, to make another study']),
  W('mudarris', 'مُدَرِّس', 'mudarris', 'teacher, instructor', 'noun', 'drs', 'مُفَعِّل', 'مَن يتولَّى تدريسَ غيرِه', 6, ['one who teaches a set lesson', 'a lecturer in a school']),
  W('madrasa', 'مَدْرَسَة', 'madrasa', 'school', 'noun', 'drs', 'مَفْعَلَة', 'موضعُ الدراسةِ ومجتمعُ الطلبة', 9, ['the place where study is done', 'a school of thought or method']),
  W('dars', 'دَرْس', 'dars', 'lesson', 'noun', 'drs', 'فَعْل', 'ما يُعادُ من العلمِ مرَّةً بعد مرَّة', 10, ['a lesson or portion recited', 'a trace worn away']),
  W('dirasa', 'دِرَاسَة', 'dirāsa', 'study, sustained reading', 'noun', 'drs', 'فِعَالَة', 'مداومةُ النظرِ في العلم', 7, ['the act of studying', 'a course of learning']),
  W('alima', 'عَلِمَ', 'ʿalima', 'he knew', 'verb', 'ilm', 'فَعِلَ', 'أدركَ الشيءَ على ما هو به', 35, ['to know, to be aware of', 'to perceive by a mark or sign']),
  W('allama', 'عَلَّمَ', 'ʿallama', 'he taught', 'verb', 'ilm', 'فَعَّلَ', 'جعلَ غيرَه عالِمًا، ووضعَ له العلامة', 14, ['to teach, to make known to another', 'to mark something with a sign']),
  W('ilm', 'عِلْم', 'ʿilm', 'knowledge, science', 'noun', 'ilm', 'فِعْل', 'إدراكُ الشيءِ بحقيقتِه', 53, ['knowledge, certain apprehension', 'a branch of learning']),
  W('alim', 'عَالِم', 'ʿālim', 'scholar, one who knows', 'noun', 'ilm', 'فَاعِل', 'مَن قامَ به العلمُ', 15, ['a learned person', 'knowing, informed of a thing']),
  W('alam', 'عَالَم', 'ʿālam', 'world, created order', 'noun', 'ilm', 'فَاعَل', 'كلُّ ما سوى الخالق، وسُمِّيَ لأنه علامةٌ على صانعِه', 21, ['the world; all created things', 'an age or a realm of beings']),
  W('muallim', 'مُعَلِّم', 'muʿallim', 'teacher', 'noun', 'ilm', 'مُفَعِّل', 'مَن يتولَّى التعليم', 5, ['one who teaches', 'a master of a craft']),
  W('talim', 'تَعْلِيم', 'taʿlīm', 'teaching, instruction', 'noun', 'ilm', 'تَفْعِيل', 'إيصالُ العلمِ إلى المتعلِّم', 4, ['the act of instructing', 'education as a practice']),
  W('alama', 'عَلَامَة', 'ʿalāma', 'mark, sign, token', 'noun', 'ilm', 'فَعَالَة', 'ما يُستدَلُّ به على غيرِه', 8, ['a sign or distinguishing mark', 'a landmark set up on a road']),
  W('maluma', 'مَعْلُومَة', 'maʿlūma', 'a piece of information', 'noun', 'ilm', 'مَفْعُولَة', 'ما صارَ معلومًا مِن خبرٍ أو أثر', 3, ['a thing known; a datum', 'a fixed or appointed amount']),
  W('qaraa', 'قَرَأَ', 'qaraʾa', 'he read, he recited', 'verb', 'qra', 'فَعَلَ', 'جمعَ الحروفَ وتلا بها', 18, ['to read, to recite aloud', 'to gather or collect together']),
  W('qari', 'قَارِئ', 'qāriʾ', 'reader, reciter', 'noun', 'qra', 'فَاعِل', 'مَن يقرأُ ويُحسِنُ التلاوة', 6, ['one who reads', 'a trained reciter']),
  W('qiraa', 'قِرَاءَة', 'qirāʾa', 'reading, recitation', 'noun', 'qra', 'فِعَالَة', 'فعلُ القارئِ وصنعتُه', 9, ['the act of reading aloud', 'a received manner of reciting']),
  W('jalasa', 'جَلَسَ', 'jalasa', 'he sat', 'verb', 'jls', 'فَعَلَ', 'قعدَ ولزِمَ موضعَه', 12, ['to sit down, to be seated', 'to remain in a place']),
  W('jalis', 'جَالِس', 'jālis', 'seated, sitting', 'participle', 'jls', 'فَاعِل', 'القاعدُ في موضعِه', 5, ['sitting, in a seated posture', 'a companion who sits with one']),
  W('majlis', 'مَجْلِس', 'majlis', 'council, sitting, assembly room', 'noun', 'jls', 'مَفْعِل', 'موضعُ الجلوسِ ومجتمعُ القوم', 8, ['the place where people sit', 'a session or assembly', 'a council of state']),
  W('qama', 'قَامَ', 'qāma', 'he stood, he rose', 'verb', 'qwm', 'فَعَلَ', 'انتصبَ قائمًا، وتولَّى الأمرَ', 33, ['to stand up, to rise', 'to undertake or attend to an affair', 'to be upright, to endure']),
  W('aqama', 'أَقَامَ', 'aqāma', 'he set up; he stayed', 'verb', 'qwm', 'أَفْعَلَ', 'أثبتَ الشيءَ قائمًا، ولزِمَ المكان', 54, ['to set up or establish', 'to reside, to stay in a place', 'to perform an obligation duly']),
  W('qiyam', 'قِيَام', 'qiyām', 'standing, upholding', 'noun', 'qwm', 'فِعَال', 'الانتصابُ والقيامُ بالأمر', 22, ['the act of standing', 'the upholding or management of a matter']),
  W('qawm', 'قَوْم', 'qawm', 'a people, a company', 'noun', 'qwm', 'فَعْل', 'الجماعةُ من الناس يقومُ بعضُهم مع بعض', 383, ['a body of people', 'a tribe or kinsfolk']),
  W('qayyum', 'قَيُّوم', 'qayyūm', 'self-subsisting, sustainer of all', 'noun', 'qwm', 'فَعُّول', 'القائمُ بنفسِه المقيمُ لغيرِه', 3, ['self-subsisting, eternally standing', 'the sustainer of all that is']),
  W('mustaqim', 'مُسْتَقِيم', 'mustaqīm', 'straight, upright, unbroken', 'participle', 'qwm', 'مُسْتَفْعِل', 'ما استوى ولم يَعوَجّ', 37, ['straight, direct, without bend', 'upright in conduct'])
];

const DICTS = [
  { id: 'ayn', ar: 'كتاب العين', en: 'Kitab al-Ayn', by: 'al-Khalil ibn Ahmad al-Farahidi', d: 786, tag: 'earliest', kind: 'earliest' },
  { id: 'tahdhib', ar: 'تهذيب اللغة', en: 'Tahdhib al-Lugha', by: 'al-Azhari', d: 980, tag: 'general', kind: 'general' },
  { id: 'sihah', ar: 'الصحاح', en: 'al-Sihah', by: 'al-Jawhari', d: 1003, tag: 'selective', kind: 'general' },
  { id: 'maqayis', ar: 'مقاييس اللغة', en: 'Maqayis al-Lugha', by: 'Ibn Faris', d: 1004, tag: 'root-semantic', kind: 'root' },
  { id: 'mufradat', ar: 'المفردات', en: 'Mufradat al-Quran', by: 'al-Raghib al-Isfahani', d: 1108, tag: 'interpretive', kind: 'interpretive' },
  { id: 'lisan', ar: 'لسان العرب', en: 'Lisan al-Arab', by: 'Ibn Manzur', d: 1311, tag: 'comprehensive', kind: 'general' },
  { id: 'qamus', ar: 'القاموس المحيط', en: 'al-Qamus al-Muhit', by: 'al-Fayruzabadi', d: 1414, tag: 'concise', kind: 'general' },
  { id: 'taj', ar: 'تاج العروس', en: 'Taj al-Arus', by: 'Murtada al-Zabidi', d: 1791, tag: 'encyclopedic', kind: 'general' },
  { id: 'lane', ar: 'معجم لين', en: "Lane's Lexicon", by: 'Edward William Lane', d: 1893, tag: 'english', kind: 'english' }
];

const FILTERS = [
  { k: 'all', label: 'All 9' },
  { k: 'earliest', label: 'Earliest' },
  { k: 'general', label: 'General' },
  { k: 'root', label: 'Root-semantic' },
  { k: 'interpretive', label: 'Interpretive' },
  { k: 'english', label: 'English' }
];

const TAILS = [
  'وقد جاءَ في كلامِ العربِ على وجوهٍ، وسيأتي بيانُ ذلك في موضعِه.',
  'قال بعضُ أهلِ اللغةِ: وهذا هو الأصلُ في البابِ، وما بعدَه متفرِّعٌ عنه.',
  'ويقالُ في الجمعِ على غيرِ القياسِ، وقد حُكِيَت فيه لغاتٌ عن العرب.',
  'وأنشدَ في ذلك بيتًا لم يُسنَد إلى قائلٍ معروفٍ، وفيه نظرٌ عندَ المحقِّقين.',
  'والوجهُ الآخرُ أن يكونَ محمولًا على المعنى الأوَّلِ اتِّساعًا في الكلام.'
];

const BOOK = {
  ar: 'كِتَابُ العِلْمِ وَالمَكْتَبَة',
  en: 'The Book of Knowledge and the Library',
  chapters: [
    {
      ar: 'فِي المَكْتَبَة', en: 'In the Library',
      passages: [
        {
          tr: 'qaraʾtu fī l-maktabati kitāban qadīman, fa-wajadtu fīhi kitābatan lā yaʿrifuhā n-nās',
          en: 'I read an old book in the library, and found in it a script that people no longer know.',
          toks: ['قَرَأْتُ|qaraa|verb · 1st sg. perfect', 'فِي', 'المَكْتَبَةِ|maktaba|noun · genitive, definite', 'كِتَابًا|kitab|noun · accusative, indefinite', 'قَدِيمًا،', 'فَوَجَدْتُ', 'فِيهِ', 'كِتَابَةً|kitaba|noun · accusative, indefinite', 'لَا', 'يَعْرِفُهَا', 'النَّاسُ.']
        },
        {
          tr: 'wa-kāna l-kātibu jālisan ilā maktabihī ḥīna kataba mā kataba, wa-l-ʿilmu ʿindahū qiyāmun lā quʿūd',
          en: 'The writer was seated at his desk when he wrote what he wrote; for him knowledge was a standing, not a sitting.',
          toks: ['وَكَانَ', 'الكَاتِبُ|katib|noun · nominative, definite', 'جَالِسًا|jalis|participle · accusative', 'إِلَى', 'مَكْتَبِهِ|maktab|noun · genitive + possessive', 'حِينَ', 'كَتَبَ|kataba|verb · 3rd sg. perfect', 'مَا', 'كَتَبَ،|kataba|verb · 3rd sg. perfect', 'وَالعِلْمُ|ilm|noun · nominative, definite', 'عِنْدَهُ', 'قِيَامٌ|qiyam|noun · nominative, indefinite', 'لَا', 'قُعُودٌ.']
        },
        {
          tr: 'maktūbun ʿalā bābi l-maktabati: man aqāma hunā qāma bi-amri nafsih',
          en: 'Written above the library door: whoever settles here takes charge of his own affair.',
          toks: ['مَكْتُوبٌ|maktub|participle · nominative', 'عَلَى', 'بَابِ', 'المَكْتَبَةِ:|maktaba|noun · genitive, definite', 'مَنْ', 'أَقَامَ|aqama|verb · Form IV perfect', 'هُنَا', 'قَامَ|qama|verb · 3rd sg. perfect', 'بِأَمْرِ', 'نَفْسِهِ.']
        },
        {
          tr: 'wa-l-mukātabatu bayna l-qāriʾi wa-l-kitābi mustaqīmatun lā tanqaṭiʿ',
          en: 'The correspondence between reader and book runs straight, and is never cut off.',
          toks: ['وَالمُكَاتَبَةُ|mukataba|noun · nominative, definite', 'بَيْنَ', 'القَارِئِ|qari|noun · genitive, definite', 'وَالكِتَابِ|kitab|noun · genitive, definite', 'مُسْتَقِيمَةٌ|mustaqim|participle · fem. nominative', 'لَا', 'تَنْقَطِعُ.']
        }
      ]
    },
    {
      ar: 'الدَّرْسُ وَالطَّرِيق', en: 'The Lesson and the Road',
      passages: [
        {
          tr: 'qāla l-muʿallimu: ad-darsu laysa ḥifẓan, wa-innamā huwa dirāsatun taqūmu ʿalā l-qirāʾa',
          en: 'The teacher said: a lesson is not memorising — it is a study that stands upon reading.',
          toks: ['قَالَ', 'المُعَلِّمُ:|muallim|noun · nominative, definite', 'الدَّرْسُ|dars|noun · nominative, definite', 'لَيْسَ', 'حِفْظًا،', 'وَإِنَّمَا', 'هُوَ', 'دِرَاسَةٌ|dirasa|noun · nominative, indefinite', 'تَقُومُ|qama|verb · 3rd fem. sg. imperfect', 'عَلَى', 'القِرَاءَةِ.|qiraa|noun · genitive, definite']
        },
        {
          tr: 'fa-man qaraʾa wa-lam yafham fa-qad darasa ṭ-ṭarīqa wa-lam yasir fīh',
          en: 'Whoever reads and does not understand has worn down the road without walking it.',
          toks: ['فَمَنْ', 'قَرَأَ|qaraa|verb · 3rd sg. perfect', 'وَلَمْ', 'يَفْهَمْ', 'فَقَدْ', 'دَرَسَ|darasa|verb · 3rd sg. perfect', 'الطَّرِيقَ', 'وَلَمْ', 'يَسِرْ', 'فِيهِ.']
        },
        {
          tr: 'wa-fī l-madrasati majlisun yajlisu fīhi l-ʿālimu, yuʿallimu ṭ-ṭullāba t-taʿlīma l-awwal',
          en: 'In the school there is a hall where the scholar sits, teaching the students the first instruction.',
          toks: ['وَفِي', 'المَدْرَسَةِ|madrasa|noun · genitive, definite', 'مَجْلِسٌ|majlis|noun · nominative, indefinite', 'يَجْلِسُ|jalasa|verb · 3rd sg. imperfect', 'فِيهِ', 'العَالِمُ،|alim|noun · nominative, definite', 'يُعَلِّمُ|allama|verb · Form II imperfect', 'الطُّلَّابَ', 'التَّعْلِيمَ|talim|noun · accusative, definite', 'الأَوَّلَ.']
        }
      ]
    },
    {
      ar: 'العِلْمُ عَلَامَة', en: 'Knowledge is a Mark',
      passages: [
        {
          tr: 'al-ʿilmu nūrun, wa-l-ʿilmu ʿalāmatun, wa-l-maʿlūmatu aṯarun min āṯārihā',
          en: 'Knowledge is light; knowledge is a mark; and a piece of information is one of its traces.',
          toks: ['العِلْمُ|ilm|noun · nominative, definite', 'نُورٌ،', 'وَالعِلْمُ|ilm|noun · nominative, definite', 'عَلَامَةٌ،|alama|noun · nominative, indefinite', 'وَالمَعْلُومَةُ|maluma|noun · nominative, definite', 'أَثَرٌ', 'مِنْ', 'آثَارِهَا.']
        },
        {
          tr: 'yajlisu l-mudarrisu fī l-majlisi, wa-yudarrisu mā darasa',
          en: 'The instructor sits in the hall and teaches what he himself studied.',
          toks: ['يَجْلِسُ|jalasa|verb · 3rd sg. imperfect', 'المُدَرِّسُ|mudarris|noun · nominative, definite', 'فِي', 'المَجْلِسِ،|majlis|noun · genitive, definite', 'وَيُدَرِّسُ|darrasa|verb · Form II imperfect', 'مَا', 'دَرَسَ.|darasa|verb · 3rd sg. perfect']
        },
        {
          tr: 'wa-l-kitābatu ṣināʿatun, wa-l-qirāʾatu ʿādatun, wa-baynahumā yaqūmu l-ʿālam',
          en: 'Writing is a craft, reading is a habit, and between the two the world stands.',
          toks: ['وَالكِتَابَةُ|kitaba|noun · nominative, definite', 'صِنَاعَةٌ،', 'وَالقِرَاءَةُ|qiraa|noun · nominative, definite', 'عَادَةٌ،', 'وَبَيْنَهُمَا', 'يَقُومُ|qama|verb · 3rd sg. imperfect', 'العَالَمُ.|alam|noun · nominative, definite']
        }
      ]
    }
  ]
};

const WMAP = {}; WORDS.forEach(w => { WMAP[w.id] = w; });
const RMAP = {}; ROOTS.forEach(r => { RMAP[r.key] = r; });
const TYPE_COLOR = { root: 'var(--c-root)', form: 'var(--c-form)', word: 'var(--c-word)', sentence: 'var(--c-sentence)', description: 'var(--c-desc)' };

function parseTok(raw) {
  const p = raw.split('|');
  return { ar: p[0], word: p[1] || null, gram: p[2] || '' };
}
const OCC = {};
BOOK.chapters.forEach((c, ci) => c.passages.forEach((p, pi) => p.toks.forEach((raw, ti) => {
  const t = parseTok(raw);
  if (!t.word) return;
  (OCC[t.word] = OCC[t.word] || []).push({ ci, pi, ti, gram: t.gram, ar: t.ar });
})));

function lexEntry(w, root, dict) {
  let text;
  if (dict.kind === 'english') {
    text = w.ar + ' ' + w.tr + ' — ' + w.en + '. ' + w.senses.map((s, i) => (i + 1) + '. ' + s).join(' === ')
      + '. (Placeholder article standing in for the lexicon text, so the layout can be judged at a realistic length.)'
      + (dict.id === 'lane' ? ' The root ' + root.bare + ' is said to signify, primarily, ' + root.en
        + '; and hence the verb is used of a person who does so with deliberation, and of one who does so by habit. '
        + 'Some of the lexicologists hold the first of these senses to be the original, and the rest to be derived from it by an '
        + 'extension of meaning familiar in the speech of the Arabs; others reverse the order, and make the concrete sense the later. '
        + 'The grammarians differ likewise as to the form here cited: some treat it as the measure ' + w.form
        + ', others as a noun of place, and the point is left undecided by the earlier authorities. '
        + 'It is also said, on the authority of a tradition, that the word was applied to the instrument of the act before it was applied to the act itself, '
        + 'which, if correct, would explain the order in which the senses are arranged above.' : '');
  } else if (dict.kind === 'root') {
    text = '(' + root.bare + ') أصلٌ صحيحٌ يدلُّ على ' + root.arGist + '، ومن ذلك ' + w.ar + ': ' + w.arDef + '. '
      + 'والبابُ كلُّه راجعٌ إلى هذا المعنى عندَ التحقيق.';
  } else {
    text = w.ar + ': ' + w.arDef + '، وهو من ' + root.bare + '، ومعناه عندَ أهلِ اللغةِ ' + root.arGist + '. '
      + 'ويقالُ: ' + w.ar + ' على ' + w.senses.length + ' أوجهٍ، أوَّلُها ما ذكرناه.'
      + (dict.id === 'lisan' ? ' وقد اختلفَ أهلُ اللغةِ في أصلِ هذا الحرفِ اختلافًا كثيرًا، فمنهم من جعلَه من ' + root.bare
        + ' على معنى ' + root.arGist + '، ومنهم من ذهبَ إلى أنَّه مأخوذٌ من غيرِه، والأوَّلُ أثبتُ عندَ المحقِّقين. '
        + 'قال بعضُهم: وإنَّما سُمِّيَ بذلك لأنَّه يجمعُ ويضمُّ بعضَه إلى بعضٍ، والعربُ تستعملُ هذا البناءَ في كلِّ ما كان على هذا السبيلِ. '
        + 'وحُكِيَ عن الأصمعيِّ أنَّه كان يفرِّقُ بين الوجهين، ويرى أنَّ أحدَهما للعملِ والآخرَ للآلةِ، وخالفَه في ذلك أبو زيدٍ. '
        + 'وفي الحديثِ ما يدلُّ على سعةِ هذا المعنى واتِّساعِ العربِ فيه، وهو بابٌ واسعٌ لا يُحصَى، وقد أوردناه على وجهِه ليُنظَرَ فيه.' : '');
  }
  const reps = 1 + ((w.id.length + dict.id.length) % 4);
  for (let i = 0; i < reps; i++) text += ' ' + TAILS[(i + dict.id.length) % TAILS.length];
  return { id: dict.id + ':' + w.id, dict, text };
}

const TOPICS = ['Knowledge', 'Writing', 'Teaching', 'The library', 'Uprightness'];
const CORPORA = [
  { id: 'poetry', label: 'Pre-Islamic poetry', y: 580 },
  { id: 'quran', label: 'Qurʾān', y: 632 },
  { id: 'hadith', label: 'Ṣaḥīḥ al-Bukhārī', y: 846 }
];
const TL_MIN = 550, TL_MAX = 1920;
const tlX = y => ((y - TL_MIN) / (TL_MAX - TL_MIN) * 100);
const dictAttests = (w, i, j) => i === 0 || ((j * 7 + i * 3 + w.id.length) % 3) !== 0;
const corpusAttests = (w, i, c) => (i === 0 && c === 1 && w.freq > 20) || ((c * 5 + i * 2 + w.freq) % 3) === 0;
const SENSE_COLORS = ['var(--c-root)', 'var(--c-form)', 'var(--c-word)', 'var(--c-sentence)', 'var(--c-desc)'];
const stripDia = t => (t || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا');
const P_KEY = (ci, pi) => ci + '.' + pi;
const P_REF = (ci, pi) => 'Ch. ' + (ci + 1) + ' · passage ' + (pi + 1);
const P_ROOTS = ps => [...new Set(ps.toks.map(t => parseTok(t).word).filter(Boolean).map(id => WMAP[id].root))];
const ALL_PASSAGES = [];
BOOK.chapters.forEach((c, ci) => c.passages.forEach((ps, pi) => ALL_PASSAGES.push({
  ci, pi, ps, key: P_KEY(ci, pi), ref: P_REF(ci, pi), short: (ci + 1) + '·' + (pi + 1), roots: P_ROOTS(ps)
})));


const SCRIPTURE = [
  { id: 'quran', ar: 'القُرْآنُ الكَرِيم', en: 'The Qurʾān', kind: 'Qurʾān', chapters: [
    { ar: 'سُورَةُ البَقَرَة', en: 'al-Baqara · 2', meta: 'Medinan · 286 verses', passages: [
      { ref: '2:31', tr: 'wa-ʿallama Ādama l-asmāʾa kullahā', en: 'And He taught Adam the names, all of them; then He presented them to the angels and said: tell Me the names of these, if you are truthful.', toks: ['وَعَلَّمَ|allama|verb · Form II perfect', 'آدَمَ', 'الْأَسْمَاءَ', 'كُلَّهَا', 'ثُمَّ', 'عَرَضَهُمْ', 'عَلَى', 'الْمَلَائِكَةِ', 'فَقَالَ', 'أَنْبِئُونِي', 'بِأَسْمَاءِ', 'هَٰؤُلَاءِ', 'إِنْ', 'كُنْتُمْ', 'صَادِقِينَ'] },
      { ref: '2:32', tr: 'qālū subḥānaka lā ʿilma lanā illā mā ʿallamtanā', en: 'They said: Glory be to You — we have no knowledge except what You have taught us; You are the Knowing, the Wise.', toks: ['قَالُوا', 'سُبْحَانَكَ', 'لَا', 'عِلْمَ|ilm|noun · accusative, indefinite', 'لَنَا', 'إِلَّا', 'مَا', 'عَلَّمْتَنَا|allama|verb · Form II perfect + 2 pl. + 1 pl. obj.', 'إِنَّكَ', 'أَنْتَ', 'الْعَلِيمُ|alim|adjective · intensive · nominative', 'الْحَكِيمُ'] },
      { ref: '2:255', tr: 'Allāhu lā ilāha illā huwa l-ḥayyu l-qayyūm', en: 'God — there is no god but He, the Living, the Self-Subsisting…', toks: ['اللهُ', 'لَا', 'إِلَٰهَ', 'إِلَّا', 'هُوَ', 'الْحَيُّ', 'الْقَيُّومُ|qayyum|noun · nominative, definite'] }
    ] },
    { ar: 'سُورَةُ طه', en: 'Ṭā Hā · 20', meta: 'Meccan · 135 verses', passages: [
      { ref: '20:114', tr: 'wa-qul rabbi zidnī ʿilman', en: 'And say: my Lord, increase me in knowledge.', toks: ['وَقُلْ', 'رَبِّ', 'زِدْنِي', 'عِلْمًا|ilm|noun · accusative, indefinite'] }
    ] }
  ] },
  { id: 'bukhari', ar: 'صَحِيحُ البُخَارِي', en: 'Ṣaḥīḥ al-Bukhārī', kind: 'Ḥadīth', chapters: [
    { ar: 'كِتَابُ العِلْم', en: 'Kitāb al-ʿIlm', meta: 'The Book of Knowledge · 76 ḥadīth', passages: [
      { ref: 'Bukhārī 71', tr: 'wa-innamā l-ʿilmu bi-t-taʿallum', en: '…and knowledge comes only by learning.', toks: ['مَنْ', 'يُرِدِ', 'اللهُ', 'بِهِ', 'خَيْرًا', 'يُفَقِّهْهُ', 'فِي', 'الدِّينِ،', 'وَإِنَّمَا', 'العِلْمُ|ilm|noun · nominative, definite', 'بِالتَّعَلُّمِ'] },
      { ref: 'Bukhārī 79', tr: 'mathalu mā baʿathanī llāhu bihī mina l-hudā wa-l-ʿilm', en: 'The likeness of the guidance and knowledge God has sent me with is that of abundant rain…', toks: ['مَثَلُ', 'مَا', 'بَعَثَنِي', 'اللهُ', 'بِهِ', 'مِنَ', 'الهُدَى', 'وَالعِلْمِ|ilm|noun · genitive, definite', 'كَمَثَلِ', 'غَيْثٍ', 'كَثِيرٍ'] }
    ] }
  ] }
];
const SCRIPT_OCC = {};
SCRIPTURE.forEach(b => b.chapters.forEach(c => c.passages.forEach(p => p.toks.forEach(raw => {
  const t = parseTok(raw); if (!t.word) return;
  (SCRIPT_OCC[t.word] = SCRIPT_OCC[t.word] || []).push({ book: b.id, bookEn: b.en, kind: b.kind, ref: p.ref, ar: p.toks.map(x => parseTok(x).ar).join(' '), en: p.en, gram: t.gram, surface: t.ar, chapter: c.en });
}))));
const KEYS = {
  prefs: 'jadhr-prefs', states: 'jadhr-word-states', marks: 'jadhr-marks', notes: 'jadhr-notes', progress: 'jadhr-progress',
  texts: 'jadhr-texts', sessions: 'jadhr-sessions', context: 'jadhr-context', account: 'jadhr-account', proposals: 'jadhr-proposals', graphs: 'jadhr-published', onboarded: 'jadhr-onboarded'
};
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const AFFIX_PRE = [['وَ','conj.'],['فَ','conj.'],['بِ','prep.'],['لِ','prep.'],['كَ','prep.'],['ال','def. art.'],['سَ','future'],['يُ','impf. 3 m. · passive'],['يَ','impf. 3 m.'],['تَ','impf. 2/3 f.'],['نَ','impf. 1 pl.'],['أَ','impf. 1 sg.'],['مُ','participle'],['مَ','noun of place / pass. part.'],['اِسْتَ','Form X']];
const AFFIX_SUF = [['ُونَ','m. pl. nom.'],['ِينَ','m. pl. obl.'],['َاتِ','f. pl.'],['َاتُ','f. pl.'],['ُهُ','+ his'],['ُهَا','+ her'],['ُهُمْ','+ their'],['ِهِ','+ his'],['نِي','+ me'],['نَا','+ us'],['ةً','f. acc.'],['ةٌ','f. nom.'],['ةِ','f. gen.'],['ةُ','f.'],['ةَ','f.'],['ً','acc. indef.'],['ٌ','nom. indef.'],['ٍ','gen. indef.'],['َ','acc.'],['ُ','nom.'],['ِ','gen.'],['ْ','juss.']];
function analyse(surface) {
  const clean = (surface || '').replace(/[،.:؛!؟]/g, '');
  const bare = stripDia(clean);
  const hasArt = /^(و|ف|ب|ل|ك)?ال/.test(bare);
  const hits = WORDS.filter(w => stripDia(w.ar) === bare || stripDia(w.ar) === bare.replace(/^ال/, '') || stripDia(w.ar) === bare.replace(/^(و|ف|ب|ل|ك)?ال/, ''));
  const hit = hits.length ? (hasArt ? (hits.find(w => w.pos !== 'verb') || hits[0]) : hits[0]) : null;
  const segs = []; let core = clean;
  for (const [a, g] of AFFIX_PRE) { if (stripDia(core).startsWith(stripDia(a)) && stripDia(core).length > stripDia(a).length + 1) { segs.push({ t: a, g, kind: 'pre' }); core = core.slice(a.length); break; } }
  let suf = null;
  for (const [a, g] of AFFIX_SUF) { if (core.endsWith(a) && core.length > a.length + 1) { suf = { t: a, g, kind: 'suf' }; core = core.slice(0, -a.length); break; } }
  segs.push({ t: core, g: 'stem', kind: 'stem' });
  if (suf) segs.push(suf);
  const stemBare = stripDia(core).replace(/^ال/, '');
  const skel = stemBare.replace(/[اوي]/g, '');
  const cands = ROOTS.map(r => {
    const rb = r.bare; let score = 0;
    if (skel === rb) score = 0.92;
    else if (rb.split('').every(ch => stemBare.includes(ch)) && stemBare.length <= rb.length + 3) score = 0.7 - 0.05 * (stemBare.length - rb.length);
    else if (rb.split('').filter(ch => stemBare.includes(ch)).length === 2) score = 0.3;
    return { root: r, score: +score.toFixed(2) };
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (hit) cands.unshift({ root: RMAP[hit.root], score: 0.99, word: hit });
  const seen = {}; const dedup = cands.filter(c => { const k = c.root.key; if (seen[k]) return false; seen[k] = true; return true; });
  const pre = segs[0].kind === 'pre' ? segs[0].t : '';
  const pattern = hit ? hit.form : (pre === 'مَ' ? 'مَفْعُول' : pre === 'مُ' ? 'مُفَعِّل' : /^[يتنأ]/.test(pre) ? 'يَفْعَلُ' : 'فَعَلَ');
  const gram = segs.filter(s => s.kind !== 'stem').map(s => s.g).join(' · ');
  return { surface: clean, segments: segs, candidates: dedup, word: hit || null, pattern, gram: gram || (hit ? hit.pos : 'unanalysed'), confidence: dedup.length ? dedup[0].score : 0 };
}
export { FORM_META, ROOTS, WORDS, DICTS, FILTERS, TAILS, BOOK, WMAP, RMAP, TYPE_COLOR, parseTok, OCC, lexEntry, TOPICS, CORPORA, TL_MIN, tlX, dictAttests, corpusAttests, SENSE_COLORS, stripDia, P_KEY, P_REF, P_ROOTS, ALL_PASSAGES, TL_MAX, SCRIPTURE, SCRIPT_OCC, KEYS, load, save, analyse };
