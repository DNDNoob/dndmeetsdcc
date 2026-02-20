import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { BookOpen, Search, Edit2, Save, X, ChevronRight, ArrowLeft } from "lucide-react";
import type { WikiPage } from "@/lib/gameData";
import { defaultWikiPages } from "@/lib/wikiDefaults";

interface WikiViewProps {
  wikiPages: WikiPage[];
  onUpdateWikiPage: (id: string, updates: Partial<WikiPage>) => void;
  onAddWikiPage: (page: WikiPage) => void;
  playerName?: string;
}

// Simple markdown renderer (no external dependency)
const renderMarkdown = (text: string): string => {
  let html = text;

  // Escape HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-display text-primary mt-6 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-display text-primary mt-8 mb-3">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-display text-primary text-glow-cyan mt-4 mb-4">$1</h1>');

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.split('|').filter(c => c.trim() !== '');
    const isHeader = /^[\s-:]+$/.test(cells[0]?.trim() ?? '');
    if (isHeader) return '<tr class="border-b border-border"></tr>';
    const tag = 'td';
    const cellsHtml = cells.map(c => `<${tag} class="px-3 py-1.5 text-sm border-r border-border/30 last:border-0">${c.trim()}</${tag}>`).join('');
    return `<tr class="border-b border-border/30 hover:bg-muted/30">${cellsHtml}</tr>`;
  });

  // Wrap consecutive table rows
  html = html.replace(/(<tr[^>]*>.*?<\/tr>\n?)+/g, (match) => {
    const rows = match.trim().split('\n').filter(r => r.trim() !== '' && !r.includes('border-b border-border"></tr>'));
    if (rows.length === 0) return match;
    // First row is header
    const headerRow = rows[0]?.replace(/td/g, 'th').replace('hover:bg-muted/30', 'bg-muted/50 font-display text-primary') ?? '';
    const bodyRows = rows.slice(1).join('\n');
    return `<div class="overflow-x-auto my-4"><table class="w-full border border-border rounded"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table></div>`;
  });

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-primary text-xs font-mono">$1</code>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-muted-foreground leading-relaxed">$1</li>');
  html = html.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, (match) => `<ul class="my-2 space-y-1 list-disc list-inside">${match}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 text-sm text-muted-foreground leading-relaxed">$1</li>');

  // Paragraphs (lines not already wrapped in tags)
  html = html.replace(/^(?!<[hultd/]|$)(.+)$/gm, '<p class="text-sm text-muted-foreground leading-relaxed mb-2">$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

  return html;
};

const WikiView: React.FC<WikiViewProps> = ({
  wikiPages,
  onUpdateWikiPage,
  onAddWikiPage,
  playerName = 'Anonymous',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Seed default wiki pages if none exist
  useEffect(() => {
    if (wikiPages.length === 0) {
      for (const page of defaultWikiPages) {
        onAddWikiPage({
          ...page,
          updatedAt: new Date().toISOString(),
          updatedBy: 'System',
        });
      }
    }
  }, [wikiPages.length, onAddWikiPage]);

  // Auto-select first page
  useEffect(() => {
    if (!selectedPageId && wikiPages.length > 0) {
      setSelectedPageId('getting-started');
    }
  }, [selectedPageId, wikiPages.length]);

  const pages = useMemo(() => {
    return [...wikiPages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [wikiPages]);

  const categories = useMemo(() => {
    const cats = new Map<string, WikiPage[]>();
    const catOrder = ['Basics', 'Game Mechanics', 'DM Guide', 'Features'];
    for (const page of pages) {
      const cat = page.category || 'Uncategorized';
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat)!.push(page);
    }
    // Sort by predefined order
    const sorted = new Map<string, WikiPage[]>();
    for (const cat of catOrder) {
      if (cats.has(cat)) sorted.set(cat, cats.get(cat)!);
    }
    // Add any remaining categories
    for (const [cat, pgs] of cats) {
      if (!sorted.has(cat)) sorted.set(cat, pgs);
    }
    return sorted;
  }, [pages]);

  const selectedPage = useMemo(() => {
    return pages.find(p => p.id === selectedPageId) ?? null;
  }, [pages, selectedPageId]);

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return pages.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [searchQuery, pages]);

  const handleSave = () => {
    if (!selectedPage) return;
    onUpdateWikiPage(selectedPage.id, {
      content: editContent,
      updatedAt: new Date().toISOString(),
      updatedBy: playerName,
    });
    setEditMode(false);
  };

  const handleStartEdit = () => {
    if (!selectedPage) return;
    setEditContent(selectedPage.content);
    setEditMode(true);
  };

  // Extract table of contents from content
  const tableOfContents = useMemo(() => {
    if (!selectedPage) return [];
    const headings: { level: number; text: string; id: string }[] = [];
    const lines = selectedPage.content.split('\n');
    for (const line of lines) {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        headings.push({ level, text, id });
      }
    }
    return headings;
  }, [selectedPage]);

  // Scroll to top when changing pages
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [selectedPageId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-full px-4 md:px-6 py-4"
    >
      <DungeonCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-primary text-glow-cyan flex items-center gap-3">
            <BookOpen className="w-6 h-6" />
            WIKI
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors font-display md:hidden"
            >
              {showSidebar ? 'Hide Nav' : 'Show Nav'}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search wiki..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted border border-border px-3 py-2 pl-10 text-sm"
          />
        </div>

        {/* Search results overlay */}
        {filteredPages && (
          <div className="mb-4 border border-primary/30 bg-muted/30 p-3 max-h-60 overflow-y-auto">
            <div className="text-xs text-muted-foreground font-display mb-2">
              {filteredPages.length} RESULT{filteredPages.length !== 1 ? 'S' : ''}
            </div>
            {filteredPages.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No pages match your search</p>
            ) : (
              <div className="space-y-1">
                {filteredPages.map(page => (
                  <button
                    key={page.id}
                    onClick={() => {
                      setSelectedPageId(page.id);
                      setSearchQuery('');
                      setEditMode(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors flex items-center gap-2"
                  >
                    <ChevronRight className="w-3 h-3 text-primary shrink-0" />
                    <div>
                      <span className="text-foreground">{page.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">({page.category})</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main layout */}
        <div className="flex gap-4" style={{ minHeight: '60vh' }}>
          {/* Sidebar */}
          {showSidebar && (
            <div className="w-48 md:w-56 shrink-0 border-r border-border pr-4 overflow-y-auto" style={{ maxHeight: '70vh' }}>
              {Array.from(categories.entries()).map(([category, catPages]) => (
                <div key={category} className="mb-4">
                  <div className="text-[10px] font-display text-accent uppercase tracking-wider mb-1.5">
                    {category}
                  </div>
                  {catPages.map(page => (
                    <button
                      key={page.id}
                      onClick={() => {
                        setSelectedPageId(page.id);
                        setEditMode(false);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left px-2 py-1 text-xs transition-colors rounded mb-0.5 ${
                        selectedPageId === page.id
                          ? 'bg-primary/20 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {page.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 min-w-0 overflow-y-auto" ref={contentRef} style={{ maxHeight: '70vh' }}>
            {selectedPage ? (
              <div>
                {/* Page header */}
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-accent font-display">{selectedPage.category}</span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-foreground">{selectedPage.title}</span>
                  </div>
                  {editMode ? (
                    <div className="flex items-center gap-2">
                      <DungeonButton variant="default" size="sm" onClick={handleSave}>
                        <Save className="w-3 h-3 mr-1" /> Save
                      </DungeonButton>
                      <DungeonButton variant="danger" size="sm" onClick={() => setEditMode(false)}>
                        <X className="w-3 h-3 mr-1" /> Cancel
                      </DungeonButton>
                    </div>
                  ) : (
                    <DungeonButton variant="ghost" size="sm" onClick={handleStartEdit}>
                      <Edit2 className="w-3 h-3 mr-1" /> Edit
                    </DungeonButton>
                  )}
                </div>

                {editMode ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-muted border border-border px-4 py-3 text-sm font-mono resize-none"
                    style={{ minHeight: '50vh' }}
                    autoFocus
                  />
                ) : (
                  <div className="flex gap-4">
                    {/* Page content */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="wiki-content"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedPage.content) }}
                      />
                      {selectedPage.updatedAt && (
                        <div className="mt-8 pt-4 border-t border-border text-[10px] text-muted-foreground">
                          Last updated: {new Date(selectedPage.updatedAt).toLocaleDateString()} by {selectedPage.updatedBy || 'Unknown'}
                        </div>
                      )}
                    </div>

                    {/* Table of contents (desktop only) */}
                    {tableOfContents.length > 2 && (
                      <div className="hidden lg:block w-40 shrink-0">
                        <div className="sticky top-12 text-[10px] space-y-1">
                          <div className="font-display text-muted-foreground mb-2">ON THIS PAGE</div>
                          {tableOfContents.filter(h => h.level <= 2).map((heading, i) => (
                            <div
                              key={i}
                              className={`text-muted-foreground hover:text-primary cursor-pointer transition-colors ${
                                heading.level === 1 ? 'font-medium' : 'pl-2'
                              }`}
                            >
                              {heading.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-display">Select a page from the sidebar</p>
                  <p className="text-xs mt-1">or use the search bar above</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default WikiView;
