import { gameData } from "./data.js";
// 游戏核心类
class Game {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.gameState = 'start'; // start, playing, paused, gameOver
    this.resources = {
      sun: gameData.gameSettings.initialSun,
      materials: gameData.gameSettings.initialMaterials
    };
    this.baseHealth = gameData.gameSettings.baseHealth;
    this.currentWave = 1;
    this.isDay = true;
    this.timeProgress = 0;
    this.gameSpeed = 1;
    this.isPaused = false;
    
    this.selectedPlant = null;
    this.selectedBlock = null;
    this.buildMode = false;
    
    this.world = {};
    this.plants = [];
    this.zombies = [];
    this.projectiles = [];
    this.blocks = [];
    this.groundMeshes = [];
    
    this.worldSize = 20;
    this.basePosition = { x: 0, z: 0 };
    
    this.lastTime = 0;
    this.waveTimer = 0;
    this.timeTimer = 0;
    this.zombiesKilled = 0;
    this.gameStartTime = Date.now();
    
    this.init();
  }
  
  init() {
    try {
      console.log('游戏初始化开始...');
      this.setupUI();
      console.log('UI设置完成');
      this.setup3D();
      console.log('3D场景设置完成');
      this.createWorld();
      console.log('世界创建完成');
      this.bindEvents();
      console.log('事件绑定完成');
      this.showStartScreen();
      console.log('游戏初始化完成');
    } catch (error) {
      console.error('游戏初始化失败:', error);
      this.showMessage('游戏加载失败: ' + error.message, 'error');
    }
  }
  
  setupUI() {
    // 生成植物选项
    const plantGrid = document.getElementById('plantGrid');
    gameData.plants.forEach((plant, index) => {
      const plantItem = document.createElement('div');
      plantItem.className = 'plant-item';
      plantItem.dataset.index = index;
      plantItem.innerHTML = `
        <div class="plant-icon" style="background-color: ${plant.color}">${plant.icon}</div>
        <div class="plant-name">${plant.name}</div>
        <div class="plant-cost">☀️ ${plant.cost}</div>
      `;
      plantGrid.appendChild(plantItem);
    });
    
    // 生成方块选项
    const blockGrid = document.getElementById('blockGrid');
    gameData.blocks.forEach((block, index) => {
      const blockItem = document.createElement('div');
      blockItem.className = 'block-item';
      blockItem.dataset.index = index;
      blockItem.innerHTML = `
        <div class="block-icon" style="background-color: ${block.color}">${block.icon}</div>
        <div class="block-name">${block.name}</div>
      `;
      blockGrid.appendChild(blockItem);
    });
  }

  setup3D() {
    try {
      const container = document.getElementById('gameWorld');
      if (!container) {
        throw new Error('找不到游戏容器元素 #gameWorld');
      }
      
      // 检查WebGL支持
      if (!window.WebGLRenderingContext) {
        throw new Error('您的浏览器不支持WebGL');
      }
      
      // 创建场景
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.Fog(0x87CEEB, 10, 50);
      
      // 创建相机
      this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
      this.camera.position.set(10, 15, 10);
      this.camera.lookAt(0, 0, 0);
      
      // 创建渲染器
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      this.renderer.setClearColor(0x87CEEB);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(this.renderer.domElement);
    
    // 添加光源
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
    
    // 相机控制
    this.setupCameraControls();
    
    // 窗口大小调整
    window.addEventListener('resize', () => {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    });
  } catch (error) {
    console.error("Error in setup3D:", error);
  } // This closes the catch block for setup3D
} // This closes the setup3D method

