// Camera and cartridge animations keep their place while a panel covers the room.
export function animationClock(now = () => performance.now()) {
  let offset = 0, pausedAt = null;
  return {
    now: () => (pausedAt ?? now()) - offset,
    setPaused(paused) {
      if (paused && pausedAt === null) pausedAt = now();
      else if (!paused && pausedAt !== null) {
        offset += now() - pausedAt;
        pausedAt = null;
      }
    },
  };
}
