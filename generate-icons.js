import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

async function main() {
  try {
    const svgPath = path.resolve('public', 'logo.svg');
    console.log(`Reading SVG from ${svgPath}...`);
    if (!fs.existsSync(svgPath)) {
      throw new Error(`SVG file not found at ${svgPath}`);
    }
    
    const svgData = fs.readFileSync(svgPath);

    console.log('Rendering SVG to 512x512 PNG...');
    const resvg = new Resvg(svgData, {
      background: 'rgba(0,0,0,0)',
      fitTo: {
        mode: 'width',
        value: 512,
      },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    // Write to different icon scales
    const logoPngPath = path.resolve('public', 'logo.png');
    const faviconPngPath = path.resolve('public', 'favicon.png');
    const appleTouchPath = path.resolve('public', 'apple-touch-icon.png');
    const faviconIcoPath = path.resolve('public', 'favicon.ico');

    fs.writeFileSync(logoPngPath, pngBuffer);
    fs.writeFileSync(faviconPngPath, pngBuffer);
    fs.writeFileSync(appleTouchPath, pngBuffer);
    fs.writeFileSync(faviconIcoPath, pngBuffer);

    console.log(`Success! Icons generated at:
- ${logoPngPath}
- ${faviconPngPath}
- ${appleTouchPath}
- ${faviconIcoPath}`);

  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
}

main();
