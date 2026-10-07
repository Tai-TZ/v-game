/** Shown while the 3D chunk downloads; same sky colour as the scene, so no flash (art §8.4). */
export function ScenePoster() {
  return (
    <div className="absolute inset-0 grid animate-appear place-items-center bg-scene">
      <div role="status" className="grid justify-items-center gap-3">
        <p className="text-sm font-medium text-fg-muted">Đang tải khuôn viên</p>
        <div className="h-1 w-40 overflow-hidden rounded-sm bg-line">
          <div className="h-full w-1/3 animate-poster-bar bg-brand" />
        </div>
      </div>
    </div>
  );
}
