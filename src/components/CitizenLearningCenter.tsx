"use client";
import {useMemo,useState} from "react";
import {
  citizenCategories,citizenLessons,categoryDescriptions,
  type CitizenCategory
} from "@/lib/citizen-lessons";
import CitizenLessonGraphic from "@/components/CitizenLessonGraphic";

/**
 * Open-access extension education. Quiz and progress are ephemeral React state.
 * No sign-in, tracking, local storage, score upload or fabricated certification.
 */
export default function CitizenLearningCenter(){
 const [category,setCategory]=useState<(typeof citizenCategories)[number]>("All topics");
 const [query,setQuery]=useState("");
 const [answers,setAnswers]=useState<Record<string,number>>({});
 const [completed,setCompleted]=useState<string[]>([]);
 const results=useMemo(()=>citizenLessons.filter(item=>{
   if(category!=="All topics"&&item.category!==category)return false;
   const term=query.trim().toLocaleLowerCase();
   return !term||[
     item.title,item.summary,item.why,item.category,item.level,item.remember,
     ...item.actions,...item.sections.flatMap(s=>[s.heading,s.body]),
     ...item.terms.flatMap(t=>[t.term,t.definition])
   ].some(x=>x.toLocaleLowerCase().includes(term));
 }),[category,query]);
 const completedSet=new Set(completed);
 const finished=completed.length;
 const completionPct=Math.round(100*finished/citizenLessons.length);
 function updateCategory(next:(typeof citizenCategories)[number]){
   setCategory(next);
 }
 function markComplete(id:string){
   setCompleted(prev=>prev.includes(id)?prev:[...prev,id]);
 }
 return <section className="stack citizen-academy" aria-labelledby="community-learning-title">
  <div className="citizen-learning-hero">
   <div className="citizen-learning-hero-copy">
    <span className="page-eyebrow">CARE-Map Learning Centre · Free citizen education</span>
    <h2 id="community-learning-title">Learn how to care for the land, water and your community</h2>
    <p>Choose a subject, explore illustrated explanations and check your understanding.
      Lessons are written in plain English and link to further reading from recognised institutions.</p>
    <div className="citizen-learning-highlights">
     <span><strong>{citizenLessons.length}</strong> illustrated lessons</span>
     <span><strong>{citizenCategories.length-1}</strong> learning categories</span>
     <span>No registration required</span>
    </div>
   </div>
   <div className="citizen-learning-progress" aria-label="Reading progress">
    <span className="page-eyebrow">Your progress this session</span>
    <strong>{finished} <small>/ {citizenLessons.length}</small></strong>
    <div className="citizen-learning-meter" role="progressbar"
      aria-label="Lessons marked complete" aria-valuenow={completionPct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{width:completionPct+"%"}}/>
    </div>
    <p>Complete a lesson’s knowledge check to mark it finished. Progress is not saved or transmitted.</p>
   </div>
  </div>
  <div className="citizen-category-area">
   <div className="citizen-learning-subhead">
    <h3>Explore by category</h3>
    <p>Start with the environmental issue that matters most to you.</p>
   </div>
   <div className="citizen-category-grid" role="group" aria-label="Citizen lesson categories">
    {citizenCategories.filter(item=>item!=="All topics").map(item=>{
      const count=citizenLessons.filter(l=>l.category===item).length;
      return <button key={item} type="button"
        aria-pressed={category===item} onClick={()=>updateCategory(item)}
        className={"citizen-category-option "+(category===item?"citizen-category-active":"")}>
        <span className="citizen-category-option-top">
         <strong>{item}</strong><span>{count} lesson{count===1?"":"s"}</span>
        </span>
        <small>{categoryDescriptions[item as CitizenCategory]}</small>
       </button>;
    })}
   </div>
  </div>
  <div className="citizen-learning-controls card">
   <div className="field">
    <label htmlFor="citizen-lesson-search">Find a lesson or a key term</label>
    <input id="citizen-lesson-search" type="search" value={query}
      onChange={e=>setQuery(e.target.value)}
      placeholder="Try erosion, rainfall, borehole, NDVI or flood safety"/>
   </div>
   <div className="citizen-learning-control-foot">
    <button type="button" className="btn" aria-pressed={category==="All topics"}
      onClick={()=>updateCategory("All topics")}>Show all {citizenLessons.length} lessons</button>
    {(query||category!=="All topics")&&<button className="btn" type="button"
      onClick={()=>{setQuery("");updateCategory("All topics");}}>Clear filters</button>}
    <span className="muted" role="status">{results.length} matching lesson{results.length===1?"":"s"}</span>
   </div>
  </div>
  <div className="citizen-lessons">
   {results.map((item,i)=>{
    const correct=answers[item.id]===item.correct;
    const done=completedSet.has(item.id);
    return <article id={"lesson-"+item.id} className="citizen-lesson card gis-section" key={item.id}>
     <div className="citizen-lesson-header">
      <span className="citizen-lesson-number" aria-hidden="true">{String(citizenLessons.indexOf(item)+1).padStart(2,"0")}</span>
      <div>
       <div className="citizen-lesson-tags">
        <span className="page-eyebrow">{item.category} · {item.minutes} min</span>
        <span className="citizen-lesson-level">{item.level}</span>
        {done&&<span className="citizen-lesson-done">Completed</span>}
       </div>
       <h3>{item.title}</h3>
       <p>{item.summary}</p>
      </div>
     </div>
     <CitizenLessonGraphic kind={item.graphic} title={item.title}/>
     <details className="citizen-lesson-details">
      <summary>Explore full lesson, field example and quiz</summary>
      <div className="stack citizen-lesson-expanded">
       <div className="citizen-lesson-reason">
        <h4>Why this matters</h4><p>{item.why}</p>
       </div>
       <div className="citizen-lesson-chapters">
        {item.sections.map((section,index)=><section key={section.heading} className="citizen-lesson-chapter">
         <div className="citizen-lesson-chapter-number">{index+1}</div>
         <div><h4>{section.heading}</h4><p>{section.body}</p></div>
        </section>)}
       </div>
       <div className="citizen-lesson-example">
        <span className="page-eyebrow">Illustrative community situation</span>
        <h4>{item.example.title}</h4>
        <p>{item.example.body}</p>
       </div>
       <div className="citizen-lesson-practice">
        <h4>Practical steps you can take</h4>
        <ol>{item.actions.map(a=><li key={a}>{a}</li>)}</ol>
       </div>
       <div className="citizen-lesson-caution">
        <h4>Safety and accuracy caution</h4><p>{item.avoid}</p>
       </div>
       <div className="citizen-remember"><strong>Remember</strong><p>{item.remember}</p></div>
       <div className="citizen-lesson-glossary">
        <h4>Key terms explained</h4>
        <dl>{item.terms.map(term=><div key={term.term}><dt>{term.term}</dt><dd>{term.definition}</dd></div>)}</dl>
       </div>
       <fieldset className="citizen-knowledge-check">
        <legend>Check your understanding: {item.question}</legend>
        {item.choices.map((option,choice)=><label key={choice} className="citizen-answer">
         <input name={"answer-"+item.id} type="radio" checked={answers[item.id]===choice}
           onChange={()=>setAnswers(prev=>({...prev,[item.id]:choice}))}/>
         <span>{option}</span>
        </label>)}
        {answers[item.id]!==undefined&&<p className={correct?"success":"notice"} role="status">
         {correct?"Correct. "+item.remember:"Not quite. Review the explanation above and choose another answer."}
        </p>}
        {correct&&<button type="button" className="btn primary" disabled={done}
         onClick={()=>markComplete(item.id)}>{done?"Lesson completed":"Mark this lesson as completed"}</button>}
       </fieldset>
       <div className="citizen-source">
        <strong>Read further from the source</strong>
        <a href={item.source.url} target="_blank" rel="noopener noreferrer">{item.source.name} ↗</a>
        {item.additionalSources?.map(source=><a key={source.url} href={source.url}
          target="_blank" rel="noopener noreferrer">{source.name} ↗</a>)}
       </div>
      </div>
     </details>
    </article>;
   })}
  </div>
  {!results.length&&<div className="card empty-state">
    <strong>No matching lessons</strong><p>Try a different search word or clear the category filter.</p>
    <button className="btn" type="button" onClick={()=>{setQuery("");setCategory("All topics");}}>View all lessons</button>
  </div>}
  <p className="muted citizen-learning-note">
   These are educational explanations, not official weather warnings, medical advice,
   engineering instructions, land-survey results or locally approved farm prescriptions.
   Contact the responsible ACReSAL/extension team for site-specific guidance.
   Diagrams are conceptual; no illustrated example is a verified intervention.
  </p>
 </section>;
}
