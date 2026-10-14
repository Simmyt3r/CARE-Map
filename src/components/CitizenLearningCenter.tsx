"use client";
import {useMemo,useState} from "react";
import {citizenCategories,citizenLessons} from "@/lib/citizen-lessons";

/** Static, source-linked lessons; does not collect or upload learning responses. */
export default function CitizenLearningCenter(){
  const[category,setCategory]=useState<string>("All topics");
  const[query,setQuery]=useState("");
  const[answers,setAnswers]=useState<Record<string,number>>({});
  const results=useMemo(()=>citizenLessons.filter(item=>{
    if(category!=="All topics"&&item.category!==category)return false;
    const term=query.trim().toLowerCase();
    return !term||[item.title,item.summary,item.why,item.category,...item.actions]
      .some(value=>value.toLowerCase().includes(term));
  }),[category,query]);
  return <section className="stack citizen-academy" aria-labelledby="community-learning-title">
    <div className="section-head">
      <div>
        <span className="page-eyebrow">Community learning · Free and open</span>
        <h2 id="community-learning-title">Learn how to protect our land and projects</h2>
        <p className="muted">Short lessons in everyday English. Each one explains an issue, gives practical steps and links to its source.</p>
      </div>
      <span className="badge">{citizenLessons.length} lessons</span>
    </div>
    <div className="card citizen-learning-controls">
      <div className="field">
        <label htmlFor="citizen-lesson-search">Search lessons</label>
        <input id="citizen-lesson-search" type="search" value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="Try climate, erosion, trees, water or NDVI"/>
      </div>
      <div className="citizen-topic-tabs" aria-label="Filter citizen education lessons">
        {citizenCategories.map(item=><button key={item} type="button"
          aria-pressed={category===item} className="btn"
          onClick={()=>setCategory(item)}>{item}</button>)}
      </div>
    </div>
    <p className="muted" role="status">{results.length} lesson{results.length===1?"":"s"} available. Open a lesson to read and check your understanding.</p>
    <div className="citizen-lessons">
      {results.map((item,i)=><article className="card citizen-lesson" key={item.id}>
        <div className="citizen-lesson-header">
          <span className="citizen-lesson-number" aria-hidden="true">{String(i+1).padStart(2,"0")}</span>
          <div>
            <span className="page-eyebrow">{item.category} · {item.minutes} min · {item.level}</span>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
          </div>
        </div>
        <details className="citizen-lesson-details">
          <summary>Read lesson and practical steps</summary>
          <div className="stack">
            <div><strong>Why it matters</strong><p>{item.why}</p></div>
            <div><strong>What you can do</strong>
              <ol>{item.actions.map(action=><li key={action}>{action}</li>)}</ol>
            </div>
            <div className="citizen-remember"><strong>Remember</strong><p>{item.remember}</p></div>
            <fieldset className="citizen-knowledge-check">
              <legend>Quick knowledge check: {item.question}</legend>
              {item.choices.map((option,choice)=><label key={choice} className="citizen-answer">
                <input name={"answer-"+item.id} type="radio"
                  checked={answers[item.id]===choice}
                  onChange={()=>setAnswers(x=>({...x,[item.id]:choice}))}/>
                <span>{option}</span>
              </label>)}
              {answers[item.id]!==undefined&&<p className={answers[item.id]===item.correct?"success":"notice"} role="status">
                {answers[item.id]===item.correct
                  ?"Correct. "+item.remember
                  :"Not quite. Review the lesson and try another answer."}
              </p>}
            </fieldset>
            <p className="citizen-source">Based on <a href={item.source.url} target="_blank"
              rel="noopener noreferrer">{item.source.name} ↗</a></p>
          </div>
        </details>
      </article>)}
    </div>
    {!results.length&&<div className="card empty-state">
      <strong>No lessons match that search</strong>
      <p>Try a different word, or select All topics.</p>
      <button className="btn" type="button" onClick={()=>{setCategory("All topics");setQuery("");}}>Show all lessons</button>
    </div>}
    <p className="muted citizen-learning-note">Educational guidance only. It is not a live weather warning, engineering instruction or site-specific farming prescription. Contact your local extension officer for decisions affecting safety, construction or crops. Learning answers stay in this browser session and are not sent to the server.</p>
  </section>;
}