setupCameraControls() {
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    const canvas = this.renderer.domElement;
    
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 1) { // 中键
        isDragging = true;
        previousMousePosition = { x: event.clientX, y: event.clientY };
        event.preventDefault();
      }
    });
    
    canvas.addEventListener('mousemove', (event) => {
      if (isDragging) {
        const deltaMove = {
          x: event.clientX - previousMousePosition.x,
          y: event.clientY - previousMousePosition.y
        };
        
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(this.camera.position);
        spherical.theta -= deltaMove.x * 0.01;
        spherical.phi += deltaMove.y * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        
        this.camera.position.setFromSpherical(spherical);
        this.camera.lookAt(0, 0, 0);
        
        previousMousePosition = { x: event.clientX, y: event.clientY };
      }
    });
    
    canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    canvas.addEventListener('wheel', (event) => {
      const distance = this.camera.position.length();
      const newDistance = Math.max(5, Math.min(30, distance + event.deltaY * 0.01));
      this.camera.position.normalize().multiplyScalar(newDistance);
      event.preventDefault();
    });
  }
  
  createWorld() {
    this.world = {};
    console.log('开始创建世界，worldSize:', this.worldSize);
    // 创建地面网格
    let cubeCount = 0;
    for (let x = -this.worldSize/2; x < this.worldSize/2; x++) {
      this.world[x] = {};
      for (let z = -this.worldSize/2; z < this.worldSize/2; z++) {
        this.world[x][z] = {
          type: 'grass',
          height: 0,
          plant: null,
          block: null
        };
        
        // 创建地面方块
        const geometry = new THREE.BoxGeometry(1, 0.1, 1);
        const material = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(x, -0.05, z);
        cube.receiveShadow = true;
        cube.userData = { type: 'ground', x: x, z: z };
        this.scene.add(cube);
        this.groundMeshes.push(cube);
        cubeCount++;
      }
    }
    console.log('创建了', cubeCount, '个地面方块');
    console.log('场景中的对象数量:', this.scene.children.length);
    
    // 创建基地
    this.createBase();
  }
  
  createBase() {
    const baseGroup = new THREE.Group();
    
    // 主建筑 - 蓝色立方体
    const mainGeometry = new THREE.BoxGeometry(2, 1.5, 2);
    const mainMaterial = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
    const main = new THREE.Mesh(mainGeometry, mainMaterial);
    main.position.y = 0.75;
    baseGroup.add(main);
    
    // 屋顶 - 金字塔形状
    const roofGeometry = new THREE.ConeGeometry(1.5, 0.8, 4);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 1.9;
    roof.rotation.y = Math.PI / 4;
    baseGroup.add(roof);
    
    // 门
    const doorGeometry = new THREE.BoxGeometry(0.6, 1.2, 0.1);
    const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, 0.6, 1.05);
    baseGroup.add(door);
    
    // 门把手
    const handleGeometry = new THREE.SphereGeometry(0.05, 8, 6);
    const handleMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(0.2, 0.6, 1.1);
    baseGroup.add(handle);
    
    // 窗户
    const windowGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.05);
    const windowMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB });
    
    const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
    window1.position.set(-0.7, 1.0, 1.05);
    baseGroup.add(window1);
    
    const window2 = new THREE.Mesh(windowGeometry, windowMaterial);
    window2.position.set(0.7, 1.0, 1.05);
    baseGroup.add(window2);
    
    const window3 = new THREE.Mesh(windowGeometry, windowMaterial);
    window3.position.set(-1.05, 1.0, 0);
    window3.rotation.y = Math.PI / 2;
    baseGroup.add(window3);
    
    const window4 = new THREE.Mesh(windowGeometry, windowMaterial);
    window4.position.set(1.05, 1.0, 0);
    window4.rotation.y = Math.PI / 2;
    baseGroup.add(window4);
    
    // 基座
    const foundationGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 8);
    const foundationMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
    const foundation = new THREE.Mesh(foundationGeometry, foundationMaterial);
    foundation.position.y = 0.15;
    baseGroup.add(foundation);
    
    // 装饰旗杆
    const poleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8);
    const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x2F2F2F });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(0, 2.8, 0);
    baseGroup.add(pole);
    
    // 旗帜
    const flagGeometry = new THREE.PlaneGeometry(0.5, 0.3);
    const flagMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x00FF00, 
      side: THREE.DoubleSide 
    });
    const flag = new THREE.Mesh(flagGeometry, flagMaterial);
    flag.position.set(0.25, 3.0, 0);
    baseGroup.add(flag);
    
    baseGroup.position.set(this.basePosition.x, 0, this.basePosition.z);
    baseGroup.castShadow = true;
    
    // 为整个组的所有子对象启用阴影
    baseGroup.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    this.scene.add(baseGroup);
    this.baseMesh = baseGroup;
  }
  
  bindEvents() {
    // 开始游戏按钮
    document.getElementById('startGameBtn').addEventListener('click', () => {
      this.startGame();
    });
    
    // 植物选择
    document.getElementById('plantGrid').addEventListener('click', (event) => {
      const plantItem = event.target.closest('.plant-item');
      if (plantItem && !plantItem.classList.contains('disabled')) {
        this.selectPlant(parseInt(plantItem.dataset.index));
      }
    });
    
    // 方块选择
    document.getElementById('blockGrid').addEventListener('click', (event) => {
      const blockItem = event.target.closest('.block-item');
      if (blockItem && !blockItem.classList.contains('disabled')) {
        this.selectBlock(parseInt(blockItem.dataset.index));
      }
    });
    
    // 建造模式切换
    document.getElementById('buildModeToggle').addEventListener('change', (event) => {
      this.buildMode = event.target.checked;
      this.updateUI();
    });
    
    // 游戏控制按钮
    document.getElementById('pauseBtn').addEventListener('click', () => {
      this.togglePause();
    });
    
    document.getElementById('speedBtn').addEventListener('click', () => {
      this.toggleSpeed();
    });
    
    // 3D世界点击
    this.renderer.domElement.addEventListener('click', (event) => {
      this.onWorldClick(event);
    });
    
    // 3D世界右键点击
    this.renderer.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.onWorldRightClick(event);
    });
    
    // 3D世界鼠标移动
    this.renderer.domElement.addEventListener('mousemove', (event) => {
      this.checkMouseHover(event);
    });
    
    // 游戏结束按钮
    document.getElementById('restartBtn').addEventListener('click', () => {
      this.restart();
    });
    
    document.getElementById('mainMenuBtn').addEventListener('click', () => {
      this.showStartScreen();
    });
  }
  
  selectPlant(index) {
    const plant = gameData.plants[index];
    if (this.resources.sun >= plant.cost) {
      this.selectedPlant = index;
      this.selectedBlock = null;
      this.updatePlantSelection();
    } else {
      this.showMessage(`阳光不足！需要 ${plant.cost} 阳光`, 'error');
    }
  }
  
  selectBlock(index) {
    const block = gameData.blocks[index];
    if (this.resources.materials >= block.cost) {
      this.selectedBlock = index;
      this.selectedPlant = null;
      this.updateBlockSelection();
    } else {
      this.showMessage(`材料不足！需要 ${block.cost} 材料`, 'error');
    }
  }
  
  updatePlantSelection() {
    document.querySelectorAll('.plant-item').forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedPlant);
    });
    document.querySelectorAll('.block-item').forEach(item => {
      item.classList.remove('selected');
    });
  }
  
  updateBlockSelection() {
    document.querySelectorAll('.block-item').forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedBlock);
    });
    document.querySelectorAll('.plant-item').forEach(item => {
      item.classList.remove('selected');
    });
  }
  
  onWorldClick(event) {
    if (this.gameState !== 'playing') return;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // 检测与地面的交互
    const intersects = this.raycaster.intersectObjects(this.groundMeshes);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const userData = intersect.object.userData;
      
      if (userData.type === 'ground') {
        const x = userData.x;
        const z = userData.z;
        
        if (this.buildMode) {
          this.placeBlock(x, z);
        } else {
          this.placePlant(x, z);
        }
      }
    }
  }
  
  onWorldRightClick(event) {
    if (this.gameState !== 'playing') return;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // 检测与地面的交互
    const intersects = this.raycaster.intersectObjects(this.groundMeshes);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const userData = intersect.object.userData;
      
      if (userData.type === 'ground') {
        const x = userData.x;
        const z = userData.z;
        
        // 右键总是建造方块
        this.placeBlock(x, z);
      }
    }
  }
  
  checkMouseHover(event) {
    if (this.gameState !== 'playing') return;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // 检测与地面的交互
    const intersects = this.raycaster.intersectObjects(this.groundMeshes);
    
    // 隐藏所有植物的攻击范围
    this.plants.forEach(plant => {
      if (plant.hideRange) {
        plant.hideRange();
      }
    });
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const userData = intersect.object.userData;
      
      if (userData.type === 'ground') {
        const x = userData.x;
        const z = userData.z;
        
        // 检查这个位置是否有植物
        if (this.isValidPosition(x, z) && this.world[x] && this.world[x][z] && this.world[x][z].plant) {
          const plant = this.world[x][z].plant;
          // 显示植物的攻击范围
          if (plant.showRange) {
            plant.showRange();
          }
        }
      }
    }
  }
  
  isValidPosition(x, z) {
    return x >= -this.worldSize/2 && x < this.worldSize/2 && 
           z >= -this.worldSize/2 && z < this.worldSize/2 &&
           this.world[x] && this.world[x][z];
  }
  
  placePlant(x, z) {
    if (this.selectedPlant === null) {
      this.showMessage('请先选择一个植物', 'warning');
      return;
    }
    
    const cell = this.world[x][z];
    if (cell.plant || cell.block) {
      this.showMessage('这个位置已经被占用', 'warning');
      return;
    }
    
    const plantData = gameData.plants[this.selectedPlant];
    if (this.resources.sun < plantData.cost) {
      this.showMessage(`阳光不足！需要 ${plantData.cost} 阳光`, 'error');
      return;
    }
    
    this.resources.sun -= plantData.cost;
    
    const plant = new Plant(plantData, x, z);
    this.plants.push(plant);
    this.scene.add(plant.mesh);
    cell.plant = plant;
    
    this.selectedPlant = null;
    this.updatePlantSelection();
    this.updateUI();
    this.showMessage(`种植了 ${plantData.name}`, 'success');
  }
  
  placeBlock(x, z) {
    if (this.selectedBlock === null) {
      this.showMessage('请先选择一个方块', 'warning');
      return;
    }
    
    const cell = this.world[x][z];
    if (cell.block) {
      this.showMessage('这个位置已经有方块了', 'warning');
      return;
    }
    
    const blockData = gameData.blocks[this.selectedBlock];
    if (this.resources.materials < blockData.cost) {
      this.showMessage(`材料不足！需要 ${blockData.cost} 材料`, 'error');
      return;
    }
    
    this.resources.materials -= blockData.cost;
    
    const block = new Block(blockData, x, z);
    this.blocks.push(block);
    this.scene.add(block.mesh);
    cell.block = block;
    
    this.selectedBlock = null;
    this.updateBlockSelection();
    this.updateUI();
    this.showMessage(`建造了 ${blockData.name}`, 'success');
  }
  
  startGame() {
    this.gameState = 'playing';
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    this.lastTime = performance.now();
    this.gameLoop();
    this.showMessage('游戏开始！保护你的基地！', 'info');
  }
  
  gameLoop() {
    if (this.gameState !== 'playing') return;
    
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000 * this.gameSpeed;
    this.lastTime = currentTime;
    
    if (!this.isPaused) {
      this.update(deltaTime);
    }
    
    this.render();
    requestAnimationFrame(() => this.gameLoop());
  }
  
  update(deltaTime) {
    // 保存deltaTime供UI更新使用
    this.lastDeltaTime = deltaTime;
    
    // 更新时间系统
    this.updateTimeSystem(deltaTime);
    
    // 更新植物
    this.plants.forEach(plant => plant.update(deltaTime, this.zombies));
    
    // 更新僵尸
    this.zombies.forEach(zombie => zombie.update(deltaTime, this.world, this.basePosition));
    
    // 更新投射物
    this.projectiles.forEach(projectile => projectile.update(deltaTime));
    
    // 检查碰撞
    this.checkCollisions();
    
    // 清理死亡的对象
    this.cleanup();
    
    // 检查游戏结束条件
    this.checkGameOver();
    
    // 更新UI
    this.updateUI();
  }
  
  updateTimeSystem(deltaTime) {
    this.timeTimer += deltaTime;
    const cycleDuration = this.isDay ? gameData.gameSettings.dayDuration : gameData.gameSettings.nightDuration;
    
    this.timeProgress = this.timeTimer / cycleDuration;
    
    if (this.timeTimer >= cycleDuration) {
      this.timeTimer = 0;
      this.isDay = !this.isDay;
      this.showMessage(this.isDay ? '白天开始，准备防御！' : '夜晚来临，僵尸来袭！', 'warning');
      
      if (!this.isDay) {
        this.spawnWave();
      }
    }
    
    // 产生阳光（白天）
    if (this.isDay && Math.random() < 0.01) {
      this.resources.sun += 10;
    }
  }
  
   spawnWave() {
    // 大幅增强难度计算
    const baseZombieCount = 5; // 基础僵尸数量增加
    const waveMultiplier = Math.floor((this.currentWave - 1) / 2); // 每2波增加难度
    const zombieCount = Math.min(
      baseZombieCount + this.currentWave * 2.5 + waveMultiplier * 3, 
      40 // 最大僵尸数量增加
    );
    
    // 计算不同类型僵尸的比例
    const normalZombieRatio = Math.max(0.4, 1 - this.currentWave * 0.1); // 普通僵尸比例递减
    const minerZombieRatio = Math.min(0.4, this.currentWave * 0.08); // 矿工僵尸比例递增
    const bomberZombieRatio = Math.min(0.2, Math.max(0, (this.currentWave - 3) * 0.05)); // 第4波开始出现爆破僵尸
    
    // 创建僵尸类型概率数组
    const zombiePool = [];
    
    // 添加普通僵尸
    for (let i = 0; i < Math.floor(zombieCount * normalZombieRatio); i++) {
      zombiePool.push(gameData.zombies[0]); // 普通僵尸
    }
    
    // 添加矿工僵尸
    for (let i = 0; i < Math.floor(zombieCount * minerZombieRatio); i++) {
      zombiePool.push(gameData.zombies[1]); // 矿工僵尸
    }
    
    // 添加爆破僵尸（第4波开始）
    if (this.currentWave >= 4) {
      for (let i = 0; i < Math.floor(zombieCount * bomberZombieRatio); i++) {
        zombiePool.push(gameData.zombies[2]); // 爆破僵尸
      }
    }
    
    // 如果池子不够，用普通僵尸填充
    while (zombiePool.length < zombieCount) {
      zombiePool.push(gameData.zombies[0]);
    }
    
    // 随机打乱僵尸顺序
    for (let i = zombiePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [zombiePool[i], zombiePool[j]] = [zombiePool[j], zombiePool[i]];
    }
    
    // 大幅增加生成频率，随着波次增加间隔急剧减少
    const spawnInterval = Math.max(200, 1500 - this.currentWave * 150); // 生成间隔大幅递减
    
    for (let i = 0; i < zombiePool.length; i++) {
      setTimeout(() => {
        if (this.gameState === 'playing') {
          this.spawnZombieOfType(zombiePool[i]);
        }
      }, i * spawnInterval);
    }
    
    // 增强僵尸属性（每5波增加一次）
    if (this.currentWave % 5 === 0) {
      this.enhanceZombies();
    }
    
    const difficultyText = this.getDifficultyText();
    this.showMessage(`第 ${this.currentWave} 波僵尸来袭！${difficultyText}`, 'error');
  }
  
  spawnZombieOfType(zombieData) {
    // 大幅增强版生成，根据波次调整僵尸属性
    const enhancedZombieData = { ...zombieData };
    
    // 每波增加15%血量和伤害（原来5%）
    const enhancementFactor = 1 + (this.currentWave - 1) * 0.15;
    enhancedZombieData.health = Math.floor(zombieData.health * enhancementFactor);
    enhancedZombieData.damage = Math.floor(zombieData.damage * enhancementFactor);
    
    // 每2波增加速度（原来每3波）
    if (this.currentWave >= 2) {
      const speedBonus = Math.floor((this.currentWave - 1) / 2) * 0.2;
      enhancedZombieData.speed = zombieData.speed + speedBonus;
    }
    
    // 第5波开始，僵尸获得特殊能力
    if (this.currentWave >= 5) {
      enhancedZombieData.canBreakBlocks = true; // 可以破坏方块
      enhancedZombieData.regeneration = 2; // 每秒回血2点
    }
    
    // 第8波开始，僵尸获得更强能力
    if (this.currentWave >= 8) {
      enhancedZombieData.armor = 0.3; // 30%伤害减免
      enhancedZombieData.speed *= 1.5; // 额外50%速度
    }
    
    // 在边缘随机位置生成僵尸，增加多点生成
    const spawnPoints = this.getSpawnPoints();
    const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    
    const zombie = new Zombie(enhancedZombieData, spawnPoint.x, spawnPoint.z);
    this.zombies.push(zombie);
    this.scene.add(zombie.mesh);
  }
  
  getSpawnPoints() {
    const points = [];
    const margin = 2;
    
    // 四周边缘多个生成点
    for (let i = 0; i < 5; i++) {
      // 上边
      points.push({
        x: (Math.random() - 0.5) * (this.worldSize - margin * 2),
        z: -this.worldSize/2 + margin
      });
      
      // 下边
      points.push({
        x: (Math.random() - 0.5) * (this.worldSize - margin * 2),
        z: this.worldSize/2 - margin
      });
      
      // 左边
      points.push({
        x: -this.worldSize/2 + margin,
        z: (Math.random() - 0.5) * (this.worldSize - margin * 2)
      });
      
      // 右边
      points.push({
        x: this.worldSize/2 - margin,
        z: (Math.random() - 0.5) * (this.worldSize - margin * 2)
      });
    }
    
    return points;
  }
  
  enhanceZombies() {
    // 为当前存活的僵尸增加属性
    this.zombies.forEach(zombie => {
      zombie.health = Math.floor(zombie.health * 1.2);
      zombie.speed *= 1.1;
      
      // 视觉效果：僵尸变大表示增强
      if (zombie.mesh) {
        zombie.mesh.scale.multiplyScalar(1.05);
        
        // 添加增强光效
        const glowGeometry = new THREE.RingGeometry(0.8, 1.0, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: 0xff4444,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.y = 0.1;
        glow.rotation.x = -Math.PI / 2;
        zombie.mesh.add(glow);
        
        // 3秒后移除光效
        setTimeout(() => {
          if (zombie.mesh && glow.parent) {
            zombie.mesh.remove(glow);
          }
        }, 3000);
      }
    });
    
    this.showMessage('僵尸群获得了强化！', 'warning');
  }
  
  getDifficultyText() {
    if (this.currentWave <= 3) return '(普通难度)';
    if (this.currentWave <= 6) return '(困难难度)';
    if (this.currentWave <= 9) return '(专家难度)';
    return '(地狱难度)';
  }
  
  spawnZombie() {
    // 保留原有方法供其他地方调用
    const zombieTypes = gameData.zombies;
    const zombieData = zombieTypes[Math.floor(Math.random() * zombieTypes.length)];
    this.spawnZombieOfType(zombieData);
  }
  
  checkCollisions() {
    // 投射物与僵尸碰撞
    this.projectiles.forEach(projectile => {
      this.zombies.forEach(zombie => {
        if (projectile.checkCollision(zombie)) {
          zombie.takeDamage(projectile.damage);
          projectile.destroy();
          this.scene.remove(projectile.mesh);
        }
      });
    });
    
    // 僵尸与基地碰撞
    this.zombies.forEach(zombie => {
      const distance = Math.sqrt(
        Math.pow(zombie.position.x - this.basePosition.x, 2) +
        Math.pow(zombie.position.z - this.basePosition.z, 2)
      );
      
      if (distance < 1.5) {
        this.baseHealth -= zombie.damage;
        zombie.health = 0;
        this.showMessage(`基地受到攻击！生命值: ${this.baseHealth}`, 'error');
      }
    });
  }
  
  cleanup() {
    // 优化清理：使用倒序遍历避免索引问题，减少数组重建
    
    // 清理死亡的僵尸
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const zombie = this.zombies[i];
      if (zombie.health <= 0) {
        this.scene.remove(zombie.mesh);
        this.zombiesKilled++;
        this.resources.materials += Math.floor(Math.random() * 3) + 1;
        this.zombies.splice(i, 1);
      }
    }
    
    // 清理投射物
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      if (projectile.destroyed || projectile.position.y < -5) {
        this.scene.remove(projectile.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    
    // 清理植物
    for (let i = this.plants.length - 1; i >= 0; i--) {
      const plant = this.plants[i];
      if (plant.health <= 0) {
        plant.destroy();
        this.plants.splice(i, 1);
      }
    }
    
    // 检查波次完成
    if (!this.isDay && this.zombies.length === 0 && this.timeTimer > 10) {
      this.currentWave++;
      this.isDay = true;
      this.timeTimer = 0;
      this.showMessage(`第 ${this.currentWave - 1} 波完成！`, 'success');
      
      if (this.currentWave > gameData.gameSettings.maxWaves) {
        this.gameWin();
      }
    }
  }
  
  checkGameOver() {
    if (this.baseHealth <= 0) {
      this.gameOver();
    }
  }
  
  gameOver() {
    this.gameState = 'gameOver';
    document.getElementById('gameOverTitle').textContent = '游戏失败';
    document.getElementById('finalWave').textContent = this.currentWave - 1;
    document.getElementById('zombiesKilled').textContent = this.zombiesKilled;
    document.getElementById('gameTime').textContent = Math.floor((Date.now() - this.gameStartTime) / 60000);
    document.getElementById('gameOverScreen').classList.remove('hidden');
  }
  
  gameWin() {
    this.gameState = 'gameOver';
    document.getElementById('gameOverTitle').textContent = '胜利！';
    document.getElementById('finalWave').textContent = this.currentWave - 1;
    document.getElementById('zombiesKilled').textContent = this.zombiesKilled;
    document.getElementById('gameTime').textContent = Math.floor((Date.now() - this.gameStartTime) / 60000);
    document.getElementById('gameOverScreen').classList.remove('hidden');
  }
  
  togglePause() {
    this.isPaused = !this.isPaused;
    document.getElementById('pauseBtn').textContent = this.isPaused ? '继续' : '暂停';
  }
  
  toggleSpeed() {
    this.gameSpeed = this.gameSpeed === 1 ? 2 : 1;
    document.getElementById('speedBtn').textContent = this.gameSpeed === 1 ? '2x' : '1x';
  }
  
  updateUI() {
    // UI更新节流：每0.1秒更新一次而不是每帧
    this.uiUpdateTimer = (this.uiUpdateTimer || 0) + this.lastDeltaTime;
    if (this.uiUpdateTimer < 0.1) {
      return;
    }
    this.uiUpdateTimer = 0;
    
    // 缓存DOM元素引用以避免重复查询
    if (!this.uiElements) {
      this.uiElements = {
        sunCount: document.getElementById('sunCount'),
        materialCount: document.getElementById('materialCount'),
        currentWave: document.getElementById('currentWave'),
        baseHealth: document.getElementById('baseHealth'),
        timePhase: document.getElementById('timePhase'),
        timeProgress: document.getElementById('timeProgress'),
        plantItems: document.querySelectorAll('.plant-item'),
        blockItems: document.querySelectorAll('.block-item')
      };
    }
    
    // 只在值发生变化时更新DOM
    if (this.lastSunCount !== this.resources.sun) {
      this.uiElements.sunCount.textContent = this.resources.sun;
      this.lastSunCount = this.resources.sun;
    }
    
    if (this.lastMaterialCount !== this.resources.materials) {
      this.uiElements.materialCount.textContent = this.resources.materials;
      this.lastMaterialCount = this.resources.materials;
    }
    
    if (this.lastCurrentWave !== this.currentWave) {
      this.uiElements.currentWave.textContent = this.currentWave;
      this.lastCurrentWave = this.currentWave;
    }
    
    if (this.lastBaseHealth !== this.baseHealth) {
      this.uiElements.baseHealth.textContent = this.baseHealth;
      this.lastBaseHealth = this.baseHealth;
    }
    
    const timePhaseText = this.isDay ? '白天' : '夜晚';
    if (this.lastTimePhase !== timePhaseText) {
      this.uiElements.timePhase.textContent = timePhaseText;
      this.lastTimePhase = timePhaseText;
    }
    
    this.uiElements.timeProgress.style.width = `${this.timeProgress * 100}%`;
    
    // 更新植物可用性（减少频率）
    this.uiElements.plantItems.forEach((item, index) => {
      const plant = gameData.plants[index];
      const isDisabled = this.resources.sun < plant.cost;
      if (item.classList.contains('disabled') !== isDisabled) {
        item.classList.toggle('disabled', isDisabled);
      }
    });
    
    // 更新方块可用性（减少频率）
    this.uiElements.blockItems.forEach((item, index) => {
      const block = gameData.blocks[index];
      const isDisabled = this.resources.materials < block.cost;
      if (item.classList.contains('disabled') !== isDisabled) {
        item.classList.toggle('disabled', isDisabled);
      }
    });
  }
  
  showMessage(text, type = 'info') {
    const messagesContainer = document.getElementById('gameMessages');
    const message = document.createElement('div');
    message.className = `game-message ${type}`;
    message.textContent = text;
    messagesContainer.appendChild(message);
    
    // 自动移除旧消息
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 5000);
    
    // 限制消息数量
    while (messagesContainer.children.length > 5) {
      messagesContainer.removeChild(messagesContainer.firstChild);
    }
  }
  
  showStartScreen() {
    this.gameState = 'start';
    document.getElementById('startScreen').classList.remove('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
  }
  
  restart() {
    // 重置游戏状态
    this.resources = {
      sun: gameData.gameSettings.initialSun,
      materials: gameData.gameSettings.initialMaterials
    };
    this.baseHealth = gameData.gameSettings.baseHealth;
    this.currentWave = 1;
    this.isDay = true;
    this.timeProgress = 0;
    this.timeTimer = 0;
    this.zombiesKilled = 0;
    this.gameStartTime = Date.now();
    
    // 清理场景
    this.plants.forEach(plant => this.scene.remove(plant.mesh));
    this.zombies.forEach(zombie => this.scene.remove(zombie.mesh));
    this.projectiles.forEach(projectile => this.scene.remove(projectile.mesh));
    this.blocks.forEach(block => this.scene.remove(block.mesh));
    
    this.plants = [];
    this.zombies = [];
    this.projectiles = [];
    this.blocks = [];
    
    // 重置世界
    for (let x = -this.worldSize/2; x < this.worldSize/2; x++) {
      for (let z = -this.worldSize/2; z < this.worldSize/2; z++) {
        if (this.world[x] && this.world[x][z]) {
          this.world[x][z].plant = null;
          this.world[x][z].block = null;
        }
      }
    }
    
    this.startGame();
  }
  
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// 植物类
class Plant {
  constructor(data, x, z) {
    this.data = data;
    this.position = { x, z };
    this.health = data.health || 100;
    this.lastFireTime = 0;
    this.lastSunTime = 0;
    
    this.createMesh();
  }
  
  createMesh() {
    const group = new THREE.Group();
    
    switch (this.data.name) {
      case '豌豆射手':
        // 主体 - 绿色茎干
        const stemGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.8, 8);
        const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const stem = new THREE.Mesh(stemGeometry, stemMaterial);
        stem.position.y = 0.4;
        group.add(stem);
        
        // 射击口 - 深绿色
        const headGeometry = new THREE.SphereGeometry(0.3, 12, 8);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0x006400 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.9;
        group.add(head);
        
        // 射击管
        const tubeGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8);
        const tubeMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F2F });
        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        tube.position.set(0.25, 0.9, 0);
        tube.rotation.z = -Math.PI / 2;
        group.add(tube);
        
        // 叶子
        const leafGeometry = new THREE.PlaneGeometry(0.3, 0.15);
        const leafMaterial = new THREE.MeshLambertMaterial({ 
          color: 0x32CD32, 
          side: THREE.DoubleSide 
        });
        const leaf1 = new THREE.Mesh(leafGeometry, leafMaterial);
        leaf1.position.set(-0.2, 0.6, 0);
        leaf1.rotation.z = Math.PI / 4;
        group.add(leaf1);
        
        const leaf2 = new THREE.Mesh(leafGeometry, leafMaterial);
        leaf2.position.set(0.2, 0.7, 0);
        leaf2.rotation.z = -Math.PI / 4;
        group.add(leaf2);
        
        // 攻击范围指示器（默认隐藏）
        this.createRangeIndicator(group);
        break;
        
      case '向日葵':
        // 茎干
        const sunStemGeometry = new THREE.CylinderGeometry(0.1, 0.15, 1.0, 8);
        const sunStemMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const sunStem = new THREE.Mesh(sunStemGeometry, sunStemMaterial);
        sunStem.position.y = 0.5;
        group.add(sunStem);
        
        // 花盘中心 - 棕色
        const centerGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
        const centerMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const center = new THREE.Mesh(centerGeometry, centerMaterial);
        center.position.y = 1.1;
        group.add(center);
        
        // 花瓣 - 黄色
        const petalGeometry = new THREE.SphereGeometry(0.08, 8, 6);
        const petalMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const petal = new THREE.Mesh(petalGeometry, petalMaterial);
          petal.position.set(
            Math.cos(angle) * 0.22,
            1.1,
            Math.sin(angle) * 0.22
          );
          petal.scale.set(1, 0.5, 1.5);
          group.add(petal);
        }
        
        // 叶子
        const sunLeafGeometry = new THREE.PlaneGeometry(0.4, 0.2);
        const sunLeafMaterial = new THREE.MeshLambertMaterial({ 
          color: 0x32CD32, 
          side: THREE.DoubleSide 
        });
        const sunLeaf1 = new THREE.Mesh(sunLeafGeometry, sunLeafMaterial);
        sunLeaf1.position.set(-0.25, 0.4, 0);
        sunLeaf1.rotation.z = Math.PI / 6;
        group.add(sunLeaf1);
        
        const sunLeaf2 = new THREE.Mesh(sunLeafGeometry, sunLeafMaterial);
        sunLeaf2.position.set(0.25, 0.5, 0);
        sunLeaf2.rotation.z = -Math.PI / 6;
        group.add(sunLeaf2);
        break;
        
      case '坚果墙':
        // 主体 - 简化的坚果形状（减少多边形数量）
        const nutGeometry = new THREE.SphereGeometry(0.45, 8, 6); // 减少分段数
        const nutMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // 使用更简单的材质
        const nut = new THREE.Mesh(nutGeometry, nutMaterial);
        nut.position.y = 0.45;
        nut.scale.set(1, 0.9, 1);
        group.add(nut);
        
        // 简化的坚果壳纹理 - 只保留一个环
        const shellGeometry = new THREE.TorusGeometry(0.38, 0.03, 4, 8); // 减少分段数
        const shellMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const shell = new THREE.Mesh(shellGeometry, shellMaterial);
        shell.position.y = 0.45;
        shell.rotation.x = Math.PI / 2;
        group.add(shell);
        
        // 简化的眼睛
        const eyeGeometry = new THREE.SphereGeometry(0.06, 6, 4); // 减少分段数
        const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.15, 0.55, 0.35);
        group.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.15, 0.55, 0.35);
        group.add(rightEye);
        
        // 简化的嘴巴
        const mouthGeometry = new THREE.BoxGeometry(0.2, 0.03, 0.02);
        const mouthMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, 0.35, 0.4);
        group.add(mouth);
        
        // 简化的底座
        const baseGeometry = new THREE.CylinderGeometry(0.35, 0.4, 0.25, 8); // 减少分段数
        const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.125;
        group.add(base);
        break;
        
      case '樱桃炸弹':
        // 两个樱桃
        const cherryGeometry = new THREE.SphereGeometry(0.2, 12, 8);
        const cherryMaterial = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
        
        const cherry1 = new THREE.Mesh(cherryGeometry, cherryMaterial);
        cherry1.position.set(-0.15, 0.6, 0);
        group.add(cherry1);
        
        const cherry2 = new THREE.Mesh(cherryGeometry, cherryMaterial);
        cherry2.position.set(0.15, 0.5, 0);
        group.add(cherry2);
        
        // 茎
        const cherryStemGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6);
        const cherryStemMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        
        const stem1 = new THREE.Mesh(cherryStemGeometry, cherryStemMaterial);
        stem1.position.set(-0.15, 0.75, 0);
        group.add(stem1);
        
        const stem2 = new THREE.Mesh(cherryStemGeometry, cherryStemMaterial);
        stem2.position.set(0.15, 0.65, 0);
        group.add(stem2);
        
        // 叶子
        const cherryLeafGeometry = new THREE.PlaneGeometry(0.2, 0.1);
        const cherryLeafMaterial = new THREE.MeshLambertMaterial({ 
          color: 0x32CD32, 
          side: THREE.DoubleSide 
        });
        const cherryLeaf = new THREE.Mesh(cherryLeafGeometry, cherryLeafMaterial);
        cherryLeaf.position.set(0, 0.85, 0);
        group.add(cherryLeaf);
        break;
        
      default:
        // 默认形状
        const defaultGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.8);
        const defaultMaterial = new THREE.MeshLambertMaterial({ color: this.data.color });
        const defaultMesh = new THREE.Mesh(defaultGeometry, defaultMaterial);
        defaultMesh.position.y = 0.6;
        group.add(defaultMesh);
        break;
    }
    
    this.mesh = group;
    this.mesh.position.set(this.position.x, 0, this.position.z);
    
    // 简化阴影处理 - 只让主要物体投射阴影，而不是每个子对象
    // 这可以大幅减少阴影计算量
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false; // 方块不需要接收阴影
    
    // 不为子对象单独设置阴影，减少渲染负担
  }
  
  createRangeIndicator(group) {
    if (this.data.range) {
      // 创建攻击范围圆圈（默认隐藏）
      const rangeGeometry = new THREE.RingGeometry(this.data.range - 0.1, this.data.range, 32);
      const rangeMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
      });
      
      this.rangeIndicator = new THREE.Mesh(rangeGeometry, rangeMaterial);
      this.rangeIndicator.rotation.x = -Math.PI / 2;
      this.rangeIndicator.position.y = 0.05;
      this.rangeIndicator.visible = false; // 默认隐藏
      group.add(this.rangeIndicator);
    }
  }
  
  showRange() {
    if (this.rangeIndicator) {
      this.rangeIndicator.visible = true;
    }
  }
  
  hideRange() {
    if (this.rangeIndicator) {
      this.rangeIndicator.visible = false;
    }
  }
  
  // 清理植物资源
  destroy() {
    this.hideAimingLine();
    this.hideRange();
    if (this.mesh && game && game.scene) {
      game.scene.remove(this.mesh);
    }
  }
  
  update(deltaTime, zombies) {
    if (this.data.name === '向日葵') {
      this.produceSun(deltaTime);
    } else if (this.data.name === '樱桃炸弹') {
      // 樱桃炸弹自动爆炸逻辑
      this.cherryBombTimer = (this.cherryBombTimer || 0) + deltaTime;
      
      // 检查是否有僵尸在范围内或者3秒后自动爆炸
      const shouldExplode = this.cherryBombTimer >= 3 || this.findTarget(zombies);
      
      if (shouldExplode) {
        this.explode();
        return; // 爆炸后停止更新
      }
      
      // 闪烁效果提示即将爆炸
      if (this.cherryBombTimer > 2) {
        const flashRate = 5; // 每秒闪烁5次
        const flashAlpha = Math.sin(this.cherryBombTimer * flashRate * Math.PI * 2) * 0.5 + 0.5;
        if (this.mesh && this.mesh.material) {
          this.mesh.material.opacity = 0.5 + flashAlpha * 0.5;
          this.mesh.material.transparent = true;
        }
      }
    } else if (this.data.damage) {
      this.attack(deltaTime, zombies);
    }
  }
  
  produceSun(deltaTime) {
    this.lastSunTime += deltaTime;
    if (this.lastSunTime >= this.data.interval) {
      if (game) {
        game.resources.sun += this.data.sunProduction;
        this.lastSunTime = 0;
        game.showMessage(`+${this.data.sunProduction} 阳光`, 'success');
      }
    }
  }
  
  attack(deltaTime, zombies) {
    this.lastFireTime += deltaTime;
    
    // 植物摇摆动画
    if (this.mesh) {
      this.animationTime = (this.animationTime || 0) + deltaTime;
      const swayAmount = 0.05;
      const swaySpeed = 2;
      this.mesh.rotation.z = Math.sin(this.animationTime * swaySpeed) * swayAmount;
    }
    
    // 优化目标搜索：添加冷却时间避免每帧搜索
    this.targetSearchCooldown = (this.targetSearchCooldown || 0) - deltaTime;
    if (this.targetSearchCooldown <= 0) {
      this.currentTarget = this.findTarget(zombies);
      this.targetSearchCooldown = 0.2; // 每0.2秒搜索一次目标
    }
    
    // 检查当前目标是否仍然有效
    if (this.currentTarget && this.currentTarget.health <= 0) {
      this.currentTarget = null;
    }
    
    if (this.currentTarget) {
      this.aimAt(this.currentTarget);
      
      // 显示瞄准线（仅在有目标时）
      this.showAimingLine(this.currentTarget);
      
      // 开火
      if (this.lastFireTime >= this.data.fireRate) {
        this.fire(this.currentTarget);
        this.lastFireTime = 0;
        
        // 射击后摇效果
        this.createMuzzleFlash();
        this.createShootingRecoil();
      }
    } else {
      // 没有目标时隐藏瞄准线
      this.hideAimingLine();
    }
  }
  
  showAimingLine(target) {
    if (this.data.name !== '豌豆射手') return;
    
    // 移除旧的瞄准线
    this.hideAimingLine();
    
    // 创建瞄准线
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      this.position.x, 1, this.position.z,
      target.position.x, 1, target.position.z
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      linewidth: 2
    });
    
    this.aimingLine = new THREE.Line(geometry, material);
    if (game && game.scene) {
      game.scene.add(this.aimingLine);
    }
  }
  
  hideAimingLine() {
    if (this.aimingLine && game && game.scene) {
      game.scene.remove(this.aimingLine);
      this.aimingLine = null;
    }
  }
  
  createMuzzleFlash() {
    if (this.data.name !== '豌豆射手' || !this.mesh) return;
    
    // 创建射击闪光效果
    const flashGeometry = new THREE.SphereGeometry(0.15, 8, 6);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8
    });
    
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.set(0.4, 0.9, 0); // 射击管位置
    this.mesh.add(flash);
    
    // 0.1秒后移除闪光
    setTimeout(() => {
      if (this.mesh && flash.parent) {
        this.mesh.remove(flash);
      }
    }, 100);
  }
  
  findTarget(zombies) {
    let bestTarget = null;
    let bestScore = -1;
    
    zombies.forEach(zombie => {
      const distance = Math.sqrt(
        Math.pow(zombie.position.x - this.position.x, 2) +
        Math.pow(zombie.position.z - this.position.z, 2)
      );
      
      // 只考虑在射程内的僵尸
      if (distance <= this.data.range) {
        // 智能目标选择算法
        // 考虑因素：距离、僵尸血量、僵尸威胁度
        let score = 0;
        
        // 距离因子（越近越优先）
        const distanceScore = (this.data.range - distance) / this.data.range;
        score += distanceScore * 50;
        
        // 血量因子（血量越少越优先，便于击杀）
        const healthRatio = zombie.health / zombie.data.health;
        if (healthRatio < 0.3) {
          score += 30; // 残血僵尸优先级很高
        } else if (healthRatio < 0.6) {
          score += 15;
        }
        
        // 僵尸类型威胁度
        switch (zombie.data.name) {
          case '爆破僵尸':
            score += 40; // 爆破僵尸威胁最大
            break;
          case '矿工僵尸':
            score += 20;
            break;
          case '普通僵尸':
            score += 10;
            break;
        }
        
        // 预判僵尸移动位置的命中概率
        const predictedHitChance = this.calculateHitProbability(zombie, distance);
        score += predictedHitChance * 20;
        
        if (score > bestScore) {
          bestScore = score;
          bestTarget = zombie;
        }
      }
    });
    
    return bestTarget;
  }
  
  calculateHitProbability(zombie, distance) {
    // 计算投射物到达目标所需时间
    const projectileSpeed = 8;
    const timeToHit = distance / projectileSpeed;
    
    // 预测僵尸在投射物到达时的位置
    const predictedX = zombie.position.x + zombie.speed * timeToHit * Math.cos(zombie.mesh ? zombie.mesh.rotation.y : 0);
    const predictedZ = zombie.position.z + zombie.speed * timeToHit * Math.sin(zombie.mesh ? zombie.mesh.rotation.y : 0);
    
    // 计算预测位置与当前瞄准位置的偏差
    const deviation = Math.sqrt(
      Math.pow(predictedX - zombie.position.x, 2) +
      Math.pow(predictedZ - zombie.position.z, 2)
    );
    
    // 返回命中概率（偏差越小概率越高）
    return Math.max(0, 1 - deviation / 2);
  }
  
  aimAt(target) {
    if (this.data.name === '豌豆射手' && this.mesh) {
      // 计算目标方向
      const dx = target.position.x - this.position.x;
      const dz = target.position.z - this.position.z;
      const angle = Math.atan2(dx, dz);
      
      // 平滑旋转整个植物朝向目标
      const currentAngle = this.mesh.rotation.y;
      let targetAngle = angle;
      
      // 处理角度包装问题
      let diff = targetAngle - currentAngle;
      if (diff > Math.PI) diff -= 2 * Math.PI;
      if (diff < -Math.PI) diff += 2 * Math.PI;
      
      // 平滑旋转（每帧旋转5度）
      const rotationSpeed = Math.PI / 36; // 5度
      if (Math.abs(diff) > rotationSpeed) {
        this.mesh.rotation.y += Math.sign(diff) * rotationSpeed;
      } else {
        this.mesh.rotation.y = targetAngle;
      }
      
      // 记录当前瞄准角度用于投射物发射
      this.aimAngle = this.mesh.rotation.y;
      
      // 添加瞄准视觉效果 - 射击管朝向目标
      if (this.mesh.children.length > 2) {
        // 找到射击管（第三个子对象）
        const tube = this.mesh.children[2];
        if (tube) {
          // 计算射击管的倾斜角度来预瞄准
          const distance = Math.sqrt(dx * dx + dz * dz);
          const elevationAngle = Math.atan2(0.5, distance); // 轻微上抬
          tube.rotation.x = -elevationAngle;
        }
      }
    }
  }
  
  createShootingRecoil() {
    if (!this.mesh) return;
    
    // 射击后坐力动画
    const originalScale = this.mesh.scale.clone();
    this.mesh.scale.multiplyScalar(0.9);
    
    setTimeout(() => {
      if (this.mesh) {
        this.mesh.scale.copy(originalScale);
      }
    }, 100);
  }
  
  fire(target) {
    if (this.data.name === '樱桃炸弹') {
      this.explode(target);
    } else {
      if (game) {
        // 预瞄准：计算投射物到达目标所需时间，预测目标位置
        const distance = Math.sqrt(
          Math.pow(target.position.x - this.position.x, 2) +
          Math.pow(target.position.z - this.position.z, 2)
        );
        
        const projectileSpeed = 8;
        const timeToHit = distance / projectileSpeed;
        
        // 预测目标位置
        let targetX = target.position.x;
        let targetZ = target.position.z;
        
        if (target.mesh && target.speed) {
          // 基于僵尸当前移动方向预测
          const zombieAngle = target.mesh.rotation.y || 0;
          targetX += target.speed * timeToHit * Math.sin(zombieAngle);
          targetZ += target.speed * timeToHit * Math.cos(zombieAngle);
        }
        
        const predictedTarget = { x: targetX, z: targetZ };
        const projectile = new Projectile(this.position, predictedTarget, this.data.damage);
        game.projectiles.push(projectile);
        game.scene.add(projectile.mesh);
      }
    }
  }
  
  explode() {
    if (!game) return;
    
    // 创建爆炸效果
    const explosionGeometry = new THREE.SphereGeometry(this.data.range, 16, 12);
    const explosionMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff4500, 
      transparent: true, 
      opacity: 0.8 
    });
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(this.mesh.position);
    game.scene.add(explosion);
    
    // 创建火花效果
    for (let i = 0; i < 20; i++) {
      const sparkGeometry = new THREE.SphereGeometry(0.05, 6, 4);
      const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 });
      const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
      
      const angle = (i / 20) * Math.PI * 2;
      const distance = Math.random() * this.data.range;
      spark.position.copy(this.mesh.position);
      spark.position.x += Math.cos(angle) * distance;
      spark.position.z += Math.sin(angle) * distance;
      spark.position.y += Math.random() * 2;
      
      game.scene.add(spark);
      
      // 移除火花
      setTimeout(() => {
        game.scene.remove(spark);
      }, 1000);
    }
    
    // 爆炸动画
    let scale = 0;
    const explosionInterval = setInterval(() => {
      scale += 0.2;
      explosion.scale.setScalar(scale);
      explosion.material.opacity = Math.max(0, 0.8 - scale * 0.3);
      
      if (scale >= 3) {
        clearInterval(explosionInterval);
        game.scene.remove(explosion);
      }
    }, 50);
    
    // 伤害范围内的僵尸
    game.zombies.forEach(zombie => {
      const distance = Math.sqrt(
        Math.pow(zombie.position.x - this.position.x, 2) +
        Math.pow(zombie.position.z - this.position.z, 2)
      );
      
      if (distance <= this.data.range) {
        zombie.takeDamage(this.data.damage);
        
        // 击退效果
        const knockbackForce = (this.data.range - distance) / this.data.range;
        const dx = zombie.position.x - this.position.x;
        const dz = zombie.position.z - this.position.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        zombie.position.x += (dx / len) * knockbackForce * 2;
        zombie.position.z += (dz / len) * knockbackForce * 2;
      }
    });
    
    // 播放爆炸消息
    game.showMessage('樱桃炸弹爆炸！', 'success');
    
    // 移除植物
    this.health = 0;
    this.destroy();
  }
}

