import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

const svgPath = path.join(process.cwd(), 'public', 'logo.svg');
const publicDir = path.join(process.cwd(), 'public');

if (!fs.existsSync(svgPath)) {
  console.error("logo.svg not found in public directory!");
  process.exit(1);
}

const svgBuffer = fs.readFileSync(svgPath);

// Helper function to render SVG to PNG at a specific width/height
function getPngBufferForSize(size) {
  const resvg = new Resvg(svgBuffer, {
    fitTo: {
      mode: 'width',
      value: size,
    }
  });
  return resvg.render().asPng();
}

function renderSvgToPng(size, filename) {
  const pngBuffer = getPngBufferForSize(size);
  const destPath = path.join(publicDir, filename);
  fs.writeFileSync(destPath, pngBuffer);
  console.log(`Successfully generated ${filename} (${size}x${size}px)`);
}

// Generate standard PNG sizes
try {
  renderSvgToPng(48, 'favicon-48.png');
  renderSvgToPng(96, 'favicon-96.png');
  renderSvgToPng(144, 'favicon.png');
  renderSvgToPng(180, 'apple-touch-icon.png');
  renderSvgToPng(192, 'logo.png');
  
  // Now build a true ICO file embedding the 48x48 PNG
  // ICO file format specification for embedded PNG:
  const png48Buffer = getPngBufferForSize(48);
  const pngSize = png48Buffer.length;
  
  const icoHeader = Buffer.alloc(22);
  // Header (6 bytes)
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type (1 for ICO)
  icoHeader.writeUInt16LE(1, 4); // Number of images (1)
  
  // Directory Entry (16 bytes)
  icoHeader.writeUInt8(48, 6);  // Width (48)
  icoHeader.writeUInt8(48, 7);  // Height (48)
  icoHeader.writeUInt8(0, 8);   // Color palette
  icoHeader.writeUInt8(0, 9);   // Reserved
  icoHeader.writeUInt16LE(1, 10); // Color planes
  icoHeader.writeUInt16LE(32, 12); // Bits per pixel
  icoHeader.writeUInt32LE(pngSize, 14); // Size of PNG data
  icoHeader.writeUInt32LE(22, 18); // Offset of PNG data (header is 22 bytes)
  
  // Combine header and PNG buffer
  const icoBuffer = Buffer.concat([icoHeader, png48Buffer]);
  
  const icoPath = path.join(publicDir, 'favicon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`Successfully generated favicon.ico (48x48px wrapped)`);
  
  console.log("All favicon/logo assets generated successfully!");
} catch (error) {
  console.error("Error generating assets:", error);
}
