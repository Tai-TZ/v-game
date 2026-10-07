import { Component, type ReactNode } from "react";

/**
 * Keeps the hub usable when the 3D scene cannot start (no WebGL, chunk failed to load):
 * the HUD and the zone list still work, only the picture is replaced by a note.
 */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error("Campus scene failed to start", error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="absolute inset-0 grid place-items-center bg-scene px-6">
        <div className="max-w-sm rounded-md border border-line-strong bg-surface p-5 text-center">
          <p className="text-sm font-semibold text-fg">Trình duyệt chưa hiển thị được cảnh 3D.</p>
          <p className="mt-1 text-sm text-fg-muted">
            Mọi việc vẫn làm được qua nút "Các khu" ở góc trên.
          </p>
        </div>
      </div>
    );
  }
}
