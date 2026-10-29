// One-time asset generation, not a build dependency.
// Install Playwright locally and start npm run dev before running this script.
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PHOTO_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({...(process.env.PHOTO_CHROMIUM?{executablePath:process.env.PHOTO_CHROMIUM}:{}),args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:2560,height:800},deviceScaleFactor:1});
 await page.goto(process.env.PHOTO_PREVIEW_ORIGIN||'http://localhost:5173/');
 const metadata=await page.evaluate(async()=>{
  const {FONTS,loadFont}=await import('/fonts.js');
  // Generate using the actual browser renderer, including normal fallback glyphs.
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:transparent;display:grid;grid-template-columns:repeat(4,640px);width:2560px;';
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  for(let start=0;start<FONTS.length;start+=8)await Promise.all(FONTS.slice(start,start+8).map(f=>loadFont(f.id)));
  for(const font of FONTS){const box=document.createElement('div');box.textContent=font.name;ctx.font=`500 48px ${font.family},KerisBaeum`;const size=Math.min(48,48*620/ctx.measureText(font.name).width);box.style.cssText=`width:640px;height:80px;box-sizing:border-box;padding:0 4px;display:flex;align-items:center;white-space:nowrap;color:#34372f;font:500 ${size}px ${font.family},KerisBaeum;`;document.body.append(box);}
  document.documentElement.style.background='transparent';return{count:FONTS.length,ids:FONTS.map(font=>font.id)};
 });
 await page.screenshot({path:'/tmp/photo-font-name-atlas.png',fullPage:true,omitBackground:true});
 await writeFile(new URL('../font-name-previews.json',import.meta.url),JSON.stringify({...metadata,columns:4,cellWidth:640,cellHeight:80}));
 console.log(`Rendered ${metadata.count} names to /tmp/photo-font-name-atlas.png. Convert to font-name-previews.webp with lossless WebP compression.`);
}finally{await browser.close();}
