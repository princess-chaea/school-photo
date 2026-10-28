export const FRAME_SIZES=[
 {id:'print-4x6',name:'4×6인치',width:1200,height:1800},
 {id:'print-3x5',name:'3×5인치',width:900,height:1500},
 {id:'print-5x7',name:'5×7인치',width:1500,height:2100},
 {id:'square',name:'정사각형 · 1:1',width:1080,height:1080},
 {id:'feed',name:'SNS 피드 · 4:5',width:1080,height:1350},
 {id:'story',name:'스토리 · 9:16',width:1080,height:1920},
 {id:'a4',name:'A4',width:2480,height:3508},
 {id:'screen',name:'화면용 · 세로/가로',width:1080,height:1920}
];
export function normalizeFrameFormat(value){return FRAME_SIZES.some(s=>s.id===value)?value:'print-4x6';}
export function frameSize(format,orientation='portrait'){
 const s=FRAME_SIZES.find(s=>s.id===format)||FRAME_SIZES[0];return {width:orientation==='landscape'?s.height:s.width,height:orientation==='landscape'?s.width:s.height};
}
