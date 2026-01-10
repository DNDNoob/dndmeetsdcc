// Test script to create game data with 2 crawlers, 2 mobs, 2 maps, 2 inventory items
const testData = {
  crawlers: [
    {
      id: "test-1",
      name: "Aragorn",
      race: "Human",
      job: "Ranger",
      level: 5,
      hp: 90,
      maxHP: 100,
      mana: 40,
      maxMana: 60,
      str: 16,
      dex: 14,
      con: 15,
      int: 12,
      cha: 14,
      achievements: "Beast Slayer. Dungeon Explorer. King's Champion.",
      gold: 250,
      avatar: ""
    },
    {
      id: "test-2",
      name: "Gandalf",
      race: "Wizard",
      job: "Mage",
      level: 10,
      hp: 70,
      maxHP: 80,
      mana: 150,
      maxMana: 200,
      str: 8,
      dex: 10,
      con: 12,
      int: 20,
      cha: 18,
      achievements: "Archmage. Dragon Slayer. Staff Bearer.",
      gold: 500,
      avatar: ""
    }
  ],
  inventory: [
    {
      crawlerId: "test-1",
      items: [
        {
          id: "inv-1",
          name: "Elven Blade",
          description: "A legendary sword forged by elves, glows blue when orcs are near",
          equipped: true
        },
        {
          id: "inv-2",
          name: "Healing Potion",
          description: "Restores 50 HP when consumed",
          equipped: false
        }
      ]
    },
    {
      crawlerId: "test-2",
      items: [
        {
          id: "inv-3",
          name: "Staff of Power",
          description: "Ancient wizard staff that amplifies magical abilities",
          equipped: true
        },
        {
          id: "inv-4",
          name: "Mana Crystal",
          description: "Restores 75 Mana when used",
          equipped: false
        }
      ]
    }
  ],
  mobs: [
    {
      id: "mob-1",
      name: "Shadow Dragon",
      level: 15,
      type: "boss",
      description: "A fearsome ancient dragon with scales as dark as night",
      encountered: true,
      hidden: false,
      image: "",
      weaknesses: "Light magic, Fire",
      strengths: "Shadow magic, Physical attacks",
      hitPoints: 500,
      hideWeaknesses: false,
      hideStrengths: false,
      hideHitPoints: false
    },
    {
      id: "mob-2",
      name: "Goblin Scout",
      level: 3,
      type: "normal",
      description: "A sneaky goblin that patrols the dungeon corridors",
      encountered: true,
      hidden: false,
      image: "",
      weaknesses: "Fire, Holy magic",
      strengths: "Stealth, Speed",
      hitPoints: 45,
      hideWeaknesses: false,
      hideStrengths: false,
      hideHitPoints: false
    }
  ],
  maps: [
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%23f0e6d2'/%3E%3Ctext x='200' y='150' font-size='24' text-anchor='middle' fill='%23333'%3EDungeon Level 1%3C/text%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%23d2d2e6'/%3E%3Ctext x='200' y='150' font-size='24' text-anchor='middle' fill='%23333'%3EDungeon Level 2%3C/text%3E%3C/svg%3E"
  ]
};

// Save the test data
fetch('http://localhost:4000/api/game/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
})
  .then(res => res.json())
  .then(result => {
    console.log('✅ Test data saved:', result);
    
    // Now verify it was saved by loading it back
    return fetch('http://localhost:4000/api/game/load');
  })
  .then(res => res.json())
  .then(loaded => {
    console.log('✅ Test data loaded successfully:');
    console.log('  - Crawlers:', loaded.crawlers.length);
    console.log('  - Mobs:', loaded.mobs.length);
    console.log('  - Maps:', loaded.maps.length);
    console.log('  - Inventory entries:', loaded.inventory.length);
    console.log('\nFull data:', JSON.stringify(loaded, null, 2));
  })
  .catch(err => {
    console.error('❌ Error:', err);
  });
