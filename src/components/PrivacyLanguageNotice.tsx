"use client";
import {useI18n} from "@/components/LocalizationProvider";

export default function PrivacyLanguageNotice(){
  const{locale,t}=useI18n();
  if(locale==="en")return null;
  return <div className="notice"><strong>{t("common.englishFallback")}:</strong> {t("privacy.englishOnly")}</div>;
}
