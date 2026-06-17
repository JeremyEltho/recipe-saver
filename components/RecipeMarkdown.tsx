"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders recipe markdown with the notebook's hand-styled elements.
 * All visual styling lives in globals.css under the `.md` scope.
 */
export default function RecipeMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
