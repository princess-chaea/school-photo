import{normalizePhotoLayouts}from'./core.js';
// Assets keep a bounded JSON configuration, avoiding Firestore's rule expression
// budget for 20 windows. Every read validates it again before it can affect geometry.
export function storeFrameMetadata(metadata={}){
 if(!metadata.photoLayouts)return metadata;
 const layouts=normalizePhotoLayouts(metadata.photoLayouts);if(!layouts||!layouts[metadata.layoutCount])throw new Error('사진 칸 배치를 다시 확인해 주세요.');
 return{...metadata,photoLayouts:JSON.stringify(layouts)};
}
export function readFrameAsset(asset){
 if(!asset.photoLayouts)return asset;const{photoLayouts,...rest}=asset,layouts=normalizePhotoLayouts(photoLayouts);
 return layouts?{...rest,photoLayouts:layouts}:rest;
}
