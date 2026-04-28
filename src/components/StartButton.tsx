import { StartLogoIcon } from "../icons";

type Props = { open: boolean; onClick: () => void };

export function StartButton({ open, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={open}
      style={{
        all: "unset",
        height: 30,
        padding: "0 22px 0 10px",
        background: open
          ? "linear-gradient(to bottom, #2f6f23 0%, #4d9842 50%, #2f6f23 100%)"
          : "linear-gradient(to bottom, #5eac56 0%, #62a957 8%, #62a957 40%, #4d9842 88%, #2f6f23 100%)",
        color: "#fff",
        fontWeight: "bold",
        fontStyle: "italic",
        fontSize: 14,
        textShadow: "1px 1px 1px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        clipPath: "polygon(0 0, 100% 0, 96% 100%, 0 100%)",
        cursor: "default",
        boxShadow: open ? "inset 0 0 6px rgba(0,0,0,0.4)" : undefined,
      }}
    >
      <StartLogoIcon size={18} />
      start
    </button>
  );
}
