// Original vector artwork for this project. Regenerate: node scripts/generate-stickers.mjs
import {writeFile,mkdir} from 'node:fs/promises';
const ink='#654c48',cream='#fff3d8',pink='#f5a6bd',green='#aaca98',blue='#a9d6ed',yellow='#f9d47c',purple='#c7b5e5';
const path=(d,fill,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
const ellipse=(x,y,rx,ry,fill,extra='')=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const circle=(x,y,r,fill,extra='')=>ellipse(x,y,r,r,fill,extra);
const rect=(x,y,w,h,r,fill,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const line=(x,y,a,b,c=ink)=>`<path d="M${x} ${y}L${a} ${b}" fill="none" stroke="${c}"/>`;
const face=(x=80,y=88,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})" stroke-width="2.7">${ellipse(-13,0,2,3,ink)}${ellipse(13,0,2,3,ink)}${path('M-5 9Q0 15 5 9','none')}${ellipse(-23,8,6,3,pink,'stroke="none"')}${ellipse(23,8,6,3,pink,'stroke="none"')}</g>`;
const shine=(x,y)=>path(`M${x} ${y}q-7 3-8 11`,'none','stroke="#fff9ef" stroke-width="5"');
const star=(x,y,r,fill=yellow)=>{let p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,d=i%2?r*.46:r;p.push(`${x+Math.cos(a)*d},${y+Math.sin(a)*d}`);}return `<polygon points="${p.join(' ')}" fill="${fill}"/>`;};
const heart=(x,y,s=1,fill=pink)=>`<g transform="translate(${x} ${y}) scale(${s})">${path('M0 25C-65-12-38-55 0-28C38-55 65-12 0 25Z',fill)}</g>`;
const sparkle=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})">${path('M0-14Q3-3 12 0Q3 3 0 14Q-3 3-12 0Q-3-3 0-14',yellow)}</g>`;
const bow=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})">${path('M-4 0L-31-19Q-42 0-30 19L-4 5M4 0L31-19Q42 0 30 19L4 5',pink)}${circle(0,3,8,'#e788a4')}${path('M-10 11L-20 40L-5 34L4 40L9 12',pink)}</g>`;
const leaf=(x,y,rot=0)=>`<g transform="translate(${x} ${y}) rotate(${rot})">${path('M0 18Q-28-1 0-27Q28-1 0 18',green)}${line(0,15,0,-15,'#7c9c70')}</g>`;
const flower=(cx,cy,fill=pink)=>Array.from({length:6},(_,i)=>`<g transform="rotate(${i*60} ${cx} ${cy})">${ellipse(cx,cy-24,15,25,fill)}</g>`).join('')+circle(cx,cy,19,yellow)+face(cx,cy-3,.45);
const animal=(kind)=>{const colors={cat:'#f6cb96',bear:'#cba17b',rabbit:'#f2e0db',dog:'#dab38d',panda:cream,tiger:'#f7bd7b',fox:'#edaf82',koala:'#c4cdd0',capybara:'#c9a580'};let f=colors[kind]||cream,ears='';
 if(kind==='rabbit')ears=ellipse(56,43,15,35,f)+ellipse(104,43,15,35,f)+ellipse(56,40,6,23,pink,'stroke="none"')+ellipse(104,40,6,23,pink,'stroke="none"');
 else if(['cat','tiger','fox'].includes(kind))ears=path('M37 63L31 22L68 45M92 45L129 22L123 65',f)+path('M39 45L38 33L54 44M106 44L122 33L121 47',pink,'stroke="none"');
 else if(kind==='dog')ears=ellipse(34,80,15,36,'#ac7e60')+ellipse(126,80,15,36,'#ac7e60');
 else ears=circle(42,43,20,kind==='panda'?ink:f)+circle(118,43,20,kind==='panda'?ink:f)+circle(42,43,10,pink,'stroke="none"')+circle(118,43,10,pink,'stroke="none"');
 let head=ellipse(80,88,51,45,f);if(kind==='panda')head+=ellipse(60,82,14,18,ink)+ellipse(100,82,14,18,ink)+circle(60,80,4,'white','stroke="none"')+circle(100,80,4,'white','stroke="none"');else head+=face(80,87,.9);
 if(kind==='tiger')head+=path('M65 48L71 64M82 45V62M98 49L93 64M32 89L48 94M128 89L112 94','none');
 if(kind==='fox')head+=path('M38 98Q50 127 80 131Q110 127 122 98Q96 99 80 112Q64 99 38 98',cream)+circle(80,109,5,ink);
 if(kind==='cat')head+=path('M49 98L24 93M49 105L24 108M111 98L136 93M111 105L136 108','none','stroke-width="2.3"');
 if(kind==='koala')head+=ellipse(80,96,10,14,ink);
 return ears+head+bow(111,126,.44)+shine(58,62);
};
const art={
 heart:heart(80,89,1.3)+face(80,85,.85)+shine(49,52),
 star:star(80,82,61)+face(80,82,.85)+shine(67,51),
 rainbow:path('M27 116V94a53 53 0 0 1 106 0v22','none','stroke="#eaa1b7" stroke-width="15"')+path('M43 113V94a37 37 0 0 1 74 0v19','none','stroke="#f5ce7b" stroke-width="13"')+path('M58 111V94a22 22 0 0 1 44 0v17','none','stroke="#a2cadd" stroke-width="13"')+ellipse(29,119,22,12,cream)+ellipse(131,119,22,12,cream)+sparkle(130,35,.6),
 sun:Array.from({length:8},(_,i)=>`<g transform="rotate(${i*45} 80 80)">${rect(76,13,8,17,4,yellow)}</g>`).join('')+circle(80,80,40,yellow)+face(80,77,.9)+shine(62,53),
 moon:path('M108 23A57 57 0 1 0 135 111Q63 127 75 61Q78 38 108 23',yellow)+face(58,88,.65)+star(119,49,17,purple)+sparkle(135,83,.55),
 cloud:path('M39 115C5 113 14 73 41 72C39 32 93 21 108 63C145 58 153 111 124 115Z',blue)+face(82,90,.85)+shine(64,52),
 flower:flower(80,81,pink)+leaf(123,129,55),
 tulip:path('M80 125V79','none','stroke="#80a478" stroke-width="7"')+leaf(103,113,65)+leaf(60,115,-60)+path('M43 47L60 63L80 33L101 63L119 47Q125 103 80 104Q35 103 43 47',pink)+face(80,79,.65),
 clover:Array.from({length:4},(_,i)=>`<g transform="rotate(${i*90} 80 78)">${heart(80,63,.67,green)}</g>`).join('')+path('M80 90Q108 118 83 141','none','stroke="#739767" stroke-width="7"')+face(80,77,.6),
 butterfly:ellipse(47,65,27,34,purple,'transform="rotate(-30 47 65)"')+ellipse(113,65,27,34,pink,'transform="rotate(30 113 65)"')+ellipse(51,109,23,24,pink)+ellipse(109,109,23,24,purple)+rect(72,51,16,74,8,yellow)+path('M76 54Q51 25 59 22M84 54Q109 25 101 22','none')+circle(45,60,9,cream)+circle(115,60,9,cream)+face(80,65,.35),
 ribbon:bow(80,65,1.45)+sparkle(28,115,.6)+sparkle(132,29,.6),
 crown:path('M34 112L24 48L58 74L80 31L104 74L137 48L126 112Z',yellow)+rect(33,108,94,20,7,'#edb36e')+circle(26,44,7,pink)+circle(80,28,7,pink)+circle(136,44,7,pink)+path('M80 72L91 88L80 104L69 88Z',blue)+shine(45,84),
 balloon:ellipse(78,66,40,49,pink)+path('M74 114L68 125H87L81 114',pink)+path('M78 126Q103 140 78 149','none')+face(78,67,.8)+shine(59,34)+bow(79,128,.35),
 gift:rect(29,64,102,70,10,blue)+rect(22,51,116,25,7,green)+rect(72,53,17,81,0,pink)+bow(80,42,.85)+shine(43,86),
 cake:rect(35,72,90,60,10,pink)+ellipse(80,132,54,8,cream)+path('M35 85Q45 105 53 84Q64 105 74 84Q85 106 95 84Q110 104 125 85V71H35Z',cream)+rect(75,41,10,29,3,blue)+path('M80 38Q63 28 80 12Q97 28 80 38',yellow)+circle(53,113,3,cream)+circle(80,113,3,cream)+circle(107,113,3,cream),
 smile:circle(80,80,57,yellow)+face(80,76,1.3)+shine(51,43)+sparkle(131,125,.55),
 cat:animal('cat'),bear:animal('bear'),rabbit:animal('rabbit'),
 paw:ellipse(80,103,35,26,pink)+ellipse(40,70,13,18,pink,'transform="rotate(-25 40 70)"')+ellipse(66,48,12,18,pink)+ellipse(95,48,12,18,pink)+ellipse(121,70,13,18,pink,'transform="rotate(25 121 70)"')+heart(80,106,.37,cream)+shine(61,94),
 music:path('M59 108V40L124 25V98','none','stroke-width="9" stroke="#8aaace"')+path('M60 40V58L123 44V26Z',blue)+ellipse(43,111,23,17,purple,'transform="rotate(-20 43 111)"')+ellipse(108,101,23,17,pink,'transform="rotate(-20 108 101)"')+star(35,42,14,yellow),
 note:path('M38 24H111L132 46V133H38Z',yellow)+path('M111 24V46H132',cream)+line(53,56,97,56)+line(53,70,112,70)+line(53,84,96,84)+heart(91,113,.4,pink)+rect(60,16,39,15,3,blue,'transform="rotate(-8 80 24)"'),
 bolt:path('M91 15L34 89H70L61 143L127 66H88Z',yellow)+shine(86,43)+star(128,115,12,pink),
 diamond:path('M21 56L48 26H112L139 56L80 135Z',blue)+path('M21 56H139M48 26L59 56L80 135L101 56L112 26M59 56L80 26L101 56','none','stroke="#5c93ad" stroke-width="2.8"')+shine(43,49)+sparkle(133,111,.7),
 planet:circle(80,78,43,purple)+path('M28 102Q-5 93 67 59Q146 21 145 51Q140 81 55 114Q14 130 21 108','none','stroke="#e9bd7b" stroke-width="12"')+face(82,72,.7)+shine(65,47)+star(24,33,10,blue),
 rocket:path('M56 103L39 127L39 93L57 76M104 103L121 127L121 93L103 76',pink)+path('M58 112Q80 139 102 112L80 151Z',yellow)+path('M56 110Q35 53 80 15Q125 53 104 110Z',cream)+path('M57 47Q80 12 103 47Z',pink)+circle(80,70,17,blue)+shine(75,61)+rect(57,105,46,13,4,blue),
 book:path('M25 35Q56 23 80 39Q104 23 135 35V126Q106 115 80 131Q53 115 25 126Z',green)+line(80,40,80,126)+path('M38 53Q52 49 66 55M38 69Q52 65 66 71M94 54Q108 49 122 53M94 70Q108 65 122 69','none','stroke="#fff5dd"')+path('M100 32V81L109 75L118 80V30',pink),
 pencil:`<g transform="rotate(33 80 80)">${path('M65 116V35Q80 18 95 35V116L80 144Z',yellow)}${path('M65 116L80 144L95 116Z',cream)}${path('M75 134L80 144L85 134Z',ink)}${rect(65,23,30,23,7,pink)}${rect(65,45,30,10,0,blue)}${line(80,60,80,111,'#dfa65d')}</g>`+sparkle(123,104,.7),
 camera:rect(26,49,108,78,14,green)+rect(45,36,32,16,6,pink)+circle(83,88,29,cream)+circle(83,88,20,blue)+circle(89,82,7,'#fff9ef','stroke="none"')+circle(118,66,5,yellow)+rect(37,67,18,9,3,cream)+path('M36 53Q15 15 15 51V102','none','stroke-width="6"')+shine(41,105),
 sparkle:sparkle(72,85,3.2)+star(123,37,16,pink)+circle(28,34,6,blue)+circle(124,124,5,purple),
 trophy:path('M53 43H24Q14 87 58 92M107 43H136Q146 87 102 92',yellow)+path('M45 30H115V75Q110 107 80 107Q50 107 45 75Z',yellow)+rect(73,106,14,20,3,'#e3ab6d')+rect(49,126,62,15,5,pink)+star(80,66,19,cream)+shine(60,43),
 medal:path('M39 19H63L93 74L75 86Z',blue)+path('M96 19H121L88 86L68 74Z',pink)+circle(80,104,35,yellow)+circle(80,104,25,'#ffe7a1')+star(80,103,18,yellow)+shine(58,88),
 party:`<g transform="rotate(-23 80 88)">${path('M39 133L80 25L121 133Z',yellow)}${path('M52 100L108 122M65 67L96 87','none','stroke="#eea0b5" stroke-width="12"')}${ellipse(80,133,42,10,cream)}${circle(80,22,13,pink)}</g>`+star(125,41,13,blue)+sparkle(30,54,.8),
 sunflower:Array.from({length:12},(_,i)=>`<g transform="rotate(${i*30} 80 76)">${ellipse(80,47,10,25,yellow)}</g>`).join('')+circle(80,76,25,'#bd9472')+face(80,72,.65)+leaf(105,126,50),
 daisy:Array.from({length:10},(_,i)=>`<g transform="rotate(${i*36} 80 79)">${ellipse(80,51,9,25,cream)}</g>`).join('')+circle(80,79,21,yellow)+face(80,76,.55)+bow(115,122,.4),
 rose:path('M80 100V140','none','stroke="#7c9d70" stroke-width="6"')+leaf(105,119,65)+circle(80,65,41,pink)+path('M55 48Q83 24 106 55Q115 94 74 99Q39 94 42 65Q49 40 84 45Q110 53 92 78Q74 93 62 72Q55 56 78 56Q91 60 82 70','none','stroke="#bb708d" stroke-width="4"'),
 leaf:`<g transform="translate(80 84) scale(2.3)">${leaf(0,0,32)}</g>`+shine(65,50)+sparkle(124,121,.7),
 sprout:path('M80 132V68','none','stroke="#799b6e" stroke-width="7"')+leaf(56,69,-53)+leaf(104,62,53)+ellipse(80,135,33,8,'#d9c3a1')+face(80,120,.4),
 dog:animal('dog'),panda:animal('panda'),tiger:animal('tiger'),fox:animal('fox'),koala:animal('koala'),capybara:circle(44,49,11,'#c9a580')+circle(115,49,11,'#c9a580')+ellipse(80,90,54,39,'#c9a580')+ellipse(80,108,32,18,'#d8b99a')+face(80,84,.85)+ellipse(80,100,10,6,ink)+circle(80,36,16,'#efbf7e')+leaf(91,23,55),
 duck:ellipse(80,96,48,34,yellow)+circle(64,58,30,yellow)+ellipse(38,66,20,10,'#edb17b')+circle(63,54,3,ink)+ellipse(95,94,22,16,'#ffe6a0')+bow(78,124,.45)+shine(54,39),
 penguin:ellipse(80,83,46,57,'#7e879b')+ellipse(80,94,33,42,cream)+ellipse(32,92,10,25,'#7e879b','transform="rotate(24 32 92)"')+ellipse(128,92,10,25,'#7e879b','transform="rotate(-24 128 92)"')+ellipse(57,137,18,7,yellow)+ellipse(103,137,18,7,yellow)+face(80,66,.8)+path('M74 79L80 88L86 79Z',yellow)+bow(80,108,.45),
 owl:ellipse(80,86,48,51,'#c8ad91')+path('M35 65L30 27L65 45M95 45L130 27L125 65','#c8ad91')+circle(59,75,23,cream)+circle(101,75,23,cream)+circle(59,75,5,ink)+circle(101,75,5,ink)+path('M74 91L80 103L86 91Z',yellow)+path('M52 113L57 120M76 116L81 123M100 113L105 120','none')+leaf(130,128,50),
 whale:path('M31 64Q82 38 110 90Q122 92 135 72Q148 110 110 117Q91 147 47 123Q13 106 31 64Z',blue)+path('M36 108Q70 137 107 112',cream)+circle(52,90,3,ink)+ellipse(44,99,7,4,pink,'stroke="none"')+path('M69 53Q53 29 64 25M71 51Q88 27 90 39','none','stroke="#8eb5cd" stroke-width="5"')+shine(47,65),
 dolphin:path('M26 105Q36 48 92 48L104 27L109 58Q130 68 138 88L111 86Q91 118 56 106L41 133L39 110Z',blue)+path('M54 99Q92 101 111 86',cream)+circle(112,74,3,ink)+shine(61,63)+sparkle(31,44,.7),
 frog:circle(51,52,21,green)+circle(109,52,21,green)+ellipse(80,89,52,42,green)+circle(51,51,10,cream)+circle(109,51,10,cream)+circle(51,51,4,ink)+circle(109,51,4,ink)+face(80,86,.9)+leaf(125,130,65),
 backpack:path('M61 39V27Q80 7 99 27V39','none','stroke-width="7"')+rect(34,35,92,105,23,purple)+rect(48,85,64,40,10,pink)+line(48,94,112,94)+rect(47,52,66,20,6,cream)+star(80,104,12,yellow)+shine(49,48),
 paintbrush:`<g transform="rotate(35 80 80)">${rect(72,57,16,86,8,pink)}${rect(65,49,30,27,5,yellow)}${path('M65 48Q62 24 80 13Q99 22 95 49Z',blue)}${path('M66 40Q76 49 95 41','none')}</g>`+circle(35,115,10,purple)+circle(127,63,7,yellow),
 palette:path('M38 39Q103 7 135 62Q151 99 121 102Q102 94 101 117Q90 149 45 127Q7 110 25 68Z','#eac9a2')+ellipse(48,97,12,17,cream)+circle(48,56,11,pink)+circle(79,44,10,yellow)+circle(110,62,10,blue)+circle(112,90,9,green)+shine(54,126),
 graduation:path('M18 60L80 27L142 60L80 92Z',blue)+path('M43 76V107Q80 132 117 107V76',purple)+path('M80 60L136 64V108','none','stroke="#e7b765" stroke-width="5"')+rect(129,105,13,22,5,yellow)+sparkle(25,122,.7),
 ruler:`<g transform="rotate(38 80 80)">${rect(59,17,42,126,8,yellow)}${Array.from({length:8},(_,i)=>line(61,34+i*12,i%2?75:82,34+i*12)).join('')}${circle(80,126,5,cream)}</g>`+star(122,47,12,pink),
 science:path('M61 25H99M68 25V70L32 121Q26 137 44 137H116Q134 137 128 121L92 70V25',cream)+path('M52 94H108L125 123Q129 133 115 133H45Q31 133 35 123Z',blue)+circle(72,106,6,cream)+circle(96,118,4,cream)+circle(82,86,4,purple)+sparkle(123,39,.7),
 microscope:rect(51,31,25,57,6,blue,'transform="rotate(-25 63 60)"')+rect(49,19,25,17,5,purple,'transform="rotate(-25 63 27)"')+path('M86 60Q131 74 110 115L84 132','none','stroke="#9fbcaa" stroke-width="14"')+rect(35,94,65,10,4,pink)+rect(33,129,97,13,6,blue)+circle(99,75,12,yellow)+shine(95,68),
 strawberry:path('M35 57Q80 30 125 57Q133 96 80 138Q27 96 35 57',pink)+path('M80 53L47 34L59 58L29 57L58 74L80 55L102 74L131 57L102 58L113 34Z',green)+Array.from({length:3},(_,r)=>Array.from({length:3-r},(_,c)=>ellipse(55+r*12+c*25,84+r*17,2,4,cream,'stroke="none"')).join('')).join('')+shine(47,69),
 cherry:path('M51 87Q46 30 102 24Q105 63 113 86','none','stroke="#7d9d70" stroke-width="5"')+leaf(102,34,65)+circle(48,108,28,pink)+circle(111,108,28,'#eaa1a8')+shine(36,94)+shine(99,94),
 apple:path('M80 47Q48 24 30 60Q14 99 52 133Q66 143 80 131Q94 143 108 133Q146 99 130 60Q112 24 80 47',pink)+path('M80 45Q76 21 85 15','none','stroke-width="6"')+leaf(103,29,60)+face(80,89,.8)+shine(48,61),
 peach:path('M80 45Q43 20 27 67Q16 111 80 139Q144 111 133 67Q117 20 80 45', '#f6b6ad')+path('M80 45Q97 83 80 123','none','stroke="#d98c96"')+leaf(104,32,70)+shine(49,56),
 watermelon:path('M24 43H136Q138 128 80 138Q22 128 24 43',green)+path('M33 45H127Q125 117 80 127Q35 117 33 45',cream)+path('M42 46H118Q113 105 80 115Q47 105 42 46',pink)+ellipse(65,69,2,4,ink)+ellipse(97,69,2,4,ink)+ellipse(80,94,2,4,ink)+shine(53,53),
 lemon:ellipse(80,86,54,39,yellow,'transform="rotate(-25 80 86)"')+path('M29 90L18 100L32 112M130 63L142 59L137 76',yellow)+leaf(99,37,55)+face(80,86,.75)+shine(55,66),
 avocado:path('M80 21Q112 22 119 69Q147 126 106 142H54Q13 126 41 69Q48 22 80 21',green)+path('M80 34Q100 35 107 73Q131 123 100 130H60Q29 123 53 73Q60 35 80 34','#e4e7a7')+circle(80,103,25,'#ba9575')+face(80,100,.6)+shine(64,87),
 carrot:path('M74 51L43 136Q43 145 53 140L111 72Z','#f6bc7c')+leaf(98,43,20)+leaf(123,57,70)+path('M71 69L85 80M59 96L71 106M52 118L59 124','none','stroke="#c88a59"')+shine(72,67),
 icecream:path('M49 91L80 145L111 91Z','#e7ba83')+path('M61 96L91 126M80 96L101 111M99 96L69 126M80 96L59 111','none','stroke="#bd8b63" stroke-width="2"')+circle(80,55,34,pink)+circle(50,81,21,cream)+circle(110,81,21,cream)+circle(80,80,22,pink)+circle(85,22,9,'#df8c9a')+shine(64,42),
 donut:circle(80,83,57,'#e5b17f')+path('M28 65Q43 20 79 28Q120 18 135 63Q126 81 111 64Q100 92 82 68Q66 90 50 66Q36 85 28 65',pink)+circle(80,83,20,cream)+path('M52 42L56 49M104 41L99 49M119 61L111 58M36 96L42 101M111 113L117 109M66 124L71 117','none','stroke="#fff1cf" stroke-width="4"')+shine(43,89),
 cupcake:path('M38 88H122L112 139H48Z',blue)+path('M35 87Q18 62 46 54Q45 29 71 31Q99 10 109 43Q144 46 130 86Z',pink)+path('M45 56Q72 70 109 43M57 37Q80 50 97 29','none','stroke="#ca8ca3"')+circle(81,20,9,'#dc8b9a')+line(62,100,66,128)+line(80,100,80,128)+line(99,100,94,128),
 cookie:circle(80,82,56,'#e6bf8e')+Array.from({length:7},(_,i)=>{const a=i*2.4;return circle(80+Math.cos(a)*35,82+Math.sin(a)*35,6,'#997562');}).join('')+face(80,78,.7)+shine(54,44),
 boba:path('M43 47H117L108 139H52Z',cream)+path('M47 76H113L106 134H54Z','#d8b5a0')+rect(37,39,86,14,6,pink)+path('M91 41L106 15','none','stroke="#9bb9ae" stroke-width="8"')+Array.from({length:6},(_,i)=>circle(62+(i%3)*18,111+Math.floor(i/3)*17,5,'#86675c')).join('')+face(80,79,.65)+shine(55,60),
 latte:rect(32,53,84,78,17,cream)+path('M116 64H126Q153 85 125 105H116','none','stroke="#c5ae91" stroke-width="8"')+ellipse(74,54,42,10,'#c7a186')+heart(74,54,.42,cream)+path('M58 34Q47 24 59 12M82 34Q71 24 83 12','none','stroke="#c8c5ba"')+face(74,93,.7),
 popcorn:path('M37 69L49 140H111L123 69Z',pink)+path('M52 70L60 136M79 70V136M106 70L99 136','none','stroke="#fff0d9" stroke-width="10"')+Array.from({length:7},(_,i)=>circle(37+(i%4)*29,61-Math.floor(i/4)*23,17,cream)).join('')+star(80,105,19,yellow),
 pudding:ellipse(80,131,59,11,cream)+path('M50 47H110L124 116Q80 139 36 116Z',yellow)+ellipse(80,47,30,10,'#bd8e71')+path('M50 47Q65 69 76 51Q91 75 110 47', '#bd8e71')+face(80,92,.8)+shine(58,67),
 ufo:ellipse(80,69,35,35,blue)+ellipse(80,91,66,22,purple)+ellipse(80,85,57,12,pink)+circle(41,93,5,yellow)+circle(80,98,5,yellow)+circle(119,93,5,yellow)+face(80,59,.6)+path('M60 115L45 139M80 117V145M100 115L115 139','none','stroke="#d9bf7e" stroke-width="4"')+shine(64,44),
 astronaut:rect(51,78,58,52,14,cream)+rect(38,83,17,43,8,cream,'transform="rotate(20 46 100)"')+rect(105,83,17,43,8,cream,'transform="rotate(-20 114 100)"')+rect(54,119,21,25,7,blue)+rect(85,119,21,25,7,blue)+circle(80,50,37,cream)+rect(52,31,56,39,17,blue)+face(80,46,.65)+rect(64,92,32,22,5,pink)+shine(62,35),
 comet: path('M37 107L84 20L85 69L135 31L115 96Z',pink)+path('M45 107L104 39L87 92L135 64L103 119Z',yellow)+star(59,108,35,blue)+shine(52,91),
 telescope:`<g transform="rotate(-25 80 60)">${rect(32,43,88,31,6,blue)}${rect(107,35,24,47,5,purple)}${ellipse(132,59,7,20,cream)}${rect(22,50,12,17,3,yellow)}</g>`+path('M80 79V103L49 141M80 103L111 141M80 103V143','none','stroke-width="6"')+star(28,28,10,pink),
 compass:circle(80,84,56,cream)+circle(80,84,44,blue)+path('M80 44L96 84L80 124L64 84Z',pink)+path('M80 44V124L64 84Z',cream)+circle(80,84,7,yellow)+rect(67,12,26,16,7,yellow)+path('M80 34V41M80 127V134M30 84H37M123 84H130','none')+shine(46,53),
 mountain:path('M18 130L64 36L91 87L113 51L147 130Z',green)+path('M45 74L64 36L84 75L70 68L62 80L55 67Z',cream)+path('M99 78L113 51L128 80L113 72Z',cream)+circle(122,29,14,yellow)+path('M30 131H136','none'),
 tent:path('M19 130L80 27L141 130Z',yellow)+path('M80 27L58 130H115Z',pink)+path('M80 66L67 130H108Z',cream)+path('M19 130L11 140M141 130L149 140','none')+star(30,36,12,blue)+sparkle(128,38,.7),
 globe:circle(80,75,46,blue)+path('M53 38L65 52L52 67L66 79L61 99L81 111L90 93L101 84L94 69L109 55L98 35',green)+path('M113 30Q156 78 107 123Q82 140 53 120','none','stroke="#d3aa7c" stroke-width="7"')+path('M80 126V140M55 141H106','none','stroke-width="6"')+shine(44,59),
 plane:`<g transform="rotate(23 80 80)">${path('M72 22Q80 11 88 22L92 61L139 90V105L92 88V122L109 133V144L80 136L51 144V133L68 122V88L21 105V90L68 61Z',blue)}${path('M74 31H86V50H74Z',cream)}${line(80,91,80,123,'#7fa9c3')}</g>`+sparkle(25,30,.6),
 train:rect(41,22,78,106,18,green)+rect(51,37,58,39,8,blue)+line(80,39,80,75)+circle(58,99,8,yellow)+circle(102,99,8,yellow)+rect(55,114,50,13,4,pink)+path('M51 130L39 145M109 130L121 145M46 139H114','none','stroke-width="5"')+shine(58,27),
 snowflake:Array.from({length:6},(_,i)=>`<g transform="rotate(${i*60} 80 80)">${path('M80 80V21M80 43L62 29M80 43L98 29M80 62L60 48M80 62L100 48','none','stroke="#a1cbe0" stroke-width="6"')}</g>`).join('')+circle(80,80,9,cream),
 snowman:ellipse(80,112,43,33,cream)+circle(80,65,32,cream)+rect(45,33,70,10,4,purple)+rect(57,11,46,25,6,purple)+path('M32 100L12 83M128 100L148 83','none','stroke-width="5"')+face(80,60,.6)+path('M79 70L103 76L79 80Z',yellow)+rect(51,87,60,14,5,pink)+rect(91,96,14,28,4,pink)+circle(80,117,3,ink),
 umbrella:path('M21 78Q80-8 139 78Q119 62 101 80Q80 61 59 80Q41 62 21 78Z',pink)+path('M80 20Q63 39 59 80M80 20Q97 39 101 80M80 80V128Q80 148 64 137','none')+path('M31 108L27 119M122 105L118 116','none','stroke="#99bfd9" stroke-width="5"')+shine(56,43),
 scarf:path('M37 37Q80 23 123 37V66Q80 83 37 66Z',pink)+path('M85 67L86 134H117L112 64Z',pink)+path('M45 40V65M60 36V70M100 36V65M90 124H115M92 134V144M104 134V144M115 134V143','none','stroke="#b87c94"')+star(55,109,17,yellow),
 mitten:path('M48 82V40Q48 15 71 27Q92 11 104 32V78Q127 48 136 69Q140 91 112 120H51Q21 99 28 74Q36 60 48 82',pink)+rect(46,118,70,23,7,purple)+path('M60 126V134M77 126V134M94 126V134','none')+heart(81,83,.5,cream),
 pine:Array.from({length:3},(_,i)=>path(`M80 ${17+i*29}L${32-i*7} ${74+i*29}H${128+i*7}Z`,green)).join('')+rect(69,133,22,15,3,'#b08e73')+star(80,20,16,yellow)+circle(57,91,6,pink)+circle(99,118,6,pink)+circle(89,66,5,cream),
 acorn:path('M43 64H117Q121 124 80 141Q39 124 43 64','#d9b38a')+path('M33 64Q33 24 80 30Q127 24 127 64Z','#ae8b70')+path('M42 53L57 37M59 61L81 35M85 61L106 38M109 61L119 49','none','stroke="#8e6b57"')+path('M80 30Q74 14 88 12','none','stroke-width="6"')+face(80,96,.75),
 mushroom:path('M62 75H98L107 133Q80 146 53 133Z',cream)+path('M19 77Q21 19 80 18Q139 19 141 77Q80 101 19 77',pink)+circle(49,54,12,cream)+circle(90,39,10,cream)+circle(117,66,9,cream)+face(80,113,.65),
 kite:path('M80 17L127 68L80 119L33 68Z',blue)+path('M80 17V119L33 68Z',pink)+path('M33 68H127M80 119Q116 132 91 147','none')+bow(103,132,.26)+shine(85,42),
 pinwheel:path('M80 79V143','none','stroke="#c6a485" stroke-width="6"')+Array.from({length:4},(_,i)=>`<g transform="rotate(${i*90} 80 74)">${path('M80 74L30 67L37 20L80 51Z',[pink,blue,yellow,green][i])}${path('M80 74L37 20L80 51Z',cream)}</g>`).join('')+circle(80,74,9,yellow),
 basketball:circle(80,82,56,'#eeb887')+path('M24 82H136M80 26V138M40 41Q90 81 40 123M120 41Q70 81 120 123','none','stroke="#996b55"')+shine(56,40),
 football:circle(80,82,56,cream)+path('M80 56L104 73L95 101H65L56 73Z',blue)+path('M80 56V27M104 73L133 65M95 101L112 128M65 101L48 128M56 73L27 65','none')+shine(48,48),
 tennis:circle(65,92,43,green)+path('M34 63Q76 87 36 122M95 63Q53 87 93 122','none','stroke="#fff9e3" stroke-width="5"')+ellipse(109,48,21,29,pink,'transform="rotate(30 109 48)"')+path('M111 27L92 59M121 35L104 65M96 36L123 54M92 48L114 62M94 72L76 103','none','stroke-width="3"')+shine(42,75),
 badminton:ellipse(91,49,30,35,blue,'transform="rotate(30 91 49)"')+path('M76 25L106 71M63 40L99 84M69 67L117 42M66 53L109 28M75 81L40 137','none','stroke-width="4"')+path('M104 108L128 79L145 102L117 123Z',cream)+circle(110,120,11,pink),
 running: path('M33 60H69L88 91L132 107Q147 125 130 136H30Q15 133 19 115Z',blue)+path('M20 119H140V132H20Z',cream)+path('M73 77L59 89M82 91L68 103M93 99L81 113','none','stroke="#fff0d9" stroke-width="5"')+path('M14 48H45M11 65H31','none','stroke="#b2c99e" stroke-width="5"'),
 handshake: path('M17 68L45 44L74 60L91 45L142 76L125 108L98 134L62 111L43 121L17 100Z',cream)+path('M45 44L17 68V100L39 91L56 56Z',blue)+path('M91 45L70 61L58 81Q59 98 74 92L90 80L120 107M68 113L81 100M81 124L96 110M98 134L111 122','none')+heart(80,31,.45,pink),
 peace: path('M48 91L48 81Q48 72 58 74L63 77L53 27C49 9 67 5 72 23L82 68L97 22C102 7 120 14 114 31L99 78L110 76C124 74 129 85 124 100C121 128 105 143 84 143C63 143 47 123 47 104Z',cream)+path('M51 87C50 76 61 75 67 84L75 96M52 103C51 92 63 89 70 97L77 108M105 112L85 93Q77 85 70 91Q65 96 73 105L86 119','none')+star(30,26,12,yellow),
 thumbs: path('M58 72Q80 57 79 29Q81 10 94 22Q106 34 96 67H125Q142 70 136 87L125 126Q121 141 103 137L58 129Z',cream)+rect(26,71,35,65,8,blue)+circle(44,120,4,yellow)+sparkle(130,32,.8),
 speech: path('M24 37Q80 17 136 37V108Q99 128 69 117L37 142L42 116Q18 113 24 37Z',cream)+heart(80,81,.8,pink)+shine(38,45),
 letter: rect(21,42,118,87,10,cream)+path('M23 45L80 91L137 45M23 127L63 86M137 127L97 86','none','stroke="#b8a18b"')+heart(80,86,.47,pink)+bow(120,31,.4),
 photo:rect(27,18,106,128,6,cream,'transform="rotate(8 80 80)"')+rect(37,30,86,84,2,blue,'transform="rotate(8 80 80)"')+circle(96,50,13,yellow)+path('M36 103L59 68L83 93L99 76L122 115Z',green)+heart(76,130,.25,pink),
 cherryblossom:flower(80,78,'#f7c5d3')+path('M116 114Q129 119 136 108Q139 134 122 135',pink)+sparkle(26,124,.6),
 lotus: path('M80 121Q27 109 19 65Q54 65 80 103Q46 53 80 20Q114 53 80 103Q106 65 141 65Q133 109 80 121',pink)+path('M80 121Q42 133 24 108Q61 92 80 121Q99 92 136 108Q118 133 80 121',green)+path('M80 51V108','none','stroke="#d18da7"')+sparkle(124,32,.6),
 bee:ellipse(80,42,20,28,cream,'transform="rotate(-30 80 42)"')+ellipse(111,49,20,28,cream,'transform="rotate(30 111 49)"')+ellipse(78,94,52,33,yellow)+path('M60 65V124M87 63V126','none','stroke="#9b8065" stroke-width="12"')+circle(118,88,23,yellow)+face(118,84,.5)+path('M111 67L105 52M126 65L133 51','none')+shine(36,86),
 ladybug:ellipse(80,91,47,45,pink)+circle(80,40,22,'#8d7881')+line(80,52,80,135)+circle(57,77,9,ink)+circle(52,106,9,ink)+circle(103,77,9,ink)+circle(108,106,9,ink)+path('M70 24L60 13M90 24L100 13','none')+shine(49,63),
 turtle:ellipse(80,86,42,35,green)+ellipse(39,107,14,10,green)+ellipse(108,116,15,10,green)+circle(130,77,22,green)+circle(134,72,3,ink)+ellipse(141,83,5,3,pink,'stroke="none"')+path('M64 67L89 65L103 85L91 105L66 105L53 86Z','#c9dca2')+path('M64 67L53 53M89 65L103 54M103 85L121 89M91 105L96 119M66 105L56 117M53 86H38','none')+shine(59,61),
 seal:ellipse(80,102,53,30,blue)+circle(91,70,36,blue)+ellipse(62,119,18,10,blue)+path('M31 106L16 85Q9 116 36 119',blue)+face(92,71,.7)+path('M73 87L57 83M109 87L126 83','none','stroke-width="2"')+shine(78,44),
 otter:ellipse(80,106,35,39,'#be9e81')+circle(53,41,14,'#be9e81')+circle(107,41,14,'#be9e81')+ellipse(80,66,42,34,'#be9e81')+ellipse(80,78,29,18,cream)+face(80,61,.7)+ellipse(80,106,24,25,cream)+heart(80,113,.57,pink)+ellipse(53,107,12,16,'#be9e81')+ellipse(107,107,12,16,'#be9e81')+shine(58,48),
 hedgehog:star(80,81,62,'#b5947d')+ellipse(80,93,41,35,cream)+face(80,86,.85)+circle(80,105,5,ink)+leaf(117,40,45),
 hamster:circle(47,43,19,'#deb693')+circle(113,43,19,'#deb693')+circle(47,43,10,pink,'stroke="none"')+circle(113,43,10,pink,'stroke="none"')+ellipse(80,89,53,45,'#deb693')+ellipse(80,104,35,26,cream)+face(80,82,.9)+ellipse(48,100,13,10,pink,'stroke="none"')+ellipse(112,100,13,10,pink,'stroke="none"')+circle(80,99,4,ink),
};
const labels={heart:'하트',star:'별',rainbow:'무지개',sun:'햇살',moon:'달',cloud:'구름',flower:'꽃',tulip:'튤립',clover:'클로버',butterfly:'나비',ribbon:'리본',crown:'왕관',balloon:'풍선',gift:'선물',cake:'케이크',smile:'웃는 얼굴',cat:'고양이',bear:'곰',rabbit:'토끼',paw:'발자국',music:'음표',note:'메모',bolt:'번개',diamond:'보석',planet:'행성',rocket:'로켓',book:'책',pencil:'연필',camera:'카메라',sparkle:'반짝임',trophy:'트로피',medal:'메달',party:'파티 모자',sunflower:'해바라기',daisy:'데이지',rose:'장미',leaf:'나뭇잎',sprout:'새싹',dog:'강아지',panda:'판다',tiger:'호랑이',fox:'여우',koala:'코알라',capybara:'카피바라',duck:'오리',penguin:'펭귄',owl:'부엉이',whale:'고래',dolphin:'돌고래',frog:'개구리',backpack:'책가방',paintbrush:'붓',palette:'팔레트',graduation:'학사모',ruler:'자',science:'실험 플라스크',microscope:'현미경',strawberry:'딸기',cherry:'체리',apple:'사과',peach:'복숭아',watermelon:'수박',lemon:'레몬',avocado:'아보카도',carrot:'당근',icecream:'아이스크림',donut:'도넛',cupcake:'컵케이크',cookie:'쿠키',boba:'버블티',latte:'라테',popcorn:'팝콘',pudding:'푸딩',ufo:'우주선',astronaut:'우주인',comet:'유성',telescope:'망원경',compass:'나침반',mountain:'산',tent:'텐트',globe:'지구본',plane:'비행기',train:'기차',snowflake:'눈꽃',snowman:'눈사람',umbrella:'우산',scarf:'목도리',mitten:'장갑',pine:'트리',acorn:'도토리',mushroom:'버섯',kite:'연',pinwheel:'바람개비',basketball:'농구공',football:'축구공',tennis:'테니스',badminton:'배드민턴',running:'운동화',handshake:'악수',peace:'브이',thumbs:'최고',speech:'마음 말풍선',letter:'편지',photo:'즉석사진',cherryblossom:'벚꽃',lotus:'연꽃',bee:'꿀벌',ladybug:'무당벌레',turtle:'거북이',seal:'물범',otter:'수달',hedgehog:'고슴도치',hamster:'햄스터'};
// 96 original SVGs + 4 existing signature mascots = exactly 100 default stickers.
// Keep all 30 legacy IDs; prioritize diversity when adding the remaining 66.
const legacy=Object.keys(labels).slice(0,30);
const additions=['trophy','medal','party','sunflower','daisy','rose','leaf','sprout','dog','panda','tiger','fox','koala','capybara','duck','penguin','owl','whale','dolphin','frog','backpack','paintbrush','palette','graduation','ruler','science','microscope','strawberry','cherry','apple','peach','watermelon','lemon','avocado','carrot','icecream','donut','cupcake','cookie','boba','latte','popcorn','pudding','ufo','astronaut','comet','telescope','compass','mountain','tent','globe','plane','train','snowflake','snowman','umbrella','acorn','mushroom','basketball','football','handshake','peace','thumbs','letter','otter','hamster'];
const categories={
 '마음·축하':'heart star rainbow ribbon crown balloon gift cake smile sparkle trophy medal party handshake peace thumbs letter',
 '자연·계절':'sun moon cloud flower tulip clover butterfly sunflower daisy rose leaf sprout snowflake snowman umbrella acorn mushroom',
 '동물':'cat bear rabbit paw dog panda tiger fox koala capybara duck penguin owl whale dolphin frog otter hamster',
 '학교·취미':'music note book pencil camera backpack paintbrush palette graduation ruler science microscope basketball football',
 '간식·과일':'strawberry cherry apple peach watermelon lemon avocado carrot icecream donut cupcake cookie boba latte popcorn pudding',
 '우주·여행':'bolt diamond planet rocket ufo astronaut comet telescope compass mountain tent globe plane train'
};
const keys=[...legacy,...additions];if(keys.length!==96||new Set(keys).size!==96)throw Error('Expected 96 distinct presets');
await mkdir('public/stickers',{recursive:true});
const presets=[];
for(const key of keys){if(!art[key])throw Error('Missing artwork '+key);const category=Object.entries(categories).find(([,names])=>names.split(' ').includes(key))?.[0];if(!category)throw Error('Missing category '+key);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 160 160" role="img" aria-label="${labels[key]}"><defs><filter id="sticker" x="-35%" y="-35%" width="170%" height="180%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="3.5" result="rim"/><feFlood flood-color="#fffdf6"/><feComposite in2="rim" operator="in" result="white"/><feDropShadow dx="0" dy="2" stdDeviation="1.2" flood-color="#584744" flood-opacity=".18"/><feMerge><feMergeNode/><feMergeNode in="white"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g transform="translate(8 8) scale(.9)" filter="url(#sticker)" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${art[key]}</g></svg>\n`;
 await writeFile(`public/stickers/preset-${key}.svg`,svg);presets.push({id:`preset-${key}`,name:labels[key],url:`/stickers/preset-${key}.svg`,category});
}
await writeFile('sticker-presets.js','// Original illustrated presets. Generated by scripts/generate-stickers.mjs.\nexport const STICKER_PRESETS='+JSON.stringify(presets,null,2)+';\n');
console.log(`Generated ${presets.length} illustrated SVG stickers; 100 defaults including signature mascots.`);
