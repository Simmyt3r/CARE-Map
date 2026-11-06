import type {Metadata} from "next";
import "./globals.css";
import AppNav from "@/components/AppNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import {LocalizationProvider} from "@/components/LocalizationProvider";
import {deploymentProfile} from "@/lib/deployment-profile";

export const metadata:Metadata={
  title:"CARE-Map | Climate Intelligence & Resilience",
  description:"Climate risk, environmental resources, satellite observations and community action mapped in one evidence-driven GIS platform. Coverage depends on approved regional data.",
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
