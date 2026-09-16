const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));

// Prefer the TV area, but never cover the cartridges the visitor is choosing.
// Shrink the preview if necessary; a crowded view keeps only the in-place lift.
export function cartridgePreview({width,height,anchor,occupied=[]}) {
  const margin=18,top=76,bottom=height-40;
  for(const size of [Math.min(230,width*.27),180,140]){
    if(size>width-margin*2||size>bottom-top)continue;
    const half=size/2;
    const candidates=[anchor,{x:width*.5,y:height*.62},{x:width*.5,y:height*.78},{x:width*.27,y:height*.68},{x:width*.73,y:height*.68}];
    for(const point of candidates){
      const x=clamp(point.x,margin+half,width-margin-half),y=clamp(point.y,top+half,bottom-half);
      const rect={left:x-half,top:y-half,right:x+half,bottom:y+half};
      if(occupied.every(box=>overlap(rect,{left:box.left-12,top:box.top-12,right:box.right+12,bottom:box.bottom+12})===0))return {...rect,x,y,size};
    }
  }
  return null;
}
