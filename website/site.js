// Only the same-origin native example controls its display height.
const frame=document.querySelector('#matching-example');
function fitExample(){
  try{
    const doc=frame.contentDocument;
    if(!doc)return;
    const height=Math.ceil(doc.body.getBoundingClientRect().height);
    if(Number.isFinite(height)&&height>=320&&height<=4000)frame.style.height=height+'px';
  }catch{}
}
frame.addEventListener('load',()=>{
  try{
    const style=frame.contentDocument.createElement('style');
    style.textContent='.min-h-screen{min-height:0!important}';
    frame.contentDocument.head.append(style);
  }catch{}
  fitExample();
  try{new ResizeObserver(fitExample).observe(frame.contentDocument.body)}catch{}
});
window.addEventListener('resize',fitExample);
