"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useState} from "react";
import {DEFAULT_LOCALE,englishCatalog,type TranslationKey} from "@/lib/i18n";

type Language={code:string;name:string;nativeName:string};
type ContextValue={
  locale:string;
  languages:Language[];
  loading:boolean;
  fallback:boolean;
  t:(key:TranslationKey)=>string;
  setLocale:(code:string)=>void;
};

const I18nContext=createContext<ContextValue>({
  locale:DEFAULT_LOCALE,languages:[{code:"en",name:"English",nativeName:"English"}],
  loading:false,fallback:false,t:key=>englishCatalog[key],setLocale:()=>{}
});

const STORAGE_KEY="caremap_locale";

export function LocalizationProvider({children}:{children:React.ReactNode}){
  const[locale,setLocaleState]=useState(DEFAULT_LOCALE);
  const[languages,setLanguages]=useState<Language[]>([{code:"en",name:"English",nativeName:"English"}]);
  const[catalog,setCatalog]=useState<Record<string,string>>(englishCatalog);
  const[loading,setLoading]=useState(false);
  const[fallback,setFallback]=useState(false);

  useEffect(()=>{
    fetch("/api/i18n/languages")
      .then(r=>r.json())
      .then(j=>{
        const list:Array<Language>=Array.isArray(j.data)?j.data:[];
        if(list.length)setLanguages(list);
        const stored=localStorage.getItem(STORAGE_KEY)||DEFAULT_LOCALE;
        const supported=list.some(x=>x.code===stored)?stored:DEFAULT_LOCALE;
        setLocaleState(supported);
      })
      .catch(()=>{});
  },[]);

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    fetch("/api/i18n/catalog?lang="+encodeURIComponent(locale))
      .then(r=>r.json())
      .then(j=>{
        if(cancelled)return;
        setCatalog(j.translations||englishCatalog);
        setFallback(Boolean(j.fallback));
        document.documentElement.lang=j.locale||DEFAULT_LOCALE;
      })
      .catch(()=>{
        if(cancelled)return;
        setCatalog(englishCatalog);
        setFallback(locale!==DEFAULT_LOCALE);
        document.documentElement.lang=DEFAULT_LOCALE;
      })
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[locale]);

  const setLocale=useCallback((code:string)=>{
    const supported=languages.some(x=>x.code===code)?code:DEFAULT_LOCALE;
    localStorage.setItem(STORAGE_KEY,supported);
    setLocaleState(supported);
  },[languages]);

  const value=useMemo<ContextValue>(()=>({
    locale,languages,loading,fallback,
    t:(key:TranslationKey)=>catalog[key]||englishCatalog[key],
    setLocale
  }),[locale,languages,loading,fallback,catalog,setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(){return useContext(I18nContext);}
