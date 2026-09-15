import { Fragment, type ReactNode } from "react";

/* Enough Markdown for a blog post, and nothing more.
 *
 * Headings, paragraphs, lists, block quotes, fenced code, rules, and inline
 * bold, italic, code, links and images. Rendered to React elements rather
 * than to HTML, so a post cannot carry a <script> whatever it says - the
 * posts are the author's own, but the renderer should not have to trust
 * them to be. A real Markdown library would be forty kilobytes for the same
 * dozen constructs.
 *
 * `link` decides what a link does, because inside Internet Explorer a link
 * to about:blog/x should navigate the window and a link to GitHub should
 * open a real tab.
 */

type LinkRenderer = (href: string, children: ReactNode) => ReactNode;

function inline(text: string, link: LinkRenderer, keyBase = 0): ReactNode[] {
  const out: ReactNode[] = [];
  /* One pass over the alternatives, leftmost match first. Images before
   * links, since an image is a link with a bang in front of it. */
  const re = /(!\[([^\]]*)\]\(([^)\s]+)\))|(\[([^\]]+)\]\(([^)\s]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = keyBase;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<img key={k++} src={m[3]} alt={m[2]} style={{ maxWidth: "100%" }} />);
    else if (m[4]) out.push(<Fragment key={k++}>{link(m[6], inline(m[5], link, k * 100))}</Fragment>);
    else if (m[7]) out.push(<code key={k++}>{m[8]}</code>);
    else if (m[9]) out.push(<b key={k++}>{inline(m[10], link, k * 100)}</b>);
    else if (m[11]) out.push(<i key={k++}>{inline(m[12], link, k * 100)}</i>);
    else if (m[13]) out.push(<i key={k++}>{inline(m[14], link, k * 100)}</i>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, link }: { source: string; link: LinkRenderer }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i += 1;
      blocks.push(
        <pre key={key++}>
          <code>{code.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = inline(heading[2], link);
      blocks.push(level === 1 ? <h1 key={key++}>{content}</h1> : level === 2 ? <h2 key={key++}>{content}</h2> : <h3 key={key++}>{content}</h3>);
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} />);
      i += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*[-*]\s+/, ""), link)}</li>);
        i += 1;
      }
      blocks.push(<ul key={key++}>{items}</ul>);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*\d+\.\s+/, ""), link)}</li>);
        i += 1;
      }
      blocks.push(<ol key={key++}>{items}</ol>);
      continue;
    }

    if (line.startsWith(">")) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quoted.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key++}>{inline(quoted.join(" "), link)}</blockquote>);
      continue;
    }

    /* A paragraph runs to the next blank line or the next block. */
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3})\s/.test(lines[i]) &&
      !lines[i].startsWith("```") &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !lines[i].startsWith(">")
    ) {
      para.push(lines[i++]);
    }
    blocks.push(<p key={key++}>{inline(para.join(" "), link)}</p>);
  }

  return <>{blocks}</>;
}
