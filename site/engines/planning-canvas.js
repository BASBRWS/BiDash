/* Begrens het tekengeheugen tot de zichtbare planning, los van het aantal taken. */
function ipl_canvasViewport(canvas,width,height){
 const host=canvas.parentElement;
 if(!canvas._viewport){
  const spacer=document.createElement('div');spacer.setAttribute('aria-hidden','true');spacer.style.pointerEvents='none';host.insertBefore(spacer,canvas);
  canvas.style.position='absolute';
  const state={spacer,raf:0,width:0,height:0};canvas._viewport=state;
  const schedule=()=>{if(state.raf)return;state.raf=requestAnimationFrame(()=>{state.raf=0;if(host.clientWidth>0)renderIPL(true);});};
  host.addEventListener('scroll',schedule,{passive:true});
  state.observer=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(w!==state.width||h!==state.height){state.width=w;state.height=h;schedule();}});
  state.observer.observe(host);
 }
 const state=canvas._viewport,requestedX=host.scrollLeft,requestedY=host.scrollTop;
 // Oude absolute canvas-afmetingen mogen de scrollruimte na inklappen niet vasthouden.
 canvas.style.left='0px';canvas.style.top='0px';canvas.style.width='0px';canvas.style.height='0px';
 state.spacer.style.width=Math.ceil(width)+'px';state.spacer.style.height=Math.ceil(height)+'px';
 const w=Math.max(1,Math.min(width,host.clientWidth)),h=Math.max(1,Math.min(height,host.clientHeight));
 host.scrollLeft=Math.max(0,Math.min(requestedX,width-w));host.scrollTop=Math.max(0,Math.min(requestedY,height-h));
 const x=host.scrollLeft,y=host.scrollTop;
 // Ook bij hoge browserzoom blijft het fysieke tekenvlak begrensd.
 const dpr=Math.min(window.devicePixelRatio||1,2,4096/w,4096/h,Math.sqrt(4194304/(w*h)));
 canvas.width=Math.ceil(w*dpr);canvas.height=Math.ceil(h*dpr);
 canvas.style.width=w+'px';canvas.style.height=h+'px';canvas.style.left=x+'px';canvas.style.top=y+'px';
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Het tekenvlak van de planning is niet beschikbaar.');
 ctx.setTransform(dpr,0,0,dpr,-x*dpr,-y*dpr);
 return {ctx,x,y,w,h,dpr};
}
