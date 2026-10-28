export const radians = degrees => degrees * Math.PI / 180;
export const degrees = angle => angle * 180 / Math.PI;
export function localPoint(point, box, rotation = 0) {
  const dx=point.x-box.x,dy=point.y-box.y,c=Math.cos(radians(rotation)),s=Math.sin(radians(rotation));
  return {x:dx*c+dy*s,y:-dx*s+dy*c};
}
export function rotatedPoint(x,y,box,rotation=0) {
  const c=Math.cos(radians(rotation)),s=Math.sin(radians(rotation));
  return {x:box.x+x*c-y*s,y:box.y+x*s+y*c};
}
export function decorationHit(point,box,rotation=0,padding=0) {
  const local=localPoint(point,box,rotation);
  return Math.abs(local.x)<=box.w/2+padding&&Math.abs(local.y)<=box.h/2+padding;
}
export function rotationDelta(start,end) { return (end-start+540)%360-180; }
