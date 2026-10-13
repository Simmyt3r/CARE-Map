"use client";
import Link from "next/link";
import {useI18n} from "@/components/LocalizationProvider";

export default function HomeIntro(){
  const {t}=useI18n();
  const steps=[
    {title:t("home.captureTitle"),body:t("home.captureBody")},
    {title:t("home.mapTitle"),body:t("home.mapBody")},
    {title:t("home.respondTitle"),body:t("home.respondBody")}
  ];
  return <section className="hero" aria-label="CARE-Map introduction">
    <div className="card hero-copy">
      <span className="badge">{t("home.badge")}</span>
      <h1>{t("home.title")}</h1>
      <p>{t("home.intro")}</p>
      <div className="actions">
        <Link className="btn primary" href="/report">{t("home.reportButton")}</Link>
        <a className="btn" href="#public-map">Explore public map</a>
      </div>
      <div className="gis-status-strip" style={{marginTop:22}}>
        <span><strong>Community-first</strong> · Report real problems</span>
        <span><strong>Location-backed</strong> · Explore mapped evidence</span>
      </div>
    </div>
    <div className="card hero-how">
      <span className="page-eyebrow">How CARE-Map works</span>
      <h2 style={{margin:0}}>{t("home.howTitle")}</h2>
      {steps.map((step,i)=><div className="hero-step" key={i}>
        <span className="hero-step-number" aria-hidden="true">{i+1}</span>
        <div><strong>{step.title}</strong><div className="muted">{step.body}</div></div>
      </div>)}
      <Link href="/extension" className="btn" style={{justifySelf:"start"}}>Community extension →</Link>
    </div>
  </section>;
}
