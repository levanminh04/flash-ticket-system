import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from "../../i18n";

const languageOptions: Record<
  SupportedLanguage,
  { label: string; shortLabel: string; flagClass: string }
> = {
  vi: {
    label: "Vietnamese",
    shortLabel: "VI",
    flagClass: "language-flag-vietnam",
  },
  en: {
    label: "English",
    shortLabel: "EN",
    flagClass: "language-flag-english",
  },
};

type LanguageSwitcherProps = {
  className?: string;
};

export default function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage === "en" ? "en" : "vi";
  const currentLanguageOption = languageOptions[currentLanguage];

  const handleLanguageChange = (language: SupportedLanguage) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    void i18n.changeLanguage(language);
  };

  return (
    <div className={`language-switcher ${className}`.trim()}>
      <button
        type="button"
        className="language-switcher-trigger"
        aria-label={t("common.language")}
        aria-haspopup="menu"
      >
        <span
          className={`language-switcher-flag ${currentLanguageOption.flagClass}`}
          aria-hidden="true"
        />
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div className="language-switcher-menu" role="menu" aria-label={t("common.language")}>
        {SUPPORTED_LANGUAGES.map((language) => (
          <button
            key={language}
            type="button"
            className={`language-switcher-option ${
              language === currentLanguage ? "is-active" : ""
            }`.trim()}
            onClick={() => handleLanguageChange(language)}
            role="menuitemradio"
            aria-checked={language === currentLanguage}
            aria-label={languageOptions[language].label}
          >
            <span
              className={`language-switcher-flag ${languageOptions[language].flagClass}`}
              aria-hidden="true"
            />
            <span className="language-switcher-code">{languageOptions[language].shortLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
