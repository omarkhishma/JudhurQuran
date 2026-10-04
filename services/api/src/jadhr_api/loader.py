"""Load a built dataset release into the `content` schema — atomically.

    uv run python -m jadhr_api.loader data/build/2026.10.0 data/sources.yaml
    uv run python -m jadhr_api.loader --revalidate     # only expire the web cache (after an API deploy)

Everything happens in one transaction: truncate content tables, COPY every
JSONL file, record the dataset row. A failure leaves the previous release in
place. After loading, the displayed text is re-hashed from the database and
compared with the build report — the mushaf-integrity check.
"""

from __future__ import annotations

import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import psycopg
import yaml
from psycopg.types.json import Jsonb

from .settings import get_settings

# table → (file, columns, json columns)
TABLES: list[tuple[str, str, list[str], set[str]]] = [
    ("surahs", "surahs.jsonl", ["number", "name_ar", "name_translit", "name_en", "revelation_place",
                                "revelation_order", "verse_count", "rukus", "page_start", "page_end",
                                "juz_start", "word_count", "has_basmala", "lexical_profile"], {"lexical_profile"}),
    ("verses", "verses.jsonl", ["id", "surah", "ayah", "key", "page", "juz", "line_start", "line_end", "hizb_mark",
                                "hizb_quarter", "manzil", "ruku",
                                "sajda", "text_qpc", "number_text", "text_tanzil", "text_imlaei", "norm", "norm_uthmani",
                                "norm_plain", "word_count", "token_count", "sha256", "lexical_level", "lexical_profile"],
     {"lexical_profile"}),
    ("tokens", "tokens.jsonl", ["id", "verse_id", "position", "text", "word_from", "word_to"], set()),
    ("roots", "roots.jsonl", ["id", "key", "letters", "spaced", "translit", "occurrences", "verse_count",
                              "surah_count", "lemma_count", "gloss_en", "gist_ar", "gist_source"], {"gist_source"}),
    ("patterns", "patterns.jsonl", ["id", "slug", "ar", "ar_bare", "translit", "form_number", "pos_hint",
                                    "lemma_count", "occurrences", "function_ar", "function_en", "plain_ar",
                                    "plain_en"], set()),
    ("lemmas", "lemmas.jsonl", ["id", "key", "ar", "ar_bare", "norm", "norm_plain", "root_id", "pos", "verb_form",
                                "derivation", "occurrences", "verse_count", "gloss_en", "pattern", "pattern_method",
                                "slug", "translit", "pattern_id", "pos_ar", "pos_en"], set()),
    ("words", "words.jsonl", ["id", "verse_id", "surah", "ayah", "position", "location", "token_from", "token_to",
                              "text_uthmani", "text_imlaei", "norm", "norm_uthmani", "norm_plain", "root_id", "lemma_id", "pos",
                              "definite", "features", "segments", "translit", "gloss_en"], {"features", "segments"}),
    ("root_variants", "root_variants.jsonl", ["word_id", "source", "root_key"], set()),
    ("texts", "texts.jsonl", ["id", "slug", "uri", "kind", "title_ar", "title_en", "author_ar", "author_en", "meta_ar",
                              "meta_en", "era_year", "source_id", "sort_order", "chapter_count", "passage_count",
                              "token_count", "info"], {"info"}),
    ("chapters", "chapters.jsonl", ["id", "text_id", "ordinal", "uri", "title_ar", "title_en", "title_translit",
                                    "passage_count", "meta", "parent_id", "level"], {"meta"}),
    ("passages", "passages.jsonl", ["id", "text_id", "chapter_id", "ordinal", "ref", "uri", "verse_id", "ar_full",
                                    "norm", "token_count", "form_ids", "roots", "roots_low", "meta"], {"meta"}),
    # each written form of the texts beyond the Quran, read once (P11.4a)
    ("text_forms", "text_forms.jsonl", ["id", "norm", "kind", "confidence", "clitics", "readings"], {"readings"}),
    # narrator profiles from Ibn Ḥajar's Taqrīb (P11.2b)
    ("narrators", "narrators.jsonl", ["id", "source_id", "number", "kind", "text", "name", "name_norm", "verdict", "rank",
                                      "tabaqa", "tabaqa_rule", "death_text", "death_ah", "death_rule", "sigla"], set()),
    ("passage_tokens", "passage_tokens.jsonl", ["id", "passage_id", "ordinal", "uri", "surface", "surface_bare",
                                                "norm", "lemma_id", "root_id", "pattern_id", "pos", "confidence",
                                                "word_id"], set()),
    ("corpora", "corpora.jsonl", ["id", "text_id", "label_ar", "label_en", "year", "sort_order"], set()),
    ("glossary_terms", "glossary_terms.jsonl", ["key", "category", "category_ar", "category_en", "label_ar",
                                                "label_en", "body_ar", "body_en", "href", "jump_target",
                                                "sort_order"], set()),
    ("senses", "senses.jsonl", ["id", "lemma_id", "ordinal", "text_ar", "text_en", "sources", "status"], {"sources"}),
    ("works", "works.jsonl", ["id", "kind", "lang", "level", "title_ar", "title_en", "author_ar", "author_en",
                              "source_id", "version", "file_sha256", "sort_order", "default_for",
                              "strip_leading_number", "verse_coverage", "passage_count"], set()),
    ("work_passages", "work_passages.jsonl", ["id", "work_id", "verse_from", "verse_to", "text", "footnotes"], set()),
    ("lexicon_works", "lexicon_works.jsonl", ["id", "title_ar", "title_en", "author_ar", "author_en", "death_hijri",
                                              "death_ce", "lang", "edition_note", "source_url", "license",
                                              "attribution_ar", "attribution_en", "redistributable", "sort_order",
                                              "kind", "shamela_id"], set()),
    ("lexicon_entries", "lexicon_entries.jsonl", ["id", "work_id", "root_key", "headword", "match", "confidence",
                                                  "displayable", "body", "core_meaning", "page_ref", "source_ref",
                                                  "dict_roots", "dict_rule", "dict_candidates"], set()),
    # the dictionary's roots (P11.1): every root the lexica file an article under
    ("dict_roots", "dict_roots.jsonl", ["key", "display", "letters", "first", "quran_root", "lexica", "articles",
                                        "attested_as_written", "unsure", "filed_under"], set()),
    ("reciters", "reciters.jsonl", ["id", "name_ar", "name_en", "style", "folder", "audio_url", "is_default", "sort_order",
                                    "word_audio"], set()),
    ("recitation_timings", "recitation_timings.jsonl", ["reciter_id", "verse_id", "segments", "quality"],
     {"segments", "quality"}),
    ("gharib_glosses", "gharib_glosses.jsonl", ["id", "work_id", "surah", "ayah", "phrase", "gloss", "word_locations",
                                                "page_ref", "source_ref"], set()),
    # Quran knowledge layers (P3.9) and relation seeds (P8.4/P3.1), built by jadhr_pipeline.layers
    ("knowledge_sources", "knowledge_sources.jsonl", ["id", "kind", "use", "title_ar", "title_en", "version", "url",
                                                      "license", "license_ar", "license_url", "attribution_ar",
                                                      "attribution_en"], set()),
    ("surah_cards", "surah_cards.jsonl", ["surah", "name_ar", "place", "revelation_order", "verse_count", "tc_place",
                                          "tc_place_ar", "tc_revelation_order", "tc_surah_class", "tc_opening_type",
                                          "place_agrees", "order_agrees", "names", "names_notes", "revelation",
                                          "revelation_notes", "virtues", "virtues_notes", "count_text_a",
                                          "count_text_a_notes", "count_text_b", "count_text_b_notes", "aims",
                                          "aims_notes", "truncated_fields", "verse_counts_a", "verse_counts_b",
                                          "verse_counts_status", "verse_counts_differences", "verse_counts_checks",
                                          "source_ids", "tc_study_preferred_period"],
     {"names_notes", "revelation_notes", "virtues_notes", "count_text_a_notes", "count_text_b_notes", "aims_notes",
      "verse_counts_a", "verse_counts_b", "verse_counts_differences", "verse_counts_checks"}),
    ("verse_places", "verse_places.jsonl", ["id", "verse_from", "verse_to", "surah", "ayah_from", "ayah_to", "place",
                                            "period", "role", "attributed_to", "quote", "context", "method", "scope",
                                            "source_id", "tc_check"], set()),
    ("asbab", "asbab.jsonl", ["id", "work", "source_id", "surah", "ayah_from", "ayah_to", "verse_from", "verse_to",
                              "number", "heading", "text", "takhrij", "notes", "locator", "match_method", "confidence",
                              "page", "section_kind"], {"notes"}),
    ("verse_crossrefs", "verse_crossrefs.jsonl", ["id", "work_id", "passage_id", "from_verse", "to_verse",
                                                  "to_verse_end", "method", "confidence", "quote", "reference",
                                                  "quote_check", "resolution", "mentions", "quote_found_at",
                                                  "source_id"], set()),
    ("entity_candidates", "entity_candidates.jsonl", ["id", "lemma_id", "lemma_key", "name_ar", "name_plain",
                                                      "occurrences", "verse_count", "verses", "wikidata_id",
                                                      "wikidata_label_ar", "wikidata_label_en", "wikidata_description",
                                                      "wikidata_rule", "wikidata_evidence", "wikidata_suggestions",
                                                      "status", "source_ids"], {"wikidata_suggestions"}),
    ("loanword_sources", "loanword_sources.jsonl", ["id", "sort_order", "title_ar", "title_en", "author_ar", "author_en", "death_hijri", "death_ce", "edition_ar", "edition_en", "scope_ar", "scope_en", "openiti_uri", "page_uri", "openiti_release", "openiti_commit", "source_url", "file_sha256", "cross_check", "licence", "licence_url", "licence_clause", "corpus_citation", "redistributable", "attribution_ar", "attribution_en", "use"], {"cross_check"}),
    ("loanword_passages", "loanword_passages.jsonl", ["id", "source_id", "ordinal", "section", "kind", "view_id", "view_stated_as_ar", "view_held_by_ar", "speakers", "introduced_by_ar", "text_ar", "offsets", "locator", "page", "pages", "milestone", "copy_of_entry_id", "copy_heading_ar", "copy_headword_ar", "set_aside_block", "languages", "notes", "status"], {"languages", "notes", "offsets", "pages", "speakers", "view_held_by_ar"}),
    ("loanword_entries", "loanword_entries.jsonl", ["id", "source_id", "seq", "chapter_ar", "chapter_seq", "heading_ar", "headword_ar", "headword_reads_ar", "heading_style", "heading_registered", "text_ar", "segments", "locator", "page", "pages", "milestone", "languages", "language_keys", "said_non_arabic", "link_status", "lemma_ids", "link_methods", "quran_verses", "parts", "candidates", "unlinked_reason", "set_aside_copy_ids", "notes", "status"], {"candidates", "language_keys", "languages", "lemma_ids", "link_methods", "notes", "pages", "parts", "quran_verses", "segments", "set_aside_copy_ids"}),
    ("loanword_links", "loanword_links.jsonl", ["id", "entry_id", "source_id", "headword_ar", "part_ar", "kind", "lemma_id", "lemma_key", "lemma_ar", "lemma_pos", "method", "level", "confidence", "scope", "locations", "verse_keys", "evidence", "excluded", "status"], {"evidence", "excluded", "locations", "verse_keys"}),
    # P5.2 curated sets; their items refer to lemmas, so they load after them
    ("collections", "collections.jsonl", ["id", "ordinal", "colour", "title_ar", "title_en", "intro_ar", "intro_en",
                                          "why_ar", "why_en", "rule", "item_count", "root_count", "occurrences",
                                          "coverage", "quote", "source"], {"rule", "quote", "source"}),
    ("collection_items", "collection_items.jsonl", ["collection_id", "ordinal", "lemma_id", "first_location"], set()),
    ("topic_sources", "topic_sources.jsonl", ["id", "title_ar", "title_en", "publisher_ar", "publisher_en", "language",
                                              "method", "version", "generated_at", "url", "licence", "licence_url",
                                              "shown", "attribution_ar", "attribution_en", "file_sha256"], set()),
    ("topics", "topics.jsonl", ["id", "source_id", "source_ref", "name_ar", "name_en", "name_fr", "description",
                                "parent_id", "level", "verse_count", "name_norm"], set()),
    ("topic_links", "topic_links.jsonl", ["id", "topic_id", "verse_key", "source_id", "version"], set()),
    ("mushaf_signs", "mushaf_signs.jsonl", ["id", "sort_order", "kind", "codepoints", "chars", "label_ar", "text_ar",
                                            "example_key", "example_token", "page", "occurrences", "source_id"],
     {"codepoints"}),
    ("relation_sources", "relation_sources.jsonl", ["id", "kind", "sort_order", "title_ar", "title_en", "author_ar",
                                                    "author_en", "death_hijri", "death_ce", "edition_ar", "edition_en",
                                                    "openiti_uri", "openiti_release", "openiti_commit", "source_url",
                                                    "file_sha256", "licence", "licence_url", "licence_clause",
                                                    "redistributable", "attribution_ar", "attribution_en",
                                                    "shown_extracted"], set()),
    ("relation_entries", "relation_entries.jsonl", ["id", "source_id", "seq", "printed_number", "heading_ar",
                                                    "headword_ar", "terms_ar", "letters_ar", "root_key", "lemma_key",
                                                    "match_method", "match_confidence", "unmapped_reason",
                                                    "match_candidates", "stated_count", "stated_count_ar",
                                                    "sense_count", "intro_ar", "section_ar", "locator", "page_vol",
                                                    "page", "milestone", "notes", "status"],
     {"terms_ar", "match_candidates", "notes"}),
    ("relation_candidates", "relation_candidates.jsonl", ["id", "type", "source_id", "entry_id", "locator",
                                                          "page_vol", "page", "milestone", "headword_ar", "target_ar",
                                                          "terms_ar", "root_key", "lemma_key", "match_method",
                                                          "match_confidence", "unmapped_reason", "match_candidates",
                                                          "target_root_key", "target_lemma_key", "target_match_method",
                                                          "target_match_confidence", "target_unmapped_reason",
                                                          "target_match_candidates", "sense_index", "sense_marker_ar",
                                                          "sense_list", "sense_label_ar", "text_ar", "verses",
                                                          "derived_from", "derivation", "status"],
     {"terms_ar", "match_candidates", "target_match_candidates", "verses"}),
    # Meanings (P3.1), built by jadhr_pipeline.meanings through the layers step
    ("gharib_works", "gharib_works.jsonl", ["id", "sort_order", "lang", "title_ar", "title_en", "publisher_ar",
                                            "publisher_en", "version", "source_url", "download_url", "licence",
                                            "licence_clause", "licence_url", "redistributable", "display_only",
                                            "attribution_ar", "attribution_en", "prepared_by_note", "file",
                                            "file_sha256"], set()),
    ("gharib_meanings", "gharib_meanings.jsonl", ["id", "work_id", "seq", "surah", "ayah", "ayah_label", "verse_keys",
                                                  "word_locations", "phrase_ar", "meaning_ar", "locator", "paragraph",
                                                  "line", "mushaf_page", "match_method", "match_confidence",
                                                  "occurrences_in_verse", "rekeyed_from", "notes", "status"], set()),
    ("mufradat_subentries", "mufradat_subentries.jsonl", ["id", "entry_id", "work_id", "article_headword_ar",
                                                          "article_root_key", "seq", "start_offset", "end_offset",
                                                          "text_ar", "cut_rule", "headword_ar", "headword_start",
                                                          "headword_end", "headwords", "lemma_keys", "lemma_key",
                                                          "match_method", "match_confidence", "unmapped_reason",
                                                          "verses", "page_ref", "page_method", "source_ref",
                                                          "article_sha256", "status"], {"headwords"}),
    ("mufradat_senses", "mufradat_senses.jsonl", ["id", "subentry_id", "entry_id", "work_id", "list_no", "list_kind",
                                                  "sense_index", "marker_ar", "marker_start", "marker_end",
                                                  "announcement_ar", "announcement_start", "announcement_end",
                                                  "stated_count", "found_count", "start_offset", "end_offset",
                                                  "text_ar", "end_rule", "verses", "page_ref", "status"], set()),
    ("mufradat_citations", "mufradat_citations.jsonl", ["id", "entry_id", "subentry_id", "work_id", "quote_ar",
                                                        "start_offset", "end_offset", "marked_by", "reference_ar",
                                                        "reference_start", "reference_end", "reference_surah",
                                                        "reference_ayahs", "verse_keys", "status", "method", "score",
                                                        "exact", "candidates", "ref_mismatch"], {"candidates"}),
    # Particle entries (P3.8), built by jadhr_pipeline.particles through the layers step
    ("particle_sources", "particle_sources.jsonl", ["id", "sort_order", "title_ar", "title_en", "author_ar",
                                                    "author_en", "death_hijri", "death_ce", "edition_ar",
                                                    "edition_en", "scope_ar", "scope_en", "openiti_uri", "page_uri",
                                                    "openiti_release", "openiti_commit", "source_url", "file_sha256",
                                                    "page_source_sha256", "licence", "licence_url", "licence_clause",
                                                    "redistributable", "attribution_ar", "attribution_en", "use"],
     set()),
    ("particle_entries", "particle_entries.jsonl", ["id", "source_id", "seq", "section_ar", "chapter_letters",
                                                    "heading_ar", "headword_ar", "headword_supplied",
                                                    "headword_evidence_ar", "descriptor_ar", "listed_as_ar",
                                                    "mapped_forms_ar", "lemma_ids", "lemma_keys", "lemma_slugs",
                                                    "affix_tags", "corpus_pos", "corpus_links",
                                                    "homograph_lemma_keys", "match_method", "match_confidence",
                                                    "match_constraints", "match_excluded", "unmapped_reason",
                                                    "stated_count", "stated_count_ar", "sense_count",
                                                    "first_list_count", "lists", "locator", "page_vol", "page",
                                                    "milestone", "notes", "status"],
     {"listed_as_ar", "mapped_forms_ar", "corpus_pos", "corpus_links", "homograph_lemma_keys", "match_constraints",
      "match_excluded", "lists", "notes"}),
    ("particle_senses", "particle_senses.jsonl", ["id", "entry_id", "source_id", "ordinal", "kind", "list_no",
                                                  "list_depth", "parent_id", "sense_index", "marker_ar",
                                                  "marker_noun_ar", "label_ar", "text_ar", "verses", "locator",
                                                  "page_vol", "page", "milestone", "notes", "status"],
     {"verses", "notes"}),
    ("particle_citations", "particle_citations.jsonl", ["id", "sense_id", "ordinal", "kind", "marked_by", "quote",
                                                        "start_offset", "end_offset", "surah", "surah_hint",
                                                        "verse_keys", "candidates", "status", "method", "score",
                                                        "exact", "hint_mismatch"], {"verse_keys", "candidates"}),
    # Pattern catalog (P3.3), built by jadhr_pipeline.patterns_catalog through the layers step
    ("pattern_sources", "pattern_sources.jsonl", ["id", "role", "comments_on", "sort_order", "title_ar", "title_en",
                                                  "author_ar", "author_en", "death_hijri", "death_ce", "edition_ar",
                                                  "edition_en", "openiti_uri", "openiti_release", "openiti_commit",
                                                  "source_url", "file_sha256", "page_numbering", "licence",
                                                  "licence_url", "licence_clause", "redistributable",
                                                  "attribution_ar", "attribution_en"], set()),
    ("pattern_functions", "pattern_functions.jsonl", ["id", "source_id", "seq", "section", "heading_ar", "kind",
                                                      "statement_index", "sense_index", "pattern_ar",
                                                      "pattern_slugs", "inflected_slugs", "suffix_slugs",
                                                      "form_number", "match_method", "match_confidence",
                                                      "match_candidates", "unmapped_reason", "text_ar",
                                                      "examples_ar", "mentions", "comments_on", "cue_ar", "locator",
                                                      "page_vol", "page", "milestone", "notes", "status"],
     {"mentions"}),
    ("relation_citations", "relation_citations.jsonl", ["id", "candidate_id", "ordinal", "kind", "marked_by",
                                                        "quote", "start", "end", "surah", "surah_hint", "verse_keys",
                                                        "status", "method", "score", "exact", "candidates",
                                                        "hint_mismatch"], {"verse_keys", "candidates"}),
]  # fmt: skip

