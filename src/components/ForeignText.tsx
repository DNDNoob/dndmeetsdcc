import React from "react";
import { Languages } from "lucide-react";
import { useLanguages } from "@/contexts/LanguagesContext";
import { DEFAULT_LANGUAGE_ID, languageName, readWrittenText } from "@/lib/languages";

interface ForeignTextProps {
  text: string;
  language?: string;
  className?: string;
  /** The viewer wrote it, so they can read it whatever the language */
  alwaysReadable?: boolean;
}

/** Text written in a language: scrambled for viewers who don't know it, with a small language tag. */
export const ForeignText: React.FC<ForeignTextProps> = ({ text, language, className, alwaysReadable }) => {
  const { isAdmin, readerCrawler, customLanguages } = useLanguages();
  const shown = readWrittenText(text, alwaysReadable ? undefined : language, { isAdmin, crawler: readerCrawler });
  const showTag = !!language && (language !== DEFAULT_LANGUAGE_ID || shown.scrambled);
  if (!showTag) return <span className={className}>{text}</span>;
  const name = languageName(language, customLanguages);
  return (
    <span className={className} data-testid={shown.scrambled ? "foreign-text-scrambled" : "foreign-text"}>
      <span
        className="inline-flex items-center gap-0.5 mr-1 px-1 rounded border border-accent/40 text-accent text-[10px] not-italic align-middle"
        title={shown.scrambled ? `Written in ${name}. You don't know it.` : `Written in ${name}`}
      >
        <Languages className="w-2.5 h-2.5" />{name}
      </span>
      <span className={shown.scrambled ? "break-all" : undefined}>{shown.text}</span>
    </span>
  );
};

export default ForeignText;
