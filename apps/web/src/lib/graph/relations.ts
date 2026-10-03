import type { GraphEdge, GraphKind, GraphNode, NodeKind, Rel } from "./types";

/**
 * What a map allows a link to say, by map type (P8.1a; D17, EDT-127, EDT-128, EDT-135, HWF-15, HWF-16). The design
 * allows only its lexical spine and links to and from a description, and its spec says "any pair may be linked";
 * D17 settles it: the spine everywhere, and root → root, verse → verse and the other relations of topic and meaning
 * maps through typed relations in the maps they belong to. A free map takes every relation, and a reading trail's
 * steps. A frame is a group, never an end of a link.
 */

type Rule = {
  rel: Rel;
  from: NodeKind[];
  to: NodeKind[];
  in: GraphKind[];
  /** a meaning relation holds both ways: A–B and B–A are one link */
  symmetric?: boolean;
  /** relations whose chains may not loop: the spine of the lexicon, and a topic's parts */
  chain?: "spine" | "topic";
};

const LEX: NodeKind[] = ["root", "pattern", "lemma"];
const CARDS: NodeKind[] = ["root", "pattern", "lemma", "verse", "note"];
const EVERY: GraphKind[] = ["root", "topic", "meaning", "free"];

export const RULES: Rule[] = [
  { rel: "derives", from: ["root"], to: ["pattern", "lemma"], in: EVERY, chain: "spine" },
  { rel: "realises", from: ["pattern"], to: ["lemma"], in: EVERY, chain: "spine" },
  { rel: "attests", from: LEX, to: ["verse"], in: EVERY, chain: "spine" },
  { rel: "cites", from: ["verse"], to: LEX, in: EVERY, chain: "spine" },
  { rel: "part-of-topic", from: CARDS, to: ["note"], in: ["topic", "free"], chain: "topic" },
  { rel: "describes", from: ["root", "pattern", "lemma", "verse"], to: ["note"], in: EVERY },
  { rel: "describes", from: ["note"], to: ["root", "pattern", "lemma", "verse"], in: EVERY },
  { rel: "refers-to", from: ["verse"], to: ["verse"], in: ["topic", "free"] },
  { rel: "near-in-meaning", from: ["lemma"], to: ["lemma"], in: ["meaning", "free"], symmetric: true },
  { rel: "near-in-meaning", from: ["root"], to: ["root"], in: ["meaning", "free"], symmetric: true },
  { rel: "opposite-of", from: ["lemma"], to: ["lemma"], in: ["meaning", "free"], symmetric: true },
  { rel: "opposite-of", from: ["root"], to: ["root"], in: ["meaning", "free"], symmetric: true },
  { rel: "wujuh-sense", from: ["lemma"], to: ["verse", "note"], in: ["meaning", "free"] },
  { rel: "didd", from: ["lemma"], to: ["verse", "note"], in: ["meaning", "free"] },
  { rel: "field-member", from: ["root", "lemma"], to: ["note"], in: ["meaning", "free"] },
  { rel: "next", from: CARDS, to: CARDS, in: ["free"] },
];

/** The relation a new link takes first in each map type, where a pair allows several. */
const PREFER: Record<GraphKind, Rel[]> = {
  root: [],
  topic: ["part-of-topic"],
  meaning: ["near-in-meaning", "field-member"],
  free: [],
};

const ruleOf = (rel: Rel, from: NodeKind, to: NodeKind) => RULES.find((r) => r.rel === rel && r.from.includes(from) && r.to.includes(to));

/** The relations a link from one kind of card to another may take in a map of this type, the first its default. */
export function allowedRels(type: GraphKind, from: NodeKind, to: NodeKind): Rel[] {
  const rels = [...new Set(RULES.filter((r) => r.in.includes(type) && r.from.includes(from) && r.to.includes(to)).map((r) => r.rel))];
  const rank = (r: Rel) => (r === "next" ? 99 : PREFER[type].includes(r) ? PREFER[type].indexOf(r) - 50 : 0);
  return rels.sort((a, b) => rank(a) - rank(b));
}

