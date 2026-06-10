import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2pdf from 'html2pdf.js';
import { 
  FileText, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  Eye, 
  Info, 
  Lightbulb, 
  AlertTriangle, 
  Octagon, 
  Flame,
  ChevronLeft,
  ChevronRight,
  Printer,
  Settings,
  Monitor
} from 'lucide-react';
import { presets } from './presets';

export default function App() {
  const [markdown, setMarkdown] = useState(presets[0].content);
  const [activePresetId, setActivePresetId] = useState(presets[0].id);
  const [theme, setTheme] = useState('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 850;
    }
    return false;
  });
  const previewRef = useRef(null);

  // Initialize theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load document from URL parameter if present on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const docId = params.get('doc');
    if (docId) {
      const found = presets.find(p => p.id === docId);
      if (found) {
        setMarkdown(found.content);
        setActivePresetId(found.id);
      }
    }
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleSelectPreset = (preset) => {
    setMarkdown(preset.content);
    setActivePresetId(preset.id);
    if (window.innerWidth < 850) {
      setSidebarCollapsed(true);
    }
  };



  const handleExportPDF = () => {
    // 1. Obtener el documento activo y formatear su título para el nombre de archivo
    const activeDoc = presets.find(f => f.id === activePresetId);
    if (!activeDoc) return;

    // Nombre de archivo consistente con generate-pdfs.js (sólo caracteres alfanuméricos, guiones y minúsculas)
    const docTitle = activeDoc.id
      .replace(/[^\w\s-]/gi, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');

    const pdfKey = `./PDFs/${docTitle}.pdf`;

    // Importar dinámicamente los PDFs compilados en src/PDFs/
    const pdfModules = import.meta.glob('./PDFs/*.pdf', { eager: true });
    
    const matchedModule = pdfModules[pdfKey];
    if (matchedModule && matchedModule.default) {
      // Si el PDF estático existe, iniciar descarga directa
      const link = document.createElement('a');
      link.href = matchedModule.default;
      link.download = `${docTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log(`Descargado PDF estático: ${pdfKey}`);
    } else {
      // Fallback: Si no existe el PDF pre-renderizado, generar dinámicamente en el cliente
      console.warn(`PDF estático no encontrado (${pdfKey}). Usando fallback dinámico html2pdf...`);
      const element = previewRef.current;
      if (!element) return;

      const opt = {
        margin: [15, 15, 15, 15],
        filename: `${docTitle}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          onclone: (clonedDoc) => {
            clonedDoc.documentElement.setAttribute('data-theme', 'light');
            clonedDoc.documentElement.classList.add('is-printing-pdf');
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      try {
        html2pdf().set(opt).from(element).save();
      } catch (err) {
        console.error('Error en fallback de generación de PDF:', err);
      }
    }
  };



  // Custom renderer for blockquotes to intercept GitHub alert formatting
  const getAlertIcon = (type) => {
    switch (type) {
      case 'note': return Info;
      case 'tip': return Lightbulb;
      case 'important': return Octagon;
      case 'warning': return AlertTriangle;
      case 'caution': return Flame;
      default: return Info;
    }
  };

  const CustomBlockquote = ({ children }) => {
    let alertType = null;
    let alertContent = children;

    try {
      const childrenArray = React.Children.toArray(children);
      const firstChild = childrenArray[0];
      
      if (firstChild && firstChild.type === 'p') {
        const paragraphChildren = React.Children.toArray(firstChild.props.children);
        const firstParagraphChild = paragraphChildren[0];
        
        if (typeof firstParagraphChild === 'string') {
          const match = firstParagraphChild.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)/i);
          if (match) {
            alertType = match[1].toLowerCase();
            const remainingText = match[2];
            
            // Rebuild children components removing the [!NOTE] tag from the DOM tree
            const newParaChildren = remainingText 
              ? [remainingText, ...paragraphChildren.slice(1)]
              : paragraphChildren.slice(1);

            const newFirstChild = React.cloneElement(firstChild, {}, ...newParaChildren);
            alertContent = [newFirstChild, ...childrenArray.slice(1)];
          }
        }
      }
    } catch (e) {
      console.error("Error formatting alert block", e);
    }

    if (alertType) {
      const AlertIcon = getAlertIcon(alertType);
      return (
        <div className={`alert-box alert-${alertType}`}>
          <div className="alert-title">
            <AlertIcon size={16} className="alert-icon" />
            <span>{alertType}</span>
          </div>
          <div className="alert-content">
            {alertContent}
          </div>
        </div>
      );
    }

    return <blockquote>{children}</blockquote>;
  };

  const activeDoc = presets.find(f => f.id === activePresetId) || { title: 'Document' };

  return (
    <div className="app-container">
      {/* Backdrop overlay for mobile */}
      {!sidebarCollapsed && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Sidebar (Full Height) */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="costeo-logo">
            <div className="costeo-logo-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polygon points="12 3 22 21 2 21" fill="white" transform="rotate(180 12 12)" />
                <polygon points="12 17 7 8 17 8" fill="#dc2626" />
              </svg>
            </div>
            <span className="costeo-logo-text">Costeo <span className="costeo-logo-subtext">Docs</span></span>
          </div>
        </div>

        <div className="sidebar-header-title">
          <h2>Documentación</h2>
          <button 
            className="btn-icon close-sidebar-btn" 
            onClick={() => setSidebarCollapsed(true)}
            title="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>
        
        <ul className="preset-list">
          {presets.map(file => {
            const hasBackend = file.title.includes('Backend');
            const IconComponent = hasBackend ? Settings : Monitor;
            const cleanTitle = file.title
              .replace(/^[^\w]+/g, '')
              .trim();
            return (
              <li key={file.id}>
                <button 
                  className={`preset-item ${activePresetId === file.id ? 'active' : ''}`}
                  onClick={() => handleSelectPreset(file)}
                >
                  <IconComponent size={16} className="preset-item-icon" />
                  <span className="preset-item-text">{cleanTitle}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="sidebar-footer">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Visualizando: <strong style={{ color: 'var(--text-secondary)' }}>{activeDoc.title}</strong>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Top Header */}
        <header className="app-header">
          <div className="header-left">
            <button 
              className="btn-icon mobile-menu-btn" 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Mostrar menú" : "Ocultar menú"}
            >
              {sidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
            </button>
          </div>

          <div className="toolbar">

            <button 
              className="btn-icon mobile-pdf-btn"
              onClick={handleExportPDF}
              title="Descargar como PDF"
            >
              <Printer size={18} />
            </button>
            <button 
              className="btn btn-primary desktop-pdf-btn" 
              onClick={handleExportPDF}
              title="Descargar como PDF"
            >
              <Printer size={16} />
              <span>Descargar PDF</span>
            </button>

            <hr style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-color)', border: 'none' }} className="toolbar-divider" />

            {/* Theme Switcher */}
            <button className="btn-icon" onClick={toggleTheme} title="Cambiar Tema">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Preview Workspace */}
        <main style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
          
          {/* Right Panel: Rendered Preview */}
          <section className="preview-panel" style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}>
            <div className="panel-header">
              <div className="panel-title">
                <Eye size={14} />
                <span>Vista Previa del Documento</span>
              </div>
            </div>
            <div className="preview-content">
              <article className="markdown-body" ref={previewRef}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    blockquote: CustomBlockquote
                  }}
                >
                  {markdown}
                </ReactMarkdown>
              </article>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
