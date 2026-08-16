const EFFECTS = {
  click: "./assets/audio/click.ogg",
  reveal: "./assets/audio/reveal.ogg",
  win: "./assets/audio/win.ogg",
};

export class AlleyAudio {
  constructor({ muted = false } = {}) {
    this.muted = muted;
    this.started = false;
    this.music = new Audio("./assets/audio/alley-loop.ogg");
    this.music.loop = true;
    this.music.volume = 0.2;
    this.effects = Object.fromEntries(
      Object.entries(EFFECTS).map(([name, source]) => {
        const audio = new Audio(source);
        audio.volume = name === "reveal" ? 0.55 : 0.4;
        return [name, audio];
      }),
    );
  }

  async start() {
    this.started = true;
    if (this.muted) return;
    try {
      await this.music.play();
    } catch {
      // Browsers can defer playback until another explicit interaction.
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) this.music.pause();
    else if (this.started) void this.start();
  }

  play(name) {
    const effect = this.effects[name];
    if (this.muted || !effect) return;
    effect.currentTime = 0;
    void effect.play().catch(() => {});
  }
}
