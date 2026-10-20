import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import CitizenLessonGraphic from "../src/components/CitizenLessonGraphic";
import {citizenLessons} from "../src/lib/citizen-lessons";

describe("CARE-Map citizen teaching graphics",()=>{
 it("renders an accessible, self-contained SVG diagram for every curriculum lesson",()=>{
   const ids=new Set(citizenLessons.map(l=>l.id));
   expect(ids.size).toBe(citizenLessons.length);
   for(const lesson of citizenLessons){
     const html=renderToStaticMarkup(React.createElement(CitizenLessonGraphic,{
       kind:lesson.graphic,title:lesson.title
     }));
     expect(html).toContain("<svg");
     expect(html).toContain('viewBox="0 0 600 210"');
     expect(html).toContain('role="img"');
     expect(html).toContain("Illustration for learning only");
     expect(html).toContain(lesson.title.replace(/&/g,"&amp;"));
     expect(html).not.toContain("<img");
     expect(html).not.toContain("href=\"http");
   }
 });
});
