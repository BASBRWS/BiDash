/* Eén plek voor het versienummer van de schil.

   Het stond eerder als letterlijke tekst in `dvm-source-manager.js` en nog een
   keer, verouderd, in `index.html`. De balk toonde daardoor pas een versie nadat
   de DVM-module was geladen, en de zijbalk toonde intussen een ander nummer.
   De schil hoort haar eigen versie te kennen en die meteen te tonen; de modules
   melden alleen hun eigen versie aan. */

export const BIDASH_VERSIE='2.12';

/* Alleen DVM houdt een eigen engineversie bij. BI en planning melden niets, en
   dan hoort er ook niets over hen in de balk te staan. */
export const ENGINE_LABELS={dvm:'DVM',bi:'BI',planning:'Planning'};

export function versieTekst(engines={}){
  const delen=['BiDash '+BIDASH_VERSIE];
  for(const [id,versie] of Object.entries(engines)){
    const v=String(versie??'').trim();
    if(v)delen.push((ENGINE_LABELS[id]||id)+' '+v);
  }
  return delen.join(' · ');
}

export function versieTitel(engines={}){
  const gemeld=Object.keys(engines).filter(id=>String(engines[id]??'').trim());
  return gemeld.length
    ? 'Versie van de schil en de geladen modules'
    : 'Versie van de schil; modules melden hun versie zodra ze geladen zijn';
}

/* Schrijft de versies in de kopbalk en in de voet van de zijbalk. De badge wordt
   aangemaakt als hij nog niet in de opmaak staat, zodat de functie ook werkt in
   een document dat hem niet vooraf meelevert. */
export function toonVersies(doc,engines={}){
  if(!doc)return '';
  const tekst=versieTekst(engines);
  let badge=doc.getElementById('bidashVersionBadge');
  if(!badge){
    const acties=doc.querySelector('.head-actions');
    if(acties){
      badge=doc.createElement('span');badge.id='bidashVersionBadge';badge.className='source-badge';
      acties.prepend(badge);
    }
  }
  if(badge){badge.textContent=tekst;badge.title=versieTitel(engines);}
  const voet=doc.querySelector('.sidebar-foot .version');
  if(voet)voet.textContent='Integratie '+BIDASH_VERSIE;
  return tekst;
}
