// PNG pHYs: 300 pixels/inch = 11811 pixels/metre. Canvas 기본 96dpi를 교체합니다.
export async function printPNG(blob) {
  const source=new Uint8Array(await blob.arrayBuffer()),parts=[source.slice(0,8)];
  const payload=new Uint8Array(9),v=new DataView(payload.buffer);v.setUint32(0,11811);v.setUint32(4,11811);payload[8]=1;
  const chunk=new Uint8Array(21),view=new DataView(chunk.buffer);view.setUint32(0,9);chunk.set([112,72,89,115],4);chunk.set(payload,8);
  let crc=0xffffffff;for(const b of chunk.slice(4,17)){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}view.setUint32(17,(crc^0xffffffff)>>>0);
  for(let pos=8;pos<source.length;){const length=new DataView(source.buffer,source.byteOffset+pos,4).getUint32(0),end=pos+12+length,type=String.fromCharCode(...source.slice(pos+4,pos+8));if(type!=='pHYs')parts.push(source.slice(pos,end));if(type==='IHDR')parts.push(chunk);pos=end;}
  return new Blob(parts,{type:'image/png'});
}
