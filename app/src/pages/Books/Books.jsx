import { useState } from "react";

const API_BASE = "https://api.charliedahle.me";

function Books() {
  const [status, setStatus] = useState("idle"); // idle | loading | error | done
  const [result, setResult] = useState(null); // { url, filename }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (result) {
      URL.revokeObjectURL(result.url);
      setResult(null);
    }

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
      const filename = file.name.replace(/\.epub$/i, ".kepub.epub");

      setResult({ url, filename });
      setStatus("done");
    } catch {
      setStatus("error");
    }

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
        gap: "16px",
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
            padding: "12px 24px",
            background: status === "loading" ? "#666" : "#000",
            color: "#fff",
            borderRadius: "8px",
            fontSize: "15px",
            userSelect: "none",
          }}
        >
          {status === "loading" ? "Converting…" : "Upload EPUB"}
        </div>
      </label>

      {status === "done" && result && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 16px",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            fontSize: "14px",
            color: "#333",
          }}
        >
          <span style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {result.filename}
          </span>
          <a
            href={result.url}
            download={result.filename}
            style={{
              padding: "6px 14px",
              background: "#000",
              color: "#fff",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "13px",
              whiteSpace: "nowrap",
            }}
          >
            Download
          </a>
        </div>
      )}

      {status === "error" && (
        <div style={{ color: "red", fontSize: "14px" }}>
          Something went wrong. Try again.
        </div>
      )}
    </div>
  );
}

export default Books;
