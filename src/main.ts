import { Game } from './game/Game';
import { GameMode } from './game/types';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const game = new Game(canvas);

  // Start Animation Loop
  game.loop();

  // Mode Tabs
  const modeButtons = document.querySelectorAll<HTMLButtonElement>('.mode-btn');
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode as GameMode;
      if (mode) {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        game.setMode(mode);
      }
    });
  });

  // Sound Toggle Button
  const soundBtn = document.getElementById('sound-btn') as HTMLButtonElement;
  const soundIcon = soundBtn.querySelector('.icon')!;
  soundBtn.addEventListener('click', () => {
    const isMuted = game.soundManager.toggleMute();
    soundIcon.textContent = isMuted ? '🔇' : '🔊';
  });

  // Restart Button
  const restartBtn = document.getElementById('restart-btn') as HTMLButtonElement;
  restartBtn.addEventListener('click', () => {
    game.initGame();
  });

  // Modal Play Again Button
  const playAgainBtn = document.getElementById('modal-play-again-btn') as HTMLButtonElement;
  playAgainBtn.addEventListener('click', () => {
    game.initGame();
  });
});
