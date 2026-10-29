export const FRAME_PALETTES=[
 {id:'ivory',name:'밀크 아이보리',bg:'#fffdf6',ink:'#34372f'},
 {id:'black',name:'클래식 블랙',bg:'#242622',ink:'#fffdf6'},
 {id:'sage',name:'소프트 세이지',bg:'#cbd7bf',ink:'#3e5134'},
 {id:'pink',name:'피치 핑크',bg:'#f5d5d2',ink:'#79524d'},
 {id:'blue',name:'클라우드 블루',bg:'#d5e3ed',ink:'#3e5969'},
 {id:'butter',name:'버터 옐로',bg:'#f5e7a9',ink:'#706130'},
 {id:'lilac',name:'라일락',bg:'#e0d8ee',ink:'#635075'},
 {id:'lime',name:'프레시 라임',bg:'#c5f564',ink:'#354822'},
 {id:'coral',name:'애프리콧 코랄',bg:'#f3bbad',ink:'#74483e'},
 {id:'mint',name:'프레시 민트',bg:'#c8e4d3',ink:'#3c6651'},
 {id:'sand',name:'샌드 베이지',bg:'#e7d6b8',ink:'#68563d'},
 {id:'mauve',name:'로즈 모브',bg:'#d7bfd0',ink:'#674e60'},
 {id:'slate',name:'미스티 그레이',bg:'#bfcbd2',ink:'#3f535f'},
 {id:'navy',name:'딥 네이비',bg:'#33465b',ink:'#fff5de'},
].map(frame=>({...frame,source:'base'}));

export function paletteDefaultInk(background){
 const rgb=background.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4),luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
 return luminance>.179?'#000000':'#ffffff';
}
