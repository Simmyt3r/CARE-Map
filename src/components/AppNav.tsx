"use client";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {useI18n} from "@/components/LocalizationProvider";

export default function AppNav(){
  const{t}=useI18n();
  return <header className="topbar"><div className="shell topbar-inner">
    <Link className="brand" href="/">CARE-Map</Link>
    <nav className="nav">
      <Link href="/">{t("nav.publicMap")}</Link>
      <Link href="/report">{t("nav.reportIssue")}</Link>
      <Link href="/register">{t("nav.register")}</Link>
      <Link href="/privacy">{t("nav.privacy")}</Link>
      <Link href="/login">{t("nav.staffLogin")}</Link>
      <LanguageSwitcher/>
    </nav>
  </div></header>;
}
