import { MyComputerIcon } from "../icons";

const drives = [
  { label: "Local Disk (C:)", type: "Local Disk", size: "40.0 GB", free: "12.4 GB" },
  { label: "DVD Drive (D:)", type: "CD Drive", size: "—", free: "—" },
  { label: "Removable Disk (E:)", type: "Removable", size: "—", free: "—" },
];

export function MyComputer() {
  return (
    <div style={{ padding: 12, height: "100%", overflow: "auto", background: "#fff" }}>
      <h3 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: "bold" }}>
        Hard Disk Drives
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {drives.map((d) => (
          <div
            key={d.label}
            style={{
              width: 130,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              textAlign: "center",
            }}
          >
            <MyComputerIcon size={48} />
            <div>{d.label}</div>
            <div style={{ color: "#555", fontSize: 10 }}>
              {d.size} / {d.free} free
            </div>
          </div>
        ))}
      </div>
      <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #ccc" }} />
      <div style={{ fontSize: 11, color: "#333" }}>
        Type the path of a folder, and Windows will open it for you. (Just kidding —
        the file system isn't wired up yet.)
      </div>
    </div>
  );
}
