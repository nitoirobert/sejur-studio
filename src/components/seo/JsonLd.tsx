// Date structurate (schema.org, JSON-LD) pentru Google: le citește ca să înțeleagă pagina
// și să afișeze rezultate mai bogate. „<" e scăpat ca textul să nu poată închide tag-ul <script>.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
