import { useState, memo } from "react";
import { Settings2, Check } from "lucide-react";
import { C, ALL_COLUMNS } from "./constants/tokens";

interface Props {
  visibleColumns: string[];
  onToggle: (columnId: string) => void;
}

const ColumnPicker = memo(function ColumnPicker({ visibleColumns, onToggle }: Props) {
  const [showColPicker, setShowColPicker] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button 
        onClick={() => setShowColPicker(!showColPicker)}
        style={{ 
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 4, 
          background: showColPicker ? C.accent : "transparent", 
          border: `1px solid ${C.border}`, 
          color: showColPicker ? "#fff" : C.label, 
          cursor: "pointer",
          fontSize: 11, fontWeight: 600
        }}>
        <Settings2 size={14} />
        COLUMNS
      </button>
      
      {showColPicker && (
        <div style={{ 
          position: "absolute", top: "100%", right: 0, marginTop: 8, 
          background: "#1f222f", border: `1px solid ${C.border}`, 
          borderRadius: 8, padding: 10, zIndex: 20, width: 160, 
          boxShadow: "0 15px 35px rgba(0,0,0,0.6)" 
        }}>
          <div style={{ 
            fontSize: 9, fontWeight: 800, color: C.label, 
            marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 
          }}>
            Display Columns
          </div>
          {ALL_COLUMNS.map(col => (
            <div key={col.id} 
              onClick={() => onToggle(col.id)}
              style={{ 
                display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", 
                cursor: "pointer", borderRadius: 4, transition: "background 0.2s", 
                background: visibleColumns.includes(col.id) ? "rgba(255,255,255,0.05)" : "transparent" 
              }}>
              <div style={{ 
                width: 14, height: 14, border: `1px solid ${C.border}`, 
                borderRadius: 3, display: "flex", alignItems: "center", 
                justifyContent: "center", 
                background: visibleColumns.includes(col.id) ? C.accent : "transparent" 
              }}>
                {visibleColumns.includes(col.id) && <Check size={10} color="#fff" strokeWidth={3} />}
              </div>
              <span style={{ 
                fontSize: 12, 
                color: visibleColumns.includes(col.id) ? "#fff" : C.label, 
                fontWeight: visibleColumns.includes(col.id) ? 600 : 400 
              }}>
                {col.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default ColumnPicker;
