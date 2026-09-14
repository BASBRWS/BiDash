const escapeHtml=value=>String(value??'')
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#39;');

const normalizePath=path=>{
  const parts=[];
  for(const part of String(path||'').split('/')){
    if(!part||part==='.')continue;
    if(part==='..')parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
};

export function resolveDocumentTarget(target,documentPath='docs/README.md'){
  const raw=String(target||'').trim();
  if(!raw)return '#';
  if(raw.startsWith('#'))return raw;
  if(/^(https?:|mailto:|tel:)/i.test(raw))return raw;
  if(/^(javascript:|vbscript:|data:)/i.test(raw))return '#';

  const match=raw.match(/^([^?#]*)([?#].*)?$/);
  const pathPart=match?.[1]||raw;
  const suffix=match?.[2]||'';
  if(pathPart.startsWith('../site/'))return normalizePath(pathPart.slice('../site/'.length))+suffix;

  const base=String(documentPath||'docs/README.md').split('/');
  base.pop();
  return normalizePath([...base,...pathPart.split('/')].join('/'))+suffix;
}

const inlineToken=/(`[^`\n]+`|!\[[^\]]*\]\([^\n)]+\)|\[[^\]]+\]\([^\n)]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;

export function renderInline(text,{documentPath='docs/README.md'}={}){
  const source=String(text??'');
  let output='';
  let last=0;
  for(const match of source.matchAll(inlineToken)){
    output+=escapeHtml(source.slice(last,match.index));
    const token=match[0];
    if(token.startsWith('`')){
      output+=`<code>${escapeHtml(token.slice(1,-1))}</code>`;
    }else if(token.startsWith('![')){
      const parsed=token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if(parsed){
        const src=resolveDocumentTarget(parsed[2],documentPath);
        output+=`<img src="${escapeHtml(src)}" alt="${escapeHtml(parsed[1])}" loading="lazy">`;
      }else output+=escapeHtml(token);
    }else if(token.startsWith('[')){
      const parsed=token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if(parsed){
        const href=resolveDocumentTarget(parsed[2],documentPath);
        const external=/^https?:/i.test(href);
        const md=/\.md(?:[?#].*)?$/i.test(href);
        output+=`<a href="${escapeHtml(href)}"${external?' target="_blank" rel="noopener noreferrer"':''}${md?' data-help-doc="true"':''}>${renderInline(parsed[1],{documentPath})}</a>`;
      }else output+=escapeHtml(token);
    }else if(token.startsWith('**')||token.startsWith('__')){
      output+=`<strong>${renderInline(token.slice(2,-2),{documentPath})}</strong>`;
    }else{
      output+=`<em>${renderInline(token.slice(1,-1),{documentPath})}</em>`;
    }
    last=(match.index||0)+token.length;
  }
  output+=escapeHtml(source.slice(last));
  return output;
}

const splitTableRow=line=>String(line).trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>cell.trim());
const isTableSeparator=line=>{
  const cells=splitTableRow(line);
  return cells.length>0&&cells.every(cell=>/^:?-{3,}:?$/.test(cell));
};
const isListLine=line=>/^\s*(?:[-+*]|\d+\.)\s+/.test(line);
const isSpecialLine=(lines,index)=>{
  const line=lines[index]||'';
  if(!line.trim())return true;
  if(/^#{1,6}\s+/.test(line))return true;
  if(/^```/.test(line.trim()))return true;
  if(/^\s*>\s?/.test(line))return true;
  if(/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line))return true;
  if(isListLine(line))return true;
  if(index+1<lines.length&&line.includes('|')&&isTableSeparator(lines[index+1]))return true;
  return false;
};

const headingId=text=>String(text||'')
  .toLowerCase()
  .replace(/`|\*|_/g,'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,'-')
  .replace(/^-+|-+$/g,'')||'onderdeel';

export function renderMarkdown(markdown,{documentPath='docs/README.md'}={}){
  const lines=String(markdown??'').replace(/\r\n?/g,'\n').split('\n');
  const html=[];
  let i=0;

  while(i<lines.length){
    const line=lines[i];
    if(!line.trim()){i++;continue;}

    const fence=line.trim().match(/^```\s*([^\s]*)/);
    if(fence){
      const language=fence[1]||'';
      const body=[];
      i++;
      while(i<lines.length&&!/^```\s*$/.test(lines[i].trim()))body.push(lines[i++]);
      if(i<lines.length)i++;
      html.push(`<pre><code${language?` class="language-${escapeHtml(language)}"`:''}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    const heading=line.match(/^(#{1,6})\s+(.+)$/);
    if(heading){
      const level=heading[1].length;
      const text=heading[2].trim();
      html.push(`<h${level} id="${escapeHtml(headingId(text))}">${renderInline(text,{documentPath})}</h${level}>`);
      i++;
      continue;
    }

    if(/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)){
      html.push('<hr>');
      i++;
      continue;
    }

    if(i+1<lines.length&&line.includes('|')&&isTableSeparator(lines[i+1])){
      const headers=splitTableRow(line);
      i+=2;
      const rows=[];
      while(i<lines.length&&lines[i].trim()&&lines[i].includes('|')&&!isSpecialLine(lines,i)){
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      html.push('<div class="markdown-table-scroll"><table><thead><tr>'+headers.map(cell=>`<th>${renderInline(cell,{documentPath})}</th>`).join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+headers.map((_,index)=>`<td>${renderInline(row[index]||'',{documentPath})}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>');
      continue;
    }

    if(isListLine(line)){
      const ordered=/^\s*\d+\.\s+/.test(line);
      const tag=ordered?'ol':'ul';
      const items=[];
      while(i<lines.length){
        const current=lines[i];
        const match=current.match(ordered?/^\s*\d+\.\s+(.+)$/:/^\s*[-+*]\s+(.+)$/);
        if(!match)break;
        items.push(`<li>${renderInline(match[1],{documentPath})}</li>`);
        i++;
      }
      html.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    if(/^\s*>\s?/.test(line)){
      const quote=[];
      while(i<lines.length&&/^\s*>\s?/.test(lines[i]))quote.push(lines[i++].replace(/^\s*>\s?/,''));
      html.push(`<blockquote>${renderMarkdown(quote.join('\n'),{documentPath})}</blockquote>`);
      continue;
    }

    const paragraph=[];
    while(i<lines.length&&!isSpecialLine(lines,i)){
      paragraph.push(lines[i].trim());
      i++;
    }
    if(paragraph.length)html.push(`<p>${renderInline(paragraph.join(' '),{documentPath})}</p>`);
    else i++;
  }

  return html.join('\n');
}
