import React from 'react';
import { EquipmentSlot as SlotType, InventoryItem } from '@/lib/gameData';
import { X } from 'lucide-react';

interface EquipmentSlotProps {
  slot: SlotType;
  label: string;
  equippedItem?: InventoryItem;
  onDrop: (slot: SlotType, itemId: string) => void;
  onUnequip: (slot: SlotType) => void;
  disabled?: boolean;
}

export const EquipmentSlot: React.FC<EquipmentSlotProps> = ({
  slot,
  label,
  equippedItem,
  onDrop,
  onUnequip,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragOver(false);

    const itemData = e.dataTransfer.getData('application/json');
    if (itemData) {
      try {
        const item = JSON.parse(itemData) as InventoryItem;

        // Check if item can be equipped to this slot
        if (item.equipSlot === slot) {
          onDrop(slot, item.id);
        } else {
          console.warn(`Item ${item.name} cannot be equipped to ${slot} slot (requires ${item.equipSlot})`);
        }
      } catch (err) {
        console.error('Failed to parse dragged item:', err);
      }
    }
  };

  return (
    <div
      className={`relative border-2 transition-colors rounded ${
        isDragOver
          ? 'border-accent bg-accent/20'
          : equippedItem
          ? 'border-primary bg-primary/10'
          : 'border-muted bg-muted/30'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ width: '90px', height: '90px' }}
    >
      {/* Slot label */}
      <div className="absolute top-0 left-0 right-0 bg-background/80 px-1 py-0.5">
        <p className="text-xs text-muted-foreground text-center truncate">{label}</p>
      </div>

      {/* Equipped item */}
      {equippedItem ? (
        <div className="absolute inset-0 flex items-center justify-center pt-5">
          <div className="text-center px-1 w-full" title={equippedItem.name}>
            <p className="text-xs font-bold text-primary line-clamp-2 break-words">{equippedItem.name}</p>
          </div>
          {!disabled && (
            <button
              onClick={() => onUnequip(slot)}
              className="absolute top-5 right-1 w-4 h-4 bg-danger text-background rounded-full flex items-center justify-center hover:bg-danger/80 transition-colors"
              title="Unequip"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center pt-4">
          <p className="text-xs text-muted-foreground">Empty</p>
        </div>
      )}
    </div>
  );
};
