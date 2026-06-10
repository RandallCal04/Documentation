import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { presets } from './src/presets.js';

// Actualizado para generar los archivos en src/PDFs/
const outputDir = path.resolve('src', 'PDFs');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Starting PDF generation for ${presets.length} documents...`);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

presets.forEach((preset, index) => {
  const docId = preset.id;
  
  // Clean filename: remove special characters, trim, and replace spaces with hyphens
  const docTitle = docId
    .replace(/[^\w\s-]/gi, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  
  const pdfPath = path.join(outputDir, `${docTitle}.pdf`);
  const url = `http://localhost:5173/?doc=${docId}`;
  
  console.log(`[${index + 1}/${presets.length}] Generating PDF for: ${preset.title} -> src/PDFs/${docTitle}.pdf`);
  
  try {
    // Invoke headless Edge to render the URL and save directly to PDF
    const cmd = `"${edgePath}" --headless --disable-gpu --print-to-pdf="${pdfPath}" --no-margins --virtual-time-budget=5000 --run-all-compositor-stages-before-draw "${url}"`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`   Successfully created: src/PDFs/${docTitle}.pdf`);
  } catch (err) {
    console.error(`   Error generating PDF for ${preset.title}:`, err.message);
  }
});

console.log('\nPDF generation complete! Check the "src/PDFs" folder in the documentation directory.');
