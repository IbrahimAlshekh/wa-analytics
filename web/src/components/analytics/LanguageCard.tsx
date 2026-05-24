import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AnalyticsReport } from "@/types/analytics";
import SectionHeader from "./SectionHeader";
import TokenPill from "./TokenPill";
import WordList from "./WordList";

export interface LanguageCardProps {
  language: AnalyticsReport["language"];
  contactName: string;
}

export default function LanguageCard({
  language,
  contactName,
}: LanguageCardProps) {
  const { t } = useTranslation();
  const topEmojisMe = language.topEmojisMe ?? [];
  const topEmojisThem = language.topEmojisThem ?? [];
  const topWordsMe = language.topWordsMe ?? [];
  const topWordsThem = language.topWordsThem ?? [];
  const topDomainsMe = language.topDomainsMe ?? [];
  const topDomainsThem = language.topDomainsThem ?? [];

  const hasEmojis = topEmojisMe.length > 0 || topEmojisThem.length > 0;
  const hasWords = topWordsMe.length > 0 || topWordsThem.length > 0;
  const hasDomains = topDomainsMe.length > 0 || topDomainsThem.length > 0;

  if (!hasEmojis && !hasWords && !hasDomains) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Language fingerprint"
          description={t("analytics.language.description")}
          info={t("analytics.language.tooltip")}
          icon={Languages}
        />
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-5">
        {hasEmojis && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              {t("analytics.language.topEmojis")}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-primary font-bold uppercase mb-2">
                  {t("analytics.you")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topEmojisMe.map((tc) => (
                    <TokenPill key={tc.token} {...tc} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-contact font-bold uppercase mb-2">
                  {contactName}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topEmojisThem.map((tc) => (
                    <TokenPill key={tc.token} {...tc} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {hasWords && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              {t("analytics.language.topWords")}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <WordList
                label={t("analytics.you")}
                tokens={topWordsMe}
                accent="text-primary"
              />
              <WordList
                label={contactName}
                tokens={topWordsThem}
                accent="text-contact"
              />
            </div>
          </div>
        )}

        {hasDomains && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              {t("analytics.language.topDomains")}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-primary font-bold uppercase mb-2">
                  {t("analytics.you")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topDomainsMe.map((tc) => (
                    <TokenPill key={tc.token} {...tc} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-contact font-bold uppercase mb-2">
                  {contactName}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topDomainsThem.map((tc) => (
                    <TokenPill key={tc.token} {...tc} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
