import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

// Keep native scrollbars enabled: headless Chromium otherwise hides the exact
// scrollbar feedback loop this test guards against.
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: { ignored: ['**/dist/**'] } } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
let browser;
async function settled(page, label) {
  const samples = await page.evaluate(async () => {
    const stage = document.getElementById('expanded-stage');
    const canvas = document.getElementById('preview');
    const crop = document.getElementById('crop-preview');
    const values = [];
    for (let frame = 0; frame < 75; frame++) {
      await new Promise(requestAnimationFrame);
      if (frame >= 15) values.push(JSON.stringify([
        stage.clientWidth, stage.clientHeight, stage.scrollWidth, stage.scrollHeight,
        canvas.style.width, canvas.style.height, crop.style.width, crop.style.height,
      ]));
    }
    return values;
  });
  assert.equal(new Set(samples).size, 1, `${label}: viewport keeps resizing (${new Set(samples).size} sizes)`);
}
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    ignoreDefaultArgs: ['--hide-scrollbars'],
  });
  for (const [width, height, browserZoom] of [[1170,941,1.25], [1755,1412,1.5], [1440,900,1], [768,1024,1], [390,844,1]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1100 });
    const label = `${width}×${height} / ${browserZoom * 100}% page scale`;
    await page.goto(`${base}/booth.html?demo=1`);
    await page.evaluate(zoom => { document.documentElement.style.zoom = zoom; }, browserZoom);
    await page.locator('#next').click();
    await page.locator('#next').click();
    await page.locator('#demo').click();
    await page.locator('#decoration-editor').waitFor({ state: 'visible' });
    await settled(page, `${label} initial fit`);
    const initial = await page.locator('#preview').evaluate(canvas => canvas.toDataURL());
    // Fit has no hidden edges or unnecessary scrollbars, even at fractional sizes.
    const fits = () => page.locator('#expanded-stage').evaluate(stage => stage.scrollWidth <= stage.clientWidth + 1 && stage.scrollHeight <= stage.clientHeight + 1);
    assert(await fits(), `${label}: fit should not overflow`);
    for (const target of [125, 200, 400]) {
      while (parseInt(await page.locator('#editor-view-value').textContent(), 10) < target) await page.locator('#editor-view-plus').click();
      await settled(page, `${label} editor zoom ${target}%`);
    }
    const edges = await page.locator('#expanded-stage').evaluate(stage => {
      stage.scrollTo(1e7, 1e7);
      const far = { x: stage.scrollLeft, y: stage.scrollTop };
      stage.scrollTo(0, 0);
      return { far, first: { x: stage.scrollLeft, y: stage.scrollTop } };
    });
    assert(edges.far.x > 0 && edges.far.y > 0, `${label}: enlarged photo can reach its far edges`);
    assert.deepEqual(edges.first, { x: 0, y: 0 });
    await page.locator('#editor-view-fit').click();
    await settled(page, `${label} fit after zoom`);
    assert(await fits());
    await page.locator('[data-editor-tool=photo]').click();
    await settled(page, `${label} photo composition`);
    await page.locator('[data-editor-tool=stickers]').click();
    await settled(page, `${label} return to frame`);
    assert.equal(await page.locator('#preview').evaluate(canvas => canvas.toDataURL()), initial, 'View sizing must not change exported pixels');
    await page.close();
    console.log(`PASS ${label}: initial fit, 125/200/400%, edges, fit reset, composition and unchanged image`);
  }
} finally {
  await browser?.close();
  await server.close();
}
