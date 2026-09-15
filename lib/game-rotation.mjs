// Rotate the existing browsing context: progress, audio and touch controls stay live.
// This also works when a browser cannot lock the device's screen orientation.
export function bindGameRotation(player,button,{viewport=window,Observer=ResizeObserver}={}) {
  let rotated=false;
  const label=button.querySelector('[data-rotation-label]');
  const fit=()=>{
    player.style.setProperty('--rotated-game-width',`${player.clientHeight}px`);
    player.style.setProperty('--rotated-game-height',`${player.clientWidth}px`);
  };
  const set=value=>{
    rotated=value;fit();player.classList.toggle('game-rotated',rotated);
    button.setAttribute('aria-pressed',String(rotated));
    const description=rotated?'还原游戏画面方向':'旋转游戏画面 90 度';
    button.setAttribute('aria-label',description);button.setAttribute('title',description);
    if(label)label.textContent=rotated?'还原':'旋转';
  };
  const reset=()=>set(false);
  const observer=new Observer(fit);observer.observe(player);
  viewport.addEventListener('orientationchange',reset);
  viewport.screen?.orientation?.addEventListener('change',reset);
  set(false);
  return {
    toggle:()=>set(!rotated),
    dispose(){observer.disconnect();viewport.removeEventListener('orientationchange',reset);viewport.screen?.orientation?.removeEventListener('change',reset);reset();}
  };
}