TRUNCATE_ORDER = [
    "topic_links",
    "topics",
    "topic_sources",
    "collection_items",
    "collections",
    "particle_citations",
    "particle_senses",
    "particle_entries",
    "particle_sources",
    "mufradat_citations",
    "mufradat_senses",
    "mufradat_subentries",
    "gharib_meanings",
    "gharib_works",
    "pattern_functions",
    "pattern_sources",
    "relation_citations",
    "relation_candidates",
    "relation_entries",
    "relation_sources",
    "loanword_links",
    "loanword_entries",
    "loanword_passages",
    "loanword_sources",
    "mushaf_signs",
    "entity_candidates",
    "verse_crossrefs",
    "asbab",
    "verse_places",
    "surah_cards",
    "knowledge_sources",
    "senses",
    "glossary_terms",
    "corpora",
    "narrators",
    "text_forms",
    "passage_tokens",
    "passages",
    "chapters",
    "texts",
    "recitation_timings",
    "reciters",
    "gharib_glosses",
    "dict_roots",
    "lexicon_entries",
    "lexicon_works",
    "work_passages",
    "works",
    "root_variants",
    "words",
    "lemmas",
    "patterns",
    "roots",
    "tokens",
    "verses",
    "surahs",
    "sources",
    "dataset",
]


