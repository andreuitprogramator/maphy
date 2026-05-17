/** Renders legacy plain-text statements and TipTap HTML the same way on the public problem page. */
export function ProblemRichBody({ content }: { content: string }) {
  const trimmed = content.trim();
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(trimmed);

  if (!looksLikeHtml) {
    return <div className="whitespace-pre-wrap leading-relaxed text-zinc-800">{content}</div>;
  }

  return (
    <div
      className="problem-rich max-w-none leading-relaxed text-zinc-800 [&_p]:my-2 [&_p:first-child]:mt-0 [&_ul]:my-2 [&_ul]:ml-6 [&_ul]:list-disc [&_ol]:my-2 [&_ol]:ml-6 [&_ol]:list-decimal [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold"
      dangerouslySetInnerHTML={{ __html: trimmed }}
    />
  );
}
