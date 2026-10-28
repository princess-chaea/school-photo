import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { rename, copyFile } from 'node:fs/promises';
const entry = name => fileURLToPath(new URL(name, import.meta.url));
export default defineConfig(({ mode }) => {
  const student = mode === 'student';
  return {
    worker: { format: 'es' },
    plugins: [{
      name: 'student-event-routes',
      configurePreviewServer(server) {
        server.middlewares.use((req,_res,next)=>{
          if(/^\/e\/[a-zA-Z0-9_-]+(?:[?/#]|$)/.test(req.url||''))req.url='/booth.html';
          next();
        });
      },
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (/^\/e\/[a-zA-Z0-9_-]+(?:[?/#]|$)/.test(req.url || '')) req.url = '/booth.html';
          next();
        });
      },
      generateBundle(_options,bundle) {
        if(!student)return;
        for(const output of Object.values(bundle))if(output.type==='chunk')for(const id of Object.keys(output.modules)) {
          if(/\/(admin|cloud|libraries|frame-editor|frame-upload)\.js$/.test(id)||id.includes('/@firebase/auth/'))throw new Error('학생 빌드에 관리자 모듈이 포함됐습니다: '+id);
        }
      },
      async closeBundle() {
        if(student)await rename('dist/student/student.html','dist/student/index.html');
        else {await copyFile('integrations/google-collection/Code.gs','dist/admin/collection-Code.gs');await copyFile('integrations/google-collection/appsscript.json','dist/admin/collection-appsscript.json');}
      },
    }],
    build: { manifest:true, outDir: student ? 'dist/student' : 'dist/admin', rollupOptions: { input: student
      ? { welcome: entry('./student.html'), booth: entry('./booth.html') }
      : { admin: entry('./index.html'), booth: entry('./booth.html'), collectionHelp:entry('./collection-setup.html') } } },
  };
});
