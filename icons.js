// 이 앱을 위해 구성한 둥근 선 아이콘. 외부 이미지/아이콘 요청 없이 렌더링합니다.
const paths = {
  camera: ['M4 7h4l2-3h4l2 3h4v13H4Z', 'M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
  frame: ['M4 3h16v18H4Z', 'M7 6h10v5H7Z', 'M7 14h10v4H7Z'],
  sticker: ['M5 3h14a2 2 0 0 1 2 2v9l-7 7H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', 'M14 21v-5a2 2 0 0 1 2-2h5', 'M8 8h.01M14 8h.01', 'M8 11q3 3 6 0'],
  text: ['M4 5h16M12 5v15M8 20h8', 'M4 5v3M20 5v3'],
  crop: ['M7 3v14h14', 'M3 7h14v14', 'M10 7h7v7'],
  filter: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', 'M12 3v18M15 5v14M18 8v8'],
  save: ['M4 3h13l4 4v14H3V3Z', 'M7 3v6h9V3', 'M7 21v-8h10v8'],
  share: ['M12 15V3M8 7l4-4 4 4', 'M5 11H3v10h18V11h-2'],
  refresh: ['M20 8a8 8 0 1 0 1 7', 'M20 3v5h-5'],
  back: ['M14 5l-7 7 7 7'],
  check: ['M21 11v1a9 9 0 1 1-5-8', 'M8 11l4 4 9-10'],
  expand: ['M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6'],
  flip: ['M8 5h11l-3-3M19 5l-3 3', 'M16 19H5l3 3M5 19l3-3', 'M3 9v6M21 9v6'],
  upload: ['M12 16V4M8 8l4-4 4 4', 'M4 15v6h16v-6'],
  attachment: ['M21 11.5 12.5 20a6 6 0 0 1-8.5-8.5L13 2.5a4 4 0 0 1 5.7 5.7L9.5 17.4a2 2 0 0 1-2.8-2.8L15 6.3'],
  close: ['M6 6l12 12M18 6 6 18'],
  trash: ['M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'],
  undo: ['M9 4 4 9l5 5M4 9h10a6 6 0 0 1 0 12'],
  minus: ['M4 12h16'],
  duplicate: ['M8 8h13v13H8ZM16 8V3H3v13h5'],
  plus: ['M12 4v16M4 12h16'],
  qr: ['M3 3h6v6H3ZM15 3h6v6h-6ZM3 15h6v6H3Z', 'M15 15h3v3h3v3h-6v-3M21 12v2M12 12h3M12 18v3'],
};
export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: 'ui-icon' })) svg.setAttribute(key, value);
  (paths[name] || paths.check).forEach(d => { const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', d); svg.append(path); }); return svg;
}
export function labelButton(el, name, label, end = false) {
  const span = document.createElement('span'); span.textContent = label;
  el.replaceChildren(...(end ? [span, icon(name)] : [icon(name), span]));
}