// 僵尸类
class Zombie {
  constructor(data, x, z) {
    this.data = data;
    this.position = { x, z };
    this.health = data.health;
    this.speed = data.speed;
    this.target = { x: 0, z: 0 };
    this.damage = data.damage;
    
    // 路径规划相关
    this.path = [];
    this.currentPathIndex = 0;
    this.pathfindingCooldown = 0;
    this.stuckTimer = 0;
    this.lastPosition = { x, z };
    this.isJumping = false;
    this.jumpProgress = 0;
    this.jumpStartPos = null;
    this.jumpTargetPos = null;
    
    this.createMesh();
  }
  
  createMesh() {
    const group = new THREE.Group();
    
    switch (this.data.name) {
      case '普通僵尸':
        // 身体
        const bodyGeometry = new THREE.BoxGeometry(0.5, 1.0, 0.3);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x708090 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        group.add(body);
        
        // 头部
        const headGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0x9ACD32 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.2;
        // 手臂
// 创建僵尸手臂
const armGeometry = new THREE.BoxGeometry(0.2, 0.6, 0.2);
const armMaterial = new THREE.MeshLambertMaterial({ color: 0x9ACD32 });

// 左手臂
const leftArm = new THREE.Mesh(armGeometry, armMaterial);
leftArm.position.set(-0.35, 0.7, 0);
leftArm.rotation.z = Math.PI / 6;
leftArm.userData = { isArm: true };
group.add(leftArm);

// 右手臂
const rightArm = new THREE.Mesh(armGeometry, armMaterial);
rightArm.position.set(0.35, 0.7, 0);
rightArm.rotation.z = -Math.PI / 6;
rightArm.userData = { isArm: true };
group.add(rightArm);
        
        // 腿部
        const legGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.15);
        const legMaterial = new THREE.MeshLambertMaterial({ color: 0x708090 });
        
        const leg1 = new THREE.Mesh(legGeometry, legMaterial);
        leg1.position.set(-0.1, 0.2, 0);
        group.add(leg1);
        
        const leg2 = new THREE.Mesh(legGeometry, legMaterial);
        leg2.position.set(0.1, 0.2, 0);
        group.add(leg2);
        break;
        
      case '矿工僵尸':
        // 身体（棕色工作服）
        const minerBodyGeometry = new THREE.BoxGeometry(0.5, 1.0, 0.3);
        const minerBodyMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const minerBody = new THREE.Mesh(minerBodyGeometry, minerBodyMaterial);
        minerBody.position.y = 0.5;
        group.add(minerBody);
        
        // 头部
        const minerHeadGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const minerHeadMaterial = new THREE.MeshLambertMaterial({ color: 0x9ACD32 });
        const minerHead = new THREE.Mesh(minerHeadGeometry, minerHeadMaterial);
        minerHead.position.y = 1.2;
        group.add(minerHead);
        
        // 安全帽
        const helmetGeometry = new THREE.SphereGeometry(0.25, 8, 6);
        const helmetMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
        helmet.position.y = 1.35;
        helmet.scale.set(1, 0.6, 1);
        group.add(helmet);
        
        // 镐子
        const pickaxeHandleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8);
        const pickaxeHandleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const pickaxeHandle = new THREE.Mesh(pickaxeHandleGeometry, pickaxeHandleMaterial);
        pickaxeHandle.position.set(0.3, 0.8, 0);
        pickaxeHandle.rotation.z = -Math.PI / 4;
        group.add(pickaxeHandle);
        
