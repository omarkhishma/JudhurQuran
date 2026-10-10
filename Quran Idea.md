# Project idea as in my head:

a website for the holy quran, the concept is about the quran roots. in arabic language each word has a root and a one root may create multiple words/forms, the science that study these forms called Arabic Morphology (علم الصرف, ilm al-sarf).

Full Vision: this gonna include an Arabic dictionary, Quran and Hadith encyclopedia, and book reading site supported with the dictionary. its gonna be like a full eco-system for islamic topics enriching each others.

---

I would like to brainstorm an idea with you: a website for the Holy Quran.

At its core, The Quranic text would be rendered as actual selectable text, using an authentic Quranic script. This would allow users to interact with every verse and every individual word separately.

The main idea is that each word in the Quran would be clickable. When a user clicks on a word, they would be able to view its meaning. In Arabic, there is an important linguistic concept known as roots or linguistic roots. I would like this concept to be explained clearly for more context. Quranic words are connected to linguistic roots, and through these roots, users can understand how many times a particular root appears in the Quran, as well as explore the different words derived from it.

Provided and example database (.csv/Json) that contains all the words of the Quran along with their linguistic roots. I also want you to search for other available Quranic root databases or linguistic datasets, so we can compare them and verify the accuracy of the information we already have.

#### My Research Results:

**Quran and Hadith:**

- Tafsir_api: https://github.com/spa5k/tafsir_api
- https://sunnah.com/developers
- Dorar Hadith API: https://dorar.net/article/389/%D8%AE%D8%AF%D9%85%D8%A9-%D9%88%D8%A7%D8%AC%D9%87%D8%A9-%D8%A7%D9%84%D9%85%D9%88%D8%B3%D9%88%D8%B9%D8%A9-%D8%A7%D9%84%D8%AD%D8%AF%D9%8A%D8%AB%D9%8A%D8%A9-API
- https://github.com/fawazahmed0/quran-hadith-search
- Hadith API: https://github.com/fawazahmed0/hadith-api
- https://ummahapi.com/tafsir-api
- Important Ref: https://puremonotheism.com/
- https://www.openislam.org/root_words
- https://studyquran.org/resources/quran-concordance-pattern-wise.pdf
- https://www.greattafsirs.com/
- https://www.altafsir.com/
- https://tanzil.net/
- https://corpus.quran.com/
- https://islamiccontent.org/
- https://dev.islamiccontent.org/all-apis
- ...

**Arabic Dictionaries:**

- https://huggingface.co/datasets/mysamai/m3ajim/blob/main/roots.parquet?page=0
- https://huggingface.co/datasets/MohamedRashad/arabic-roots
- https://huggingface.co/datasets/islamlab/arabic-lexicons
- https://github.com/linuxscout/ayaspell
- https://github.com/wizsk/arabic_lexicons
- https://github.com/GibreelAbdullah/LaneLexicon
- https://github.com/OSINTAI/Arabic-Dictionaries
- https://arabiclexicon.hawramani.com
- ...

**Public Site:**

- https://www.quranroots.com/
- https://quranmorphology.com/
- https://puremonotheism.com/
- https://www.searchtruth.com/showWords.php?translator=1
- https://jadhr.app/
- ...

**Extras:**

- https://huggingface.co/models?other=quran
- https://huggingface.co/mysamai
- https://huggingface.co/datasets/mysamai/ashaar-tashkeel
- https://huggingface.co/datasets/islamlab/islamic-biographies
- https://huggingface.co/datasets/forzagreen/ar-conjugation
- https://huggingface.co/islamlab
- https://huggingface.co/search/full-text?q=%D9%82%D8%B1%D8%A7%D9%86
- ...

One of the things I'm looking for is not relying on online APIs rather than creating our own database and API. A huge and all-in-one API that includes all these sources and data.. I know this needs time but it's okay we have enough time to build this API step by step, and depends on what you see is better as long as we can access an open source databases (like the provided above) And can convert all of their data to our API. This will be the first option we will go for. However, if that wasn't possible or applicable, we can use available APIs and by time also. Convert their data to our API.

In the website, users would be able to click on a verse to read its tafsir, or click on a single word to view its meaning, and other verses contains words with the same root. Another feature would allow users, after clicking on a word, to enter a "node-based forkflow graph" like infinit canvas view. In this canvas, the selected word would appear along with its linguistic root, its derived forms, and its occurrences throughout the Quran, all visualized as an interactive diagram based on the available database with clear space between diagram elements, each word node is a card that show the word, its root, and the verse where its mentioned.

The claude design hand-off file already has the editor that will be used to create different types of graphs like the root based graph which is the default and the topic based graph and the meaning based graph where it may have different words but sharing the same meaning or close meanings.

Over time, this could allow users to build and explore a rich, interactive network of Quranic words, meanings, roots, and semantic relationships. The goal would be to help users develop a clearer understanding of the relationships between Quranic words, their meanings, their implications, and their usage within the Quranic context.

---

Phase 2:

Each word would have several layers of meaning: a lexical meaning, a semantic meaning, a contextual meaning, and maybe more in the future. One of the new ideas in this project is the concept of the contextual meaning of a word according to its Quranic context. This context would not be determined only by the single verse in which the word appears, but also by a group of surrounding verses that come before and after it, whenever those verses form one connected and coherent idea.

In most cases, this contextual range would be defined by a human (Admin), mainly because its not yet exist in an online resources (at least based on my research). Therefore, the admin/owner should have access to a dashboard where he can define, for each word, where its relevant context begins and ends. For example, they could specify the exact surah and verse where the contextual passage starts, and the exact verse where it ends.

also to build a full Semantic Search and Intelligence System for the Quran - a smart search engine for the Quran, where Users and Scholars can Search the Quran by "roots", "meaning" in Arabic and English languages, Explore the Quran using state-of-art visualization techniques, ask questions in natural language, Analyze the text, acquire detailed statistics and find hidden patterns and relations.

I'm also looking to empower the quranic data with interactive visualization like charts, heatmaps in addition to the graphs and mindmaps.

when tap it select the tapped word, show its meanings and data (root, how many times it mentioned, related topics, words with similar meaning or close to or related (these similar words are defind by the admin/owner), words with opposite meaning (also defind by the admin/owner), its morphological balance, etc...), and it list all other word an verses from the same root with allowness to interact with them and redirect to them.

---

#### Note:

It's a big **NO** to rely only on my researches and my provided data. It's definitely describe or explain the idea and clarify the vision. However, without your extra mile to validate and enhance and improve and find the gaps, this will not reach the best result. and it's obvious that if you did not find somthing better then you should use from the provided search results.

Main/default Language: Arabic.
Frontend: I suggest react, whats is your suggestion?
Backend: I suggest python, whats is your suggestion?
