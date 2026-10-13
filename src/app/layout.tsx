import type {Metadata} from "next";
import "./globals.css";
import AppNav from "@/components/AppNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import {LocalizationProvider} from "@/components/LocalizationProvider";

export const metadata:Metadata={
  title:"CARE-Map | Benue ACReSAL",
  description:"A community-first geospatial workspace for Benue State ACReSAL interventions.",
  manifest:"/manifest.webmanifest"
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>
    <LocalizationProvider>
      <ServiceWorkerRegister/>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <AppNav/>
      <main id="main-content"><div className="shell">{children}</div></main>
    </LocalizationProvider>
  </body></html>;
}