        const pickaxeHeadGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.1);
        const pickaxeHeadMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
        const pickaxeHead = new THREE.Mesh(pickaxeHeadGeometry, pickaxeHeadMaterial);
        pickaxeHead.position.set(0.5, 1.1, 0);
        group.add(pickaxeHead);
        break;
        
      case '爆破僵尸':
        // 身体（红色）
        const bombBodyGeometry = new THREE.BoxGeometry(0.5, 1.0, 0.3);
        const bombBodyMaterial = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
        const bombBody = new THREE.Mesh(bombBodyGeometry, bombBodyMaterial);
        bombBody.position.y = 0.5;
        group.add(bombBody);
        
        // 头部
        const bombHeadGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const bombHeadMaterial = new THREE.MeshLambertMaterial({ color: 0x9ACD32 });
        const bombHead = new THREE.Mesh(bombHeadGeometry, bombHeadMaterial);
        bombHead.position.y = 1.2;
        group.add(bombHead);
        
        // 炸弹背包
        const bombGeometry = new THREE.SphereGeometry(0.3, 8, 6);
        const bombMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
        const bomb = new THREE.Mesh(bombGeometry, bombMaterial);
        bomb.position.set(0, 0.8, -0.3);
        group.add(bomb);
        
        // 引线
        const fuseGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6);
        const fuseMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const fuse = new THREE.Mesh(fuseGeometry, fuseMaterial);
        fuse.position.set(0, 1.0, -0.3);
        group.add(fuse);
        
        // 火花效果
        const sparkGeometry = new THREE.SphereGeometry(0.03, 6, 4);
        const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xFF4500 });
        const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
        spark.position.set(0, 1.1, -0.3);
        group.add(spark);
        break;
        
      default:
        // 默认僵尸
        const defaultGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        const defaultMaterial = new THREE.MeshLambertMaterial({ color: this.data.color });
        const defaultMesh = new THREE.Mesh(defaultGeometry, defaultMaterial);
        defaultMesh.position.y = 0.9;
        group.add(defaultMesh);
        break;
    }
    
    this.mesh = group;
  }

  update(deltaTime, world, basePosition) {
    this.pathfindingCooldown -= deltaTime;
    this.stuckTimer += deltaTime;
    
    // 初始化目标搜索冷却时间
    this.targetSearchCooldown = (this.targetSearchCooldown || 0) - deltaTime;
    
    // 僵尸坦度随时间提升（每30秒增加5%血量和护甲）
    this.tankUpgradeTimer = (this.tankUpgradeTimer || 0) + deltaTime;
    if (this.tankUpgradeTimer >= 30) {
      this.data.health *= 1.05;
      this.health *= 1.05;
      this.armor = (this.armor || 0) + 0.02; // 增加2%护甲
      this.tankUpgradeTimer = 0;
    }
    
    // 僵尸特殊能力处理
    if (this.data.regeneration && this.health < this.data.health) {
      this.health = Math.min(this.data.health, this.health + this.data.regeneration * deltaTime);
    }
    
    // 破坏方块能力
    if (this.data.canBreakBlocks) {
      this.tryBreakNearbyBlocks(world, deltaTime);
    }
    
    // 智能目标选择：优先攻击植物而不是直接冲向基地（添加冷却时间优化性能）
    if (this.targetSearchCooldown <= 0) {
      this.currentTarget = this.findNearbyTarget(world, basePosition);
      this.targetSearchCooldown = 0.5; // 每0.5秒搜索一次目标，而不是每帧
    }
    
    if (this.currentTarget) {
      // 检查目标是否仍然有效
      if (this.currentTarget.plant && this.currentTarget.plant.health > 0) {
        this.attackTarget(this.currentTarget, deltaTime);
        return; // 正在攻击植物时不移动
      } else {
        this.currentTarget = null; // 清除无效目标
      }
    }
    
    // 添加僵尸行走动画
    this.animationTime = (this.animationTime || 0) + deltaTime;
    if (this.mesh) {
      // 摇摆动画
      const walkSpeed = this.speed * 3;
      this.mesh.rotation.z = Math.sin(this.animationTime * walkSpeed) * 0.1;
      
      // 上下颠簸
      const bobAmount = 0.05;
      const bobSpeed = walkSpeed * 2;
      this.bobOffset = Math.sin(this.animationTime * bobSpeed) * bobAmount;
      
      // 手臂摆动（如果有手臂子对象）
      this.mesh.children.forEach((child, index) => {
        if (child.userData && child.userData.isArm) {
          const armSwing = Math.sin(this.animationTime * walkSpeed + index * Math.PI) * 0.3;
          child.rotation.x = armSwing;
        }
      });
    }
    
    // 检查是否被卡住
    const distanceMoved = Math.sqrt(
      Math.pow(this.position.x - this.lastPosition.x, 2) +
      Math.pow(this.position.z - this.lastPosition.z, 2)
    );
    
    if (distanceMoved < 0.01) {
      this.stuckTimer += deltaTime;
    } else {
      this.stuckTimer = 0;
      this.lastPosition = { x: this.position.x, z: this.position.z };
    }
    
    // 如果被卡住超过2秒或路径为空，重新规划路径
    if (this.stuckTimer > 2 || this.path.length === 0 || this.pathfindingCooldown <= 0) {
      this.findPath(world, basePosition);
      this.pathfindingCooldown = 3; // 3秒后才能再次规划路径
    }
    
    // 处理跳跃动画
    if (this.isJumping) {
      this.updateJump(deltaTime);
    } else {
      this.followPath(deltaTime, world);
    }
    
    const yPosition = (this.isJumping ? this.getJumpHeight() : 0) + (this.bobOffset || 0);
    this.mesh.position.set(this.position.x, yPosition, this.position.z);
    
    // 如果被卡住超过2秒或路径为空，重新规划路径
    if (this.stuckTimer > 2 || this.path.length === 0 || this.pathfindingCooldown <= 0) {
      this.findPath(world, basePosition);
      this.pathfindingCooldown = 3; // 3秒后才能再次规划路径
    }
    
    // 处理跳跃动画
    if (this.isJumping) {
      this.updateJump(deltaTime);
    } else {
      this.followPath(deltaTime, world);
    }
    
    this.mesh.position.set(this.position.x, this.isJumping ? this.getJumpHeight() : 0, this.position.z);
  }
  
  moveTowardsBase(deltaTime, basePosition) {
    const dx = basePosition.x - this.position.x;
    const dz = basePosition.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance > 0.1) {
      const moveDistance = this.speed * deltaTime;
      this.position.x += (dx / distance) * moveDistance;
      this.position.z += (dz / distance) * moveDistance;
    }
  }

  // 简单的A*路径规划算法
  findPath(world, basePosition) {
    const worldSize = this.getWorldSize(world);
    const startX = Math.floor(this.position.x + worldSize/2);
    const startZ = Math.floor(this.position.z + worldSize/2);
    const endX = Math.floor(basePosition.x + worldSize/2);
    const endZ = Math.floor(basePosition.z + worldSize/2);
    
    // 简化版路径规划：直线路径 + 障碍物绕行
    this.path = this.calculateSimplePath(world, startX, startZ, endX, endZ, worldSize);
    this.currentPathIndex = 0;
  }
  
  getWorldSize(world) {
    return Array.isArray(world) ? world.length : 20;
  }
  
  calculateSimplePath(world, startX, startZ, endX, endZ, worldSize) {
    const path = [];
    
    // 直线插值路径
    const dx = endX - startX;
    const dz = endZ - startZ;
    const steps = Math.max(Math.abs(dx), Math.abs(dz));
    
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      let x = Math.floor(startX + dx * t);
      let z = Math.floor(startZ + dz * t);
      
      // 边界检查
      x = Math.max(0, Math.min(worldSize - 1, x));
      z = Math.max(0, Math.min(worldSize - 1, z));
      
      // 检查是否有障碍物
      if (this.hasObstacle(world, x, z, worldSize)) {
        // 尝试绕行
        const detourPath = this.findDetour(world, x, z, endX, endZ, worldSize);
        if (detourPath.length > 0) {
          path.push(...detourPath);
          continue;
        }
      }
      
      // 转换回世界坐标
      const worldX = x - worldSize / 2;
      const worldZ = z - worldSize / 2;
      path.push({ x: worldX, z: worldZ });
    }
    
    return path;
  }
  
  hasObstacle(world, x, z, worldSize) {
    if (!Array.isArray(world) || x < 0 || x >= worldSize || z < 0 || z >= worldSize) {
      return true;
    }
    
    const cell = world[x] && world[x][z];
    // 检查所有类型的方块（土方块、石方块、铁方块）和坚果墙
    return cell && (cell.block || (cell.plant && (cell.plant.data.name === '坚果墙' || cell.plant.data.name === '樱桃炸弹')));
  }
  
  findDetour(world, obstacleX, obstacleZ, endX, endZ, worldSize) {
    const detour = [];
    const directions = [
      { x: -1, z: 0 }, { x: 1, z: 0 },  // 左右
      { x: 0, z: -1 }, { x: 0, z: 1 },  // 上下
      { x: -1, z: -1 }, { x: 1, z: -1 }, { x: -1, z: 1 }, { x: 1, z: 1 } // 对角线
    ];
    
    // 尝试找到绕过障碍物的路径
    for (const dir of directions) {
      const newX = obstacleX + dir.x;
      const newZ = obstacleZ + dir.z;
      
      if (!this.hasObstacle(world, newX, newZ, worldSize)) {
        const worldX = newX - worldSize / 2;
        const worldZ = newZ - worldSize / 2;
        
        // 检查这个绕行点是否更接近目标
        const distToTarget = Math.sqrt(
          Math.pow(newX - endX, 2) + Math.pow(newZ - endZ, 2)
        );
        
        detour.push({ x: worldX, z: worldZ });
        return detour;
      }
    }
    
    // 如果无法绕行，尝试跳跃
    if (this.canJumpOver(world, obstacleX, obstacleZ, worldSize)) {
      const worldX = obstacleX - worldSize / 2;
      const worldZ = obstacleZ - worldSize / 2;
      detour.push({ x: worldX, z: worldZ, jump: true });
    }
    
    return detour;
  }
  
  canJumpOver(world, x, z, worldSize) {
    // 检查是否可以跳过这个障碍物（仅限于单个方块）
    if (x < 0 || x >= worldSize || z < 0 || z >= worldSize) {
      return false;
    }
    const cell = world[x] && world[x][z];
    return cell && cell.block && cell.block.data.name !== '铁方块';
  }
  
  followPath(deltaTime, world) {
    if (this.path.length === 0 || this.currentPathIndex >= this.path.length) {
      return;
    }
    
    const targetPoint = this.path[this.currentPathIndex];
    const dx = targetPoint.x - this.position.x;
    const dz = targetPoint.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance < 0.3) {
      // 到达当前路径点
      this.currentPathIndex++;
      
      // 检查是否需要跳跃
      if (targetPoint.jump && !this.isJumping) {
        this.startJump(targetPoint);
        return;
      }
    } else {
      // 向目标点移动
      const moveDistance = this.speed * deltaTime;
      this.position.x += (dx / distance) * moveDistance;
      this.position.z += (dz / distance) * moveDistance;
      
      // 更新僵尸朝向
      if (this.mesh) {
        const angle = Math.atan2(dx, dz);
        this.mesh.rotation.y = angle;
      }
    }
  }
  
  startJump(targetPoint) {
    this.isJumping = true;
    this.jumpProgress = 0;
    this.jumpStartPos = { x: this.position.x, z: this.position.z };
    this.jumpTargetPos = { x: targetPoint.x, z: targetPoint.z };
  }
  
  updateJump(deltaTime) {
    const jumpSpeed = 2; // 跳跃速度
    this.jumpProgress += deltaTime * jumpSpeed;
    
    if (this.jumpProgress >= 1) {
      // 跳跃完成
      this.isJumping = false;
      this.position.x = this.jumpTargetPos.x;
      this.position.z = this.jumpTargetPos.z;
      this.jumpProgress = 0;
    } else {
      // 跳跃中，插值位置
      const t = this.jumpProgress;
      this.position.x = this.jumpStartPos.x + (this.jumpTargetPos.x - this.jumpStartPos.x) * t;
      this.position.z = this.jumpStartPos.z + (this.jumpTargetPos.z - this.jumpStartPos.z) * t;
    }
  }
  
  getJumpHeight() {
    if (!this.isJumping) return 0;
    
    // 抛物线跳跃轨迹
    const t = this.jumpProgress;
    const maxHeight = 1.5;
    return maxHeight * 4 * t * (1 - t);
  }
  
  takeDamage(damage) {
    // 护甲减伤
    let actualDamage = damage;
    if (this.data.armor) {
      actualDamage = damage * (1 - this.data.armor);
    }
    
    this.health -= actualDamage;
    
    // 受伤效果 - 让整个僵尸变红
    this.mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const originalColor = child.material.color.clone();
        child.material.color.setHex(0xff0000);
        setTimeout(() => {
          if (child.material) {
            child.material.color = originalColor;
          }
        }, 100);
      }
    });
  }
  
  findNearbyTarget(world, basePosition) {
    const worldSize = this.getWorldSize(world);
    const searchRadius = 1.5; // 减小搜索半径以提高性能
    let bestTarget = null;
    let bestPriority = -1;
    
    const myX = Math.floor(this.position.x + worldSize / 2);
    const myZ = Math.floor(this.position.z + worldSize / 2);
    
    // 优化搜索：从最近的格子开始搜索
    const searchOrder = [];
    for (let dx = -Math.ceil(searchRadius); dx <= Math.ceil(searchRadius); dx++) {
      for (let dz = -Math.ceil(searchRadius); dz <= Math.ceil(searchRadius); dz++) {
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance <= searchRadius) {
          searchOrder.push({ dx, dz, distance });
        }
      }
    }
    // 按距离排序，优先搜索近的格子
    searchOrder.sort((a, b) => a.distance - b.distance);
    
    // 搜索周围的植物
    for (const { dx, dz, distance } of searchOrder) {
      const checkX = myX + dx;
      const checkZ = myZ + dz;
      
      if (checkX >= 0 && checkX < worldSize && checkZ >= 0 && checkZ < worldSize) {
        const cell = world[checkX] && world[checkX][checkZ];
        if (cell && cell.plant && cell.plant.health > 0) {
          let priority = 0;
          
          // 植物优先级系统
          switch (cell.plant.data.name) {
            case '坚果墙':
              priority = 100; // 最高优先级
              // 坚果墙的嘲讽效果
              if (cell.plant.data.tauntLevel) {
                priority += cell.plant.data.tauntLevel * 10;
              }
              break;
            case '豌豆射手':
              priority = 80; // 攻击性植物优先级高
              break;
            case '向日葵':
              priority = 60; // 经济植物中等优先级
              break;
            case '樱桃炸弹':
              priority = 90; // 危险植物高优先级
              break;
            default:
              priority = 50;
          }
          
          // 植物血量越少，优先级稍微降低（僵尸更喜欢攻击健康的目标）
          const healthRatio = (cell.plant.health || cell.plant.data.health) / cell.plant.data.health;
          if (healthRatio > 0.8) {
            priority += 10; // 满血植物更有吸引力
          }
          
          // 距离越近优先级越高
          priority -= distance * 10;
          
          if (priority > bestPriority) {
            bestPriority = priority;
            bestTarget = {
              plant: cell.plant,
              position: { x: checkX - worldSize / 2, z: checkZ - worldSize / 2 },
              cell: cell
            };
            
            // 如果找到坚果墙且距离很近，立即返回（早期退出优化）
            if (cell.plant.data.name === '坚果墙' && distance <= 1) {
              break;
            }
          }
        }
      }
    }
    
    return bestTarget;
  }
    
  eatPlant(target, deltaTime) {
    if (!target || !target.plant) return;
    
    this.eatTimer = (this.eatTimer || 0) + deltaTime;
    
    // 啃食动画效果
    if (this.mesh) {
      const eatSpeed = 8;
      this.mesh.rotation.y = Math.sin(this.eatTimer * eatSpeed) * 0.2;
    }
    
    // 每0.5秒对植物造成伤害
    if (this.eatTimer >= 0.5) {
      const damage = this.data.damage || 20;
      target.plant.health = (target.plant.health || target.plant.data.health) - damage;
      
      // 植物受伤效果
      if (target.plant.mesh) {
        const originalColor = target.plant.mesh.material.color.clone();
        target.plant.mesh.material.color.setHex(0xff0000);
        setTimeout(() => {
          if (target.plant.mesh && target.plant.mesh.material) {
            target.plant.mesh.material.color = originalColor;
          }
        }, 200);
      }
      
      // 植物死亡
      if (target.plant.health <= 0) {
        if (game && game.scene && target.plant.mesh) {
          game.scene.remove(target.plant.mesh);
        }
        target.cell.plant = null;
        this.eatTimer = 0;
      } else {
        this.eatTimer = 0;
      }
    }
  }
  
  attackTarget(target, deltaTime) {
    if (!target || !target.plant) return;
    
    // 移动到植物位置
    const dx = target.position.x - this.position.x;
    const dz = target.position.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance > 0.3) {
      // 移动到植物
      const moveDistance = this.speed * deltaTime;
      this.position.x += (dx / distance) * moveDistance;
      this.position.z += (dz / distance) * moveDistance;
    } else {
      // 啃食植物
      this.eatPlant(target, deltaTime);
    }
  }
} // Zombie 类定义结束

