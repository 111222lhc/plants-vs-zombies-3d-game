// 游戏数据
const gameData = {
  "plants": [
    {
      "name": "豌豆射手",
      "cost": 100,
      "damage": 20,
      "range": 3,
      "fireRate": 1.5,
      "health": 150,
      "color": "#4CAF50",
      "description": "发射豌豆攻击僵尸",
      "icon": "🟢"
    },
    {
      "name": "向日葵", 
      "cost": 50,
      "sunProduction": 25,
      "interval": 3,
      "health": 100,
      "color": "#FFD700",
      "description": "产生阳光资源",
      "icon": "🌻"
    },
    {
      "name": "坚果墙",
      "cost": 50,
      "health": 500,
      "tauntLevel": 10,
      "color": "#8B4513",
      "description": "阻挡僵尸前进，强力吸引僵尸攻击",
      "icon": "🟤"
    },
    {
      "name": "樱桃炸弹",
      "cost": 150,
      "damage": 100,
      "range": 2,
      "health": 80,
      "color": "#FF0000",
      "description": "范围爆炸攻击",
      "icon": "🔴"
    }
  ],
  "zombies": [
    {
      "name": "普通僵尸",
      "health": 60,
      "speed": 0.5,
      "damage": 10,
      "color": "#808080",
      "description": "基础僵尸单位"
    },
    {
      "name": "矿工僵尸", 
      "health": 80,
      "speed": 0.3,
      "damage": 15,
      "color": "#654321",
      "description": "可以挖掘地下前进"
    },
    {
      "name": "爆破僵尸",
      "health": 40,
      "speed": 0.8,
      "damage": 50,
      "color": "#FF4500",
      "description": "接近时会爆炸"
    }
  ],
  "blocks": [
    {
      "name": "土方块",
      "cost": 1,
      "durability": 50,
      "color": "#8B4513",
      "icon": "🟫"
    },
    {
      "name": "石方块", 
      "cost": 3,
      "durability": 100,
      "color": "#808080",
      "icon": "⬜"
    },
    {
      "name": "铁方块",
      "cost": 5,
      "durability": 200,
      "color": "#C0C0C0",
      "icon": "◻️"
    }
  ],
  "gameSettings": {
    "initialSun": 200,
    "initialMaterials": 50,
    "baseHealth": 100,
    "dayDuration": 15,
    "nightDuration": 20,
    "waveInterval": 10,
    "maxWaves": 10
  }
};

export { gameData };
