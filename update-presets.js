import fs from 'fs';
import path from 'path';

// Actualizado para apuntar a la nueva estructura dentro de src/
const mdDir = path.resolve('src', 'md');
const presetsPath = path.resolve('src', 'presets.js');

try {
  // Crea el directorio md si no existe para evitar errores
  if (!fs.existsSync(mdDir)) {
    fs.mkdirSync(mdDir, { recursive: true });
  }

  const files = fs.readdirSync(mdDir);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  const presets = mdFiles.map(file => {
    const filePath = path.join(mdDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const id = file.replace(/\.md$/i, '');
    
    // Create a human-friendly title
    let cleanName = id
      .replace(/^documentation_frontend-?/i, '🖥️ Frontend: ')
      .replace(/^documentation-?/i, '⚙️ Backend: ')
      .replace(/[-_]+/g, ' ')
      .trim();
    
    // Capitalize words
    const title = cleanName.split(' ').map(w => {
      if (!w) return '';
      // Capitalize the first letter and keep rest as is
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');

    return {
      id,
      title,
      content
    };
  });

  const outputContent = `export const presets = ${JSON.stringify(presets, null, 2)};\n`;
  fs.writeFileSync(presetsPath, outputContent, 'utf-8');
  console.log(`Successfully imported ${presets.length} markdown files into presets.js`);
} catch (err) {
  console.error('Error importing markdown files:', err);
  process.exit(1);
}
