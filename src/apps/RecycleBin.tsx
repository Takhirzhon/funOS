export function RecycleBin() {
  return (
    <div
      style={{
        padding: 18,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: "bold" }}>Recycle Bin is empty</div>
      <div style={{ fontSize: 11, color: "#555" }}>
        Items deleted from the desktop will appear here.
      </div>
    </div>
  );
}
