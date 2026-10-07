"use client";
import {useI18n} from "@/components/LocalizationProvider";
export default function LocalizedMapHeading(){
  const{t}=useI18n();
  return <div className="section-head"><div><h2>{t("home.liveMapTitle")}</h2><div className="muted">{t("home.liveMapBody")}</div></div></div>;
}
