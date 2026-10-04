import { EmbedGone } from "@/components/graph/PublishedEmbed";

/** An address no map was ever published at, inside a frame: said there, not as the site's page (EDT-279). */
export default function EmbedNotFound() {
  return <EmbedGone by="none" />;
}
