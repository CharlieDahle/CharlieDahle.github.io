import { useState } from "react";

const API_BASE = "https://api.charliedahle.me";

function Books() {
  const [status, setStatus] = useState("idle"); // idle | loading | error

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    setStatus("loading");

    try {
      const formData = new FormData();
      formData.append("epub", file);

      const res = await fetch(`${API_BASE}/api/epub/convert`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Conversion failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.epub$/i, ".kepub.epub");
      a.click();
      URL.revokeObjectURL(url);

      setStatus("idle");
    } catch {
      setStatus("error");
    }

    // reset input so the same file can be re-uploaded
    e.target.value = "";
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
      }}
    >
      <label style={{ cursor: status === "loading" ? "default" : "pointer" }}>
        <input
          type="file"
          accept=".epub"
          style={{ display: "none" }}
          onChange={handleFile}
          disabled={status === "loading"}
        />
        <div
          style={{
            padding: "14px 28px",
            background: status === "loading" ? "#666" : "#000",
            color: "#fff",
            borderRadius: "8px",
            fontSize: "16px",
            userSelect: "none",
          }}
        >
          {status === "loading" ? "Converting…" : "Upload EPUB"}
        </div>
      </label>

      {status === "error" && (
        <div style={{ color: "red", fontSize: "14px" }}>
          Something went wrong. Try again.
        </div>
      )}
    </div>
  );
}

export default Books;
