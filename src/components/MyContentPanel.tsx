import React, { useState } from 'react';
import { DungeonButton } from '@/components/ui/DungeonButton';
import { DungeonCard } from '@/components/ui/DungeonCard';
import { Package, Wand2, Trash2, Edit2, Save, X, Plus, Coins } from 'lucide-react';
import type { EquipmentSlot, InventoryItem, Spell } from '@/lib/gameData';

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  head: 'Head', chest: 'Chest', legs: 'Legs', feet: 'Feet',
  leftHand: 'Left Hand', rightHand: 'Right Hand', ringFinger: 'Ring', weapon: 'Weapon',
};

interface MyContentPanelProps {
  myItems: InventoryItem[];
  mySpells: Spell[];
  onSaveItem: (item: InventoryItem) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onDeleteSpell: (id: string) => Promise<void>;
}

const emptyDraft = { name: '', description: '', equipSlot: '' as EquipmentSlot | '', goldValue: '' };

/**
 * Personal items and spells, linked to the user's profile instead of a campaign.
 * Items can be created and edited here; detailed stats, weapons and spells are made in a
 * campaign and saved here with the bookmark button.
 */
const MyContentPanel: React.FC<MyContentPanelProps> = ({ myItems, mySpells, onSaveItem, onDeleteItem, onDeleteSpell }) => {
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      description: item.description || '',
      equipSlot: item.equipSlot || '',
      goldValue: item.goldValue !== undefined ? String(item.goldValue) : '',
    });
    setShowForm(true);
  };

  const reset = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    const existing = editingId ? myItems.find(i => i.id === editingId) : undefined;
    const gold = parseInt(draft.goldValue, 10);
    await onSaveItem({
      ...(existing || {}),
      id: existing?.id || crypto.randomUUID(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      equipSlot: draft.equipSlot || undefined,
      goldValue: Number.isFinite(gold) ? gold : undefined,
    });
    reset();
  };

  const sortedItems = [...myItems].sort((a, b) => a.name.localeCompare(b.name));
  const sortedSpells = [...mySpells].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Your own items and spells, kept on your profile instead of in a campaign. Add them to any campaign from its Inventory or Spells page.
      </p>

      <DungeonCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-3.5 h-3.5 text-primary" />
          <h3 className="font-display text-xs text-primary tracking-wider">MY ITEMS ({myItems.length})</h3>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="ml-auto text-primary hover:text-primary/80 text-xs flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> New item
            </button>
          )}
        </div>

        {showForm && (
          <div className="space-y-2 mb-4 border border-primary/20 p-3">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Item name"
              className="w-full bg-background border border-border px-3 py-2 text-sm"
            />
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Description"
              rows={2}
              className="w-full bg-background border border-border px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <select
                value={draft.equipSlot}
                onChange={(e) => setDraft({ ...draft, equipSlot: e.target.value as EquipmentSlot | '' })}
                className="flex-1 bg-background border border-border px-2 py-2 text-sm"
              >
                <option value="">Not equippable</option>
                {(Object.keys(SLOT_LABELS) as EquipmentSlot[]).map(s => (
                  <option key={s} value={s}>{SLOT_LABELS[s]}</option>
                ))}
              </select>
              <input
                value={draft.goldValue}
                onChange={(e) => setDraft({ ...draft, goldValue: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="Gold"
                inputMode="numeric"
                className="w-24 bg-background border border-border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <DungeonButton size="sm" onClick={handleSave} disabled={!draft.name.trim()}>
                <Save className="w-3.5 h-3.5 mr-1" /> {editingId ? 'Save' : 'Add'}
              </DungeonButton>
              <DungeonButton size="sm" variant="ghost" onClick={reset}>
                <X className="w-3.5 h-3.5 mr-1" /> Cancel
              </DungeonButton>
            </div>
          </div>
        )}

        {sortedItems.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No items yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {sortedItems.map(item => (
              <div key={item.id} className="flex items-start gap-2 text-sm py-1.5 px-2 border border-border bg-background/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-foreground">{item.name}</span>
                    {item.equipSlot && (
                      <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded">{SLOT_LABELS[item.equipSlot]}</span>
                    )}
                    {item.goldValue !== undefined && item.goldValue > 0 && (
                      <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Coins className="w-3 h-3" /> {item.goldValue}G
                      </span>
                    )}
                  </div>
                  {item.description && <span className="text-muted-foreground text-xs block">{item.description}</span>}
                </div>
                <button onClick={() => startEdit(item)} className="text-muted-foreground hover:text-primary shrink-0" title="Edit">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { if (confirm(`Delete "${item.name}" from My Content? Copies in campaigns are kept.`)) onDeleteItem(item.id); }}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DungeonCard>

      <DungeonCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 className="w-3.5 h-3.5 text-primary" />
          <h3 className="font-display text-xs text-primary tracking-wider">MY SPELLS ({mySpells.length})</h3>
        </div>
        {sortedSpells.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No spells yet. Save one from a campaign's Spells page with the bookmark button.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {sortedSpells.map(spell => (
              <div key={spell.id} className="flex items-start gap-2 text-sm py-1.5 px-2 border border-border bg-background/50">
                <div className="flex-1 min-w-0">
                  <span className="text-foreground">{spell.name}</span>
                  {spell.spellData && (
                    <span className="text-muted-foreground text-xs block">Lvl {spell.spellData.spellLevel} {spell.spellData.school}</span>
                  )}
                </div>
                <button
                  onClick={() => { if (confirm(`Delete "${spell.name}" from My Content? Copies in campaigns are kept.`)) onDeleteSpell(spell.id); }}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DungeonCard>
    </div>
  );
};

export default MyContentPanel;