class Projectile {
  constructor(startPos, targetPos, damage) {
    this.position = { x: startPos.x, z: startPos.z, y: 1 };
    this.target = { x: targetPos.x, z: targetPos.z, y: 1 };
    this.damage = damage;
    this.speed = 8;
    this.destroyed = false;
    
    this.createMesh();
    this.calculateDirection();
  }
  
  createMesh() {
    // 创建豌豆形状的投射物
    const group = new THREE.Group();
    
    // 主体 - 豌豆球
    const peaGeometry = new THREE.SphereGeometry(0.08, 8, 6);
    const peaMaterial = new THREE.MeshLambertMaterial({ color: 0x32CD32 });
    const pea = new THREE.Mesh(peaGeometry, peaMaterial);
    group.add(pea);
    
    // 添加一些细节 - 豌豆纹理
    const detailGeometry = new THREE.SphereGeometry(0.06, 6, 4);
    const detailMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const detail = new THREE.Mesh(detailGeometry, detailMaterial);
    detail.scale.set(0.8, 1.2, 0.8);
    group.add(detail);
    
    // 发光效果
    const glowGeometry = new THREE.SphereGeometry(0.1, 6, 4);
    const glowMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x90EE90, 
      transparent: true, 
      opacity: 0.3 
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glow);
    
