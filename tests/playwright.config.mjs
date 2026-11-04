import {defineConfig} from '../.qa-browser/node_modules/@playwright/test/index.mjs';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  testDir: '.',
  testMatch: 'browser.spec.mjs',
  workers: 1,
  retries: 0,
  reporter: [['list'],['html',{open:'never'}]],
  use: {headless:true,trace:'retain-on-failure',viewport:{width:390,height:844}},
  webServer: [
    {command:'node deploy-server.mjs',cwd:fileURLToPath(new URL('../',import.meta.url)),url:'http://127.0.0.1:8787/health',env:{HOST:'127.0.0.1',PORT:'8787'},timeout:30000},
    {command:'npm run dev -w @dalcheon/web -- --host 127.0.0.1',cwd:fileURLToPath(new URL('../.qa-dalcheon/',import.meta.url)),url:'http://127.0.0.1:5173',timeout:60000}
  ]
});
