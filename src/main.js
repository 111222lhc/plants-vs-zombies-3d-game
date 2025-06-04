import { Game } from './game.js';

let game = null;

document.addEventListener('DOMContentLoaded', () => {
  if (typeof THREE === 'undefined') {
    console.error('Three.js failed to load. Game cannot start.');
    const startScreen = document.getElementById('startScreen');
    const gameScreen = document.getElementById('gameScreen');
    const gameOverScreen = document.getElementById('gameOverScreen');

    if (startScreen) {
      startScreen.classList.remove('hidden');
      const startContent = startScreen.querySelector('.start-content');
      if (startContent) {
        startContent.innerHTML = `
          <h1>错误</h1>
          <p>无法加载游戏核心组件 (Three.js)。</p>
          <p>请检查您的网络连接，并确保没有浏览器插件阻止 cdnjs.cloudflare.com 的内容。</p>
          <p>然后请尝试刷新页面。</p>
        `;
      } else {
        startScreen.innerHTML = `
          <div class="start-content">
            <h1>错误</h1>
            <p>无法加载游戏核心组件 (Three.js)。</p>
            <p>请检查您的网络连接，并确保没有浏览器插件阻止 cdnjs.cloudflare.com 的内容。</p>
            <p>然后请尝试刷新页面。</p>
          </div>
        `;
      }
    }
    if (gameScreen) {
      gameScreen.classList.add('hidden');
    }
    if (gameOverScreen) {
      gameOverScreen.classList.add('hidden');
    }
    return;
  }

  game = new Game();
});
