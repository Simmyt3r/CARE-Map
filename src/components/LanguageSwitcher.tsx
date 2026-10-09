"use client";
import {useI18n} from "@/components/LocalizationProvider";

export default function LanguageSwitcher(){
  const{locale,languages,loading,setLocale,t}=useI18n();
  if(languages.length<=1)return null;
  return <label className="language-switcher">
    <span className="sr-only">{t("nav.language")}</span>
    <select aria-label={t("nav.language")} value={locale} disabled={loading} onChange={e=>setLocale(e.target.value)}>
      {languages.map(lang=><option key={lang.code} value={lang.code}>{lang.nativeName||lang.name}</option>)}
    </select>
  </label>;
}
