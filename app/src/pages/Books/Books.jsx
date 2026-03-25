function Books() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <label style={{ cursor: "pointer" }}>
        <input type="file" accept=".epub" style={{ display: "none" }} />
        <div
          style={{
            padding: "14px 28px",
            background: "#000",
            color: "#fff",
            borderRadius: "8px",
            fontSize: "16px",
            userSelect: "none",
          }}
        >
          Upload EPUB
        </div>
      </label>
    </div>
  );
}

export default Books;