    this.mesh = group;
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    this.mesh.castShadow = true;
    
    // 为整个组的所有子对象启用阴影
    this.mesh.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });
  }
  
  calculateDirection() {
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    this.direction = {
      x: dx / distance,
      z: dz / distance
    };
  }
  
  update(deltaTime) {
    if (this.destroyed) return;
    
    this.position.x += this.direction.x * this.speed * deltaTime;
    this.position.z += this.direction.z * this.speed * deltaTime;
    this.position.y -= 2 * deltaTime; // 重力
    
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
  }
  
  checkCollision(zombie) {
    if (this.destroyed) return false;
    
    const distance = Math.sqrt(
      Math.pow(this.position.x - zombie.position.x, 2) +
      Math.pow(this.position.z - zombie.position.z, 2)
    );
    
    return distance < 0.5;
  }
  
  destroy() {
    this.destroyed = true;
  }
}

// 方块类
class Block {
  constructor(data, x, z) {
    this.data = data;
    this.position = { x, z };
    this.durability = data.durability;
    
    this.createMesh();
  }
  
  createMesh() {
    const group = new THREE.Group();
    
    switch (this.data.name) {
      case '土方块':
        // 简化的土块 - 减少几何体复杂度
        const dirtGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        const dirtMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const dirt = new THREE.Mesh(dirtGeometry, dirtMaterial);
        dirt.position.y = 0.45;
        group.add(dirt);
        
        // 简化的草皮顶部
        const grassGeometry = new THREE.BoxGeometry(0.92, 0.1, 0.92);
        const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const grass = new THREE.Mesh(grassGeometry, grassMaterial);
        grass.position.y = 0.9;
        group.add(grass);
        
        // 移除小石头细节以提高性能
        break;
        
      case '石方块':
        // 简化的石块 - 减少几何体复杂度
        const stoneBlockGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        const stoneBlockMaterial = new THREE.MeshLambertMaterial({ color: 0x708090 });
        const stoneBlock = new THREE.Mesh(stoneBlockGeometry, stoneBlockMaterial);
        stoneBlock.position.y = 0.45;
        group.add(stoneBlock);
        
        // 简化纹理线条 - 只保留一条
        const lineGeometry1 = new THREE.BoxGeometry(0.92, 0.02, 0.92);
        const lineMaterial1 = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
        
        const line1 = new THREE.Mesh(lineGeometry1, lineMaterial1);
        line1.position.y = 0.3;
        group.add(line1);
        
        // 移除额外的线条和裂纹细节以提高性能
        break;
        
      case '铁方块':
        // 简化的金属块 - 减少几何体复杂度和材质复杂度
        const metalGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        // 使用 MeshLambertMaterial 替代 MeshPhongMaterial 以提高性能
        const metalMaterial = new THREE.MeshLambertMaterial({ 
          color: 0xC0C0C0
        });
        const metal = new THREE.Mesh(metalGeometry, metalMaterial);
        metal.position.y = 0.45;
        group.add(metal);
        
        // 添加简化的金属边框 - 只保留顶部边框
        const frameGeometry = new THREE.BoxGeometry(0.95, 0.05, 0.95);
        const frameMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
        
        const frameTop = new THREE.Mesh(frameGeometry, frameMaterial);
        frameTop.position.y = 0.9;
        group.add(frameTop);
        
        // 移除螺钉和中央标识以提高性能
        break;
        
      default:
        // 默认方块
        const defaultGeometry = new THREE.BoxGeometry(1, 1, 1);
        const defaultMaterial = new THREE.MeshLambertMaterial({ color: this.data.color });
        const defaultMesh = new THREE.Mesh(defaultGeometry, defaultMaterial);
        defaultMesh.position.y = 0.5;
        group.add(defaultMesh);
        break;
    }
    
    this.mesh = group;
    this.mesh.position.set(this.position.x, 0, this.position.z);
    
    // 简化阴影处理 - 只让主要物体投射阴影，而不是每个子对象
    // 这可以大幅减少阴影计算量
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false; // 方块不需要接收阴影
    
    // 不为子对象单独设置阴影，减少渲染负担
  }
}


export { Game };
