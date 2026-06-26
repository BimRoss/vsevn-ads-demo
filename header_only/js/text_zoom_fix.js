(function(){
  function getTextZoom(){
    var d=document.createElement('div');
    d.style.cssText='position:fixed;top:-9999px;left:-9999px;font-size:100vw;width:100vw;visibility:hidden;pointer-events:none';
    document.body.appendChild(d);
    var fs=parseFloat(getComputedStyle(d).fontSize);
    var w=d.getBoundingClientRect().width;
    document.body.removeChild(d);
    return w>0?fs/w:1;
  }
  var last=1;
  function fix(){
    var Z=getTextZoom();
    if(Math.abs(Z-last)<0.005)return;
    var prev=last;
    last=Z;
    if(Math.abs(Z-1)<0.02){
      document.documentElement.style.removeProperty('--fsm');
      console.log('[TZF] textZoom reset to 1 (was '+prev.toFixed(4)+'), --fsm removed');
    }else{
      var fsm=(1/Z).toFixed(6);
      document.documentElement.style.setProperty('--fsm',fsm);
      console.log('[TZF] textZoom changed '+prev.toFixed(4)+' → '+Z.toFixed(4)+', --fsm='+fsm);
    }
  }
  function init(){
    fix();
    window.addEventListener('resize',fix);
    // Instant detection on Ctrl+/Ctrl- keypress
    document.addEventListener('keydown',function(e){
      if((e.ctrlKey||e.metaKey)&&(e.key==='+'||e.key==='-'||e.key==='='||e.key==='0')){
        setTimeout(fix,50);
        setTimeout(fix,150);
      }
    });
    // Ctrl+scroll wheel
    document.addEventListener('wheel',function(e){
      if(e.ctrlKey){setTimeout(fix,50);setTimeout(fix,150);}
    },{passive:true});
    // Fallback poll
    setInterval(fix,2000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
  console.log('[TZF] text_zoom_fix loaded');
})();
