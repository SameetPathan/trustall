"use client";

export default function PrintButton() {
  return (
    <button className="btn-sign" onClick={() => window.print()}>
      Print the sign
    </button>
  );
}
