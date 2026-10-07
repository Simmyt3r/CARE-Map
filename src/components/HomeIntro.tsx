"use client";
import Link from "next/link";
import {useI18n} from "@/components/LocalizationProvider";

export default function HomeIntro(){
  const{t}=useI18n();
  return <section className="hero">
    <div className="card hero-copy">
      <span className="badge">{t("home.badge")}</span>
      <h1>{t("home.title")}</h1>
      <p>{t("home.intro")}</p>
      <div className="actions">
        <Link className="btn primary" href="/report">{t("home.reportButton")}</Link>
        <Link className="btn" href="/login">{t("home.staffButton")}</Link>
      </div>
    </div>
    <div className="card">
      <h2>{t("home.howTitle")}</h2>
      <div className="stack">
        <div><strong>{t("home.captureTitle")}</strong><div className="muted">{t("home.captureBody")}</div></div>
        <div><strong>{t("home.mapTitle")}</strong><div className="muted">{t("home.mapBody")}</div></div>
        <div><strong>{t("home.respondTitle")}</strong><div className="muted">{t("home.respondBody")}</div></div>
      </div>
    </div>
  </section>;
}