export const isSymmetric = (rel: Rel) => RULES.some((r) => r.rel === rel && r.symmetric);

export type Refusal = "same" | "dup" | "pair" | "loop";

/**
 * Whether a link may be made, and with which relation (EDT-127's order): the same card is ignored; a link the
 * same way — or either way, for a meaning relation — is "already linked"; a pair the map's type does not allow is
 * refused with its kinds named; a link that closes a loop in the lexicon's spine or a topic's parts is refused.
 * `except` is the link being changed, when its relation is.
 */
export function checkLink(
  type: GraphKind,
  nodes: GraphNode[],
  edges: GraphEdge[],
  source: string,
  target: string,
  rel?: Rel,
  except?: string,
): { rel: Rel } | { refused: Refusal } {
  if (source === target) return { refused: "same" };
  const a = nodes.find((n) => n.id === source)?.data.kind;
  const b = nodes.find((n) => n.id === target)?.data.kind;
  if (!a || !b) return { refused: "pair" };
  const others = edges.filter((e) => e.id !== except);
  const allowed = allowedRels(type, a, b);
  const chosen = rel ?? allowed[0];
  if (others.some((e) => e.source === source && e.target === target)) return { refused: "dup" };
  if (chosen && isSymmetric(chosen) && others.some((e) => e.source === target && e.target === source && e.data?.rel === chosen)) return { refused: "dup" };
  if (!chosen || !allowed.includes(chosen)) return { refused: "pair" };
  const chain = ruleOf(chosen, a, b)?.chain;
  if (chain) {
    // a loop: the new link's target already reaches its source along links of the same chain
    const kindOf = new Map(nodes.map((n) => [n.id, n.data.kind]));
    const next = new Map<string, string[]>();
    for (const e of others) {
      const ek = e.data?.rel;
      const from = kindOf.get(e.source);
      const to = kindOf.get(e.target);
      if (!ek || !from || !to || ruleOf(ek, from, to)?.chain !== chain) continue;
      next.set(e.source, [...(next.get(e.source) ?? []), e.target]);
    }
    const seen = new Set<string>();
    const stack = [target];
    while (stack.length) {
      const id = stack.pop()!;
      if (id === source) return { refused: "loop" };
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(next.get(id) ?? []));
    }
  }
  return { rel: chosen };
}

/** The relation a link between two kinds is read as when nothing says otherwise (a version-1 map's links). */
export function inferRel(type: GraphKind, from: NodeKind, to: NodeKind): Rel {
  return allowedRels(type, from, to)[0] ?? allowedRels("free", from, to).find((r) => r !== "next") ?? "next";
}

/** The design's metadata per kind (EDT-073): its name as a label and with the article, the grammatical gender of
 * that name in Arabic, what it holds, and a hint. Message keys in the "graph" copy. */
export const META: Record<NodeKind, { label: string; def: string; fem: boolean; child: string; hint: string }> = {
  root: { label: "kindRoot", def: "defRoot", fem: false, child: "childRoot", hint: "hintRoot" },
  pattern: { label: "kindPattern", def: "defPattern", fem: false, child: "childPattern", hint: "hintPattern" },
  lemma: { label: "kindLemma", def: "defLemma", fem: true, child: "childLemma", hint: "hintLemma" },
  verse: { label: "kindVerse", def: "defVerse", fem: true, child: "childVerse", hint: "hintVerse" },
  note: { label: "kindNote", def: "defNote", fem: true, child: "childNote", hint: "hintNote" },
  frame: { label: "kindFrame", def: "defFrame", fem: true, child: "childFrame", hint: "hintFrame" },
};

/** Relations a reader sees named on the canvas: the spine is read from the kinds it joins, so it is left unnamed. */
export const NAMED_ON_CANVAS: Rel[] = ["part-of-topic", "refers-to", "near-in-meaning", "opposite-of", "wujuh-sense", "didd", "field-member"];
