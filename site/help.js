import {HELP_DOCS} from './help-docs.js';
import {renderMarkdown} from './core/markdown.js';

const nav=document.querySelector('#helpNav');
const article=document.querySelector('#helpContent');
const title=document.querySelector('#helpTitle');
const subtitle=document.querySelector('#helpSubtitle');
const source=document.querySelector('#helpSource');

const docs=Array.isArray(HELP_DOCS)?HELP_DOCS:[];
const byPath=new Map(docs.map(doc=>[doc.path,doc]));
const defaultPath=byPath.has('docs/processflow.md')?'docs/processflow.md':docs[0]?.path;

function requestedPath(){
  const value=new URLSearchParams(location.search).get('doc');
  return value&&byPath.has(value)?value:defaultPath;
}

function setActive(path){
  nav.querySelectorAll('button[data-doc]').forEach(button=>{
    const active=button.dataset.doc===path;
    button.classList.toggle('active',active);
    button.setAttribute('aria-current',active?'page':'false');
  });
}

function renderNavigation(){
  nav.replaceChildren();
  const groups=['Documentatie','Release notes'];
  for(const group of groups){
    const entries=docs.filter(doc=>doc.category===group);
    if(!entries.length)continue;
    const heading=document.createElement('div');
    heading.className='help-nav-label';
    heading.textContent=group;
    nav.append(heading);
    for(const doc of entries){
      const button=document.createElement('button');
      button.type='button';
      button.dataset.doc=doc.path;
      button.textContent=doc.title;
      button.addEventListener('click',()=>showDocument(doc.path,true));
      nav.append(button);
    }
  }
}

function showDocument(path,push=false){
  const doc=byPath.get(path)||byPath.get(defaultPath);
  if(!doc){
    title.textContent='Geen documentatie gevonden';
    subtitle.textContent='De documentatiebundel is leeg.';
    article.innerHTML='<p>Er zijn geen Markdown-bestanden beschikbaar in de Help-bundel.</p>';
    source.textContent='Geen bron';
    return;
  }

  title.textContent=doc.title;
  subtitle.textContent='Rechtstreeks weergegeven uit de Markdown-documentatie van BiDash.';
  source.textContent=doc.path;
  article.innerHTML=renderMarkdown(doc.content,{documentPath:doc.path});
  setActive(doc.path);

  const url=new URL(location.href);
  url.searchParams.set('doc',doc.path);
  if(push)history.pushState({doc:doc.path},'',url);
  else history.replaceState({doc:doc.path},'',url);

  article.querySelector('h1,h2')?.scrollIntoView({block:'start'});
}

article.addEventListener('click',event=>{
  const link=event.target.closest('a[data-help-doc="true"]');
  if(!link)return;
  const href=link.getAttribute('href')||'';
  const path=href.split('#')[0].split('?')[0];
  if(!byPath.has(path))return;
  event.preventDefault();
  showDocument(path,true);
});

window.addEventListener('popstate',()=>showDocument(requestedPath(),false));

renderNavigation();
showDocument(requestedPath(),false);