def _rows(
    path: Path, columns: list[str], json_cols: set[str], rename: dict[str, str]
) -> Iterator[tuple[Any, ...]]:
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            obj = json.loads(line)
            for src, dst in rename.items():
                if src in obj:
                    obj[dst] = obj.pop(src)
            yield tuple(Jsonb(obj.get(c)) if c in json_cols else obj.get(c) for c in columns)


# Build fields stored under another name: `end` is reserved in SQL, `root` names a table elsewhere.
_OFFSETS = {"start": "start_offset", "end": "end_offset"}
RENAMES: dict[str, dict[str, str]] = {
    "root_variants": {"root": "root_key"},
    "mufradat_subentries": _OFFSETS,
    "mufradat_senses": _OFFSETS,
    "mufradat_citations": _OFFSETS,
    "particle_citations": _OFFSETS,
}

# Every loaded table must be emptied first, or a reload would duplicate rows.
_missing = {t for t, *_ in TABLES} - set(TRUNCATE_ORDER)
if _missing:
    raise RuntimeError(f"tables loaded but never truncated: {sorted(_missing)}")


def load(build_dir: Path, sources_file: Path, dsn: str | None = None) -> dict[str, int]:
    report = json.loads((build_dir / "report.json").read_text(encoding="utf-8"))
    sources = yaml.safe_load(sources_file.read_text(encoding="utf-8"))["sources"]
    dsn = dsn or get_settings().database_url.replace("postgresql+psycopg://", "postgresql://")
    counts: dict[str, int] = {}
    with psycopg.connect(dsn) as conn, conn.transaction():
        cur = conn.cursor()
        cur.execute("truncate " + ", ".join(f"content.{t}" for t in TRUNCATE_ORDER))
        for src in sources:
            cur.execute(
                """insert into content.sources (id, kind, title_ar, title_en, version, url, license, license_url,
                   attribution_ar, attribution_en, role, files, role_ar, license_ar)
                   values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    src["id"],
                    src["kind"],
                    src["title_ar"],
                    src["title_en"],
                    src.get("version"),
                    src["url"],
                    src["license"],
                    src.get("license_url"),
                    src["attribution_ar"],
                    src["attribution_en"],
                    src["role"],
                    Jsonb(src.get("files", [])),
                    src.get("role_ar", ""),
                    src.get("license_ar", ""),
                ),
            )
        counts["sources"] = len(sources)
        for table, file, columns, json_cols in TABLES:
            path = build_dir / file
            if not path.exists():
                counts[table] = 0
                continue
            rename = RENAMES.get(table, {})
            n = 0
            cols = ", ".join(f'"{c}"' for c in columns)
            with cur.copy(f"copy content.{table} ({cols}) from stdin") as copy:
                for row in _rows(path, columns, json_cols, rename):
                    copy.write_row(row)
                    n += 1
            counts[table] = n
        cur.execute(
            "insert into content.dataset (version, text_sha256, counts, report) values (%s, %s, %s, %s)",
            (report["version"], report["text_sha256"], Jsonb(report["counts"]), Jsonb(report)),
        )
        # Mushaf integrity: the text as stored must hash exactly as built.
        cur.execute("select text_qpc from content.verses order by id")
        stored = hashlib.sha256("\n".join(r[0] for r in cur.fetchall()).encode()).hexdigest()
        if stored != report["text_sha256"]:
            raise RuntimeError(f"text hash mismatch after load: {stored} ≠ {report['text_sha256']}")
        # The Quran's passages point at the verified verses and never hold a copy of the text.
        cur.execute(
            """select count(*) from content.passages p join content.texts t on t.id = p.text_id
               where t.kind = 'quran' and (p.ar_full is not null or p.verse_id is null)"""
        )
        copies = cur.fetchone()
        if copies and copies[0]:
            raise RuntimeError(
                f"{copies[0]} Quran passages carry their own text instead of pointing at verses"
            )
        cur.execute("analyze")
    return counts


def rebuild_search_index() -> str:
    """A release changes content, so the derived search index is rebuilt from it (aliases flip atomically)."""
    from . import searchindex

    if not searchindex.available(searchindex.client()):
        return "skipped: OpenSearch is not reachable — search answers from Postgres until `python -m jadhr_api.searchindex reindex` runs"
    try:
        out = searchindex.reindex()
    except Exception as e:  # the release itself is loaded; say plainly that search is stale
        return f"failed: {e} — search still answers from the previous index"
    return "ok: " + ", ".join(f"{k} {v['documents']}" for k, v in out["indices"].items())


def revalidate_web() -> str:
    """Expire the web app's cached pages so the new release is served at once (not after a day)."""
    s = get_settings()
    if not s.web_revalidate_url:
        return "skipped: JADHR_WEB_REVALIDATE_URL is not set — cached pages keep the previous release until they expire"
    req = urllib.request.Request(s.web_revalidate_url, method="POST", data=b"")
    if s.revalidate_secret:
        req.add_header("Authorization", f"Bearer {s.revalidate_secret}")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return f"ok ({r.status})"
    except (urllib.error.URLError, TimeoutError) as e:
        return f"failed: {e} — run it again or the site serves the previous release until its cache expires"


def main() -> int:
    if sys.argv[1:] == ["--revalidate"]:
        # After an API code deploy (search or payload changes) cached pages must be expired too.
        web = revalidate_web()
        print(json.dumps({"web_revalidate": web}, ensure_ascii=False))
        return 0 if web.startswith("ok") else 3
    if len(sys.argv) != 3:
        print("usage: python -m jadhr_api.loader <build_dir> <sources.yaml> | --revalidate", file=sys.stderr)
        return 2
    t = time.time()
    counts = load(Path(sys.argv[1]), Path(sys.argv[2]))
    search = rebuild_search_index()
    web = revalidate_web()
    print(
        json.dumps(
            {
                "loaded": counts,
                "seconds": round(time.time() - t, 1),
                "search_index": search,
                "web_revalidate": web,
            },
            ensure_ascii=False,
        )
    )
    return 0 if not web.startswith("failed") else 3


if __name__ == "__main__":
    sys.exit(main())
