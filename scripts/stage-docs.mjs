import {cpSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const docsDir=join(root,'docs');
const siteDir=join(root,'site');
const publishedDocs=join(siteDir,'docs');

rmSync(publishedDocs,{recursive:true,force:true});
cpSync(docsDir,publishedDocs,{recursive:true});

const priority=new Map([
  ['processflow.md',0],
  ['GEBRUIKERSHULP.md',1],
  ['rekenvoorbeeld-signaalgevers.md',2],
  ['SYSTEEMWERKING.md',3],
  ['README.md',4]
]);

const docs=readdirSync(docsDir,{withFileTypes:true})
  .filter(entry=>entry.isFile()&&entry.name.toLowerCase().endsWith('.md'))
  .map(entry=>{
    const content=readFileSync(join(docsDir,entry.name),'utf8');
    const heading=content.match(/^#\s+(.+)$/m);
    return {
      path:`docs/${entry.name}`,
      title:heading?.[1]?.trim()||entry.name.replace(/\.md$/i,''),
      category:entry.name.startsWith('release-notes-')?'Release notes':'Documentatie',
      content
    };
  })
  .sort((a,b)=>{
    const aName=a.path.slice(5);
    const bName=b.path.slice(5);
    const pa=priority.has(aName)?priority.get(aName):100;
    const pb=priority.has(bName)?priority.get(bName):100;
    return pa-pb||a.title.localeCompare(b.title,'nl');
  });

const output=`// Automatisch gegenereerd uit /docs door scripts/stage-docs.mjs. Niet handmatig wijzigen.\nexport const HELP_DOCS=${JSON.stringify(docs,null,2)};\n`;
writeFileSync(join(siteDir,'help-docs.js'),output,'utf8');

console.log(`Help-documentatie gebundeld: ${docs.length} Markdown-bestanden en docs/afbeeldingen.`);
