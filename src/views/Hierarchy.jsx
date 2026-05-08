import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { card, btn, colors } from "../lib/styles.js";

export function Hierarchy({ notify, currentUser }) {
  const [hierarchies, setHierarchies] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [tree, setTree] = useState([]);
  const [dragging, setDragging] = useState(null);

  useEffect(() => {
    api.hierarchies().then(h => {
      setHierarchies(h);
      if (h.length) { setActiveId(h[0].hierarchy_id); }
    }).catch(e => notify(e.message, "error"));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    api.hierarchyTree(activeId).then(setTree).catch(e => notify(e.message, "error"));
  }, [activeId]);

  async function handleDrop(targetId) {
    if (!dragging || dragging === targetId) return;
    try {
      await api.moveNode(dragging, targetId);
      const t = await api.hierarchyTree(activeId);
      setTree(t);
      notify("Node moved", "success");
    } catch (e) { notify(e.message, "error"); }
    setDragging(null);
  }

  async function addChild(parentId) {
    const lbl = prompt("Node label:");
    if (!lbl) return;
    try {
      await api.addNode(activeId, { parent_node_id: parentId, node_label: lbl });
      const t = await api.hierarchyTree(activeId);
      setTree(t);
      notify("Node added", "success");
    } catch (e) { notify(e.message, "error"); }
  }

  async function removeNode(id) {
    if (!confirm("Delete this node and its descendants?")) return;
    try {
      await api.deleteNode(id);
      const t = await api.hierarchyTree(activeId);
      setTree(t);
      notify("Node deleted", "success");
    } catch (e) { notify(e.message, "error"); }
  }

  function NodeRow({ node, depth = 0 }) {
    const isDragTarget = dragging && dragging !== node.node_id;
    return (
      <div>
        <div
          draggable
          onDragStart={() => setDragging(node.node_id)}
          onDragEnd={() => setDragging(null)}
          onDragOver={e => isDragTarget && e.preventDefault()}
          onDrop={() => handleDrop(node.node_id)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px",
            paddingLeft: 12 + depth * 24,
            borderRadius: 8,
            background: isDragTarget ? "#eff6ff" : "transparent",
            border: isDragTarget ? "1px dashed " + colors.accentBlue : "1px solid transparent",
            cursor: "grab",
            margin: "2px 0",
          }}
        >
          <span style={{ color: colors.muted, fontSize: 12 }}>{node.children?.length ? "▸" : "•"}</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: depth === 0 ? 700 : 500 }}>{node.node_label}</span>
          <span style={{ fontSize: 11, color: colors.muted, fontFamily: "monospace" }}>{node.record_id ?? ""}</span>
          <button onClick={() => addChild(node.node_id)}
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a",
                     padding: "2px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>+ Child</button>
          <button onClick={() => removeNode(node.node_id)}
            style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
                     padding: "2px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>×</button>
        </div>
        {node.children?.map(c => <NodeRow key={c.node_id} node={c} depth={depth + 1} />)}
      </div>
    );
  }

  // Root drop zone for moving to top level
  function RootDropZone() {
    return (
      <div
        onDragOver={e => dragging && e.preventDefault()}
        onDrop={() => handleDrop("")}
        style={{
          border: "1px dashed " + colors.line, borderRadius: 8, padding: 12,
          textAlign: "center", color: colors.muted, fontSize: 12, marginTop: 12,
        }}>
        Drop here to make a top-level node
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Hierarchy Editor</h1>
      <p style={{ color: colors.muted, margin: "0 0 20px", fontSize: 14 }}>
        Drag &amp; drop tree editor for parent-child master data relationships.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {hierarchies.map(h => (
          <button key={h.hierarchy_id} onClick={() => setActiveId(h.hierarchy_id)}
            style={{
              background: activeId === h.hierarchy_id ? colors.brand : "#fff",
              color: activeId === h.hierarchy_id ? "#fff" : colors.ink,
              border: "1px solid " + colors.line,
              borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}>
            {h.hierarchy_name}
          </button>
        ))}
      </div>

      <div style={{ ...card, padding: 18 }}>
        {tree.length === 0 ? (
          <div style={{ color: colors.muted, padding: 24, textAlign: "center" }}>No hierarchy data.</div>
        ) : (
          <>
            {tree.map(n => <NodeRow key={n.node_id} node={n} />)}
            <RootDropZone />
          </>
        )}
      </div>
    </div>
  );
}
