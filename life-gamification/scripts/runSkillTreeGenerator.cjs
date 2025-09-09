const fs = require('fs');
const path = require('path');

// Since we can't directly run TypeScript, let's create a JavaScript version
// of the skill tree generator for immediate use

const SKILL_TREE_CONFIG = {
  canvasSize: { width: 4000, height: 4000 },
  center: { x: 2000, y: 2000 },
  
  startingNodes: {
    strength: { x: 1400, y: 2600, angle: 234 * Math.PI / 180 },
    intelligence: { x: 2000, y: 1400, angle: 90 * Math.PI / 180 },
    luck: { x: 2600, y: 2600, angle: 306 * Math.PI / 180 },
    aura: { x: 1400, y: 1400, angle: 162 * Math.PI / 180 },
    will: { x: 2600, y: 1400, angle: 18 * Math.PI / 180 }
  },
  
  maxRadiusFromStart: 800,
  nodeDistribution: {
    regular: 300,
    specialized: 100,
    augmenting: 10
  }
};

const STAT_COLORS = {
  strength: '#FF6B6B',
  intelligence: '#4ECDC4',
  luck: '#FFE066',
  aura: '#9B59B6',
  will: '#3498DB'
};

const getNodePowerMultiplier = (distanceFromStart) => {
  const maxDistance = SKILL_TREE_CONFIG.maxRadiusFromStart;
  const normalized = Math.min(distanceFromStart / maxDistance, 1);
  return 1 + (normalized ** 2) * 4;
};

const generateRegularNodes = (stat, startingNode) => {
  const nodes = [];
  const { x: startX, y: startY, angle: baseAngle } = startingNode;
  
  for (let i = 1; i <= SKILL_TREE_CONFIG.nodeDistribution.regular; i++) {
    const distance = 50 + (i / 300) * (SKILL_TREE_CONFIG.maxRadiusFromStart - 50);
    const angleSpread = Math.PI / 3;
    const angle = baseAngle + (Math.random() - 0.5) * angleSpread;
    
    const x = startX + Math.cos(angle) * distance;
    const y = startY + Math.sin(angle) * distance;
    
    const powerMultiplier = getNodePowerMultiplier(distance);
    const baseStatBonus = Math.round(2 * powerMultiplier);
    const baseProductivityBonus = 0.01 * powerMultiplier;
    
    const statBonuses = {
      [stat]: baseStatBonus
    };
    
    if (stat === 'strength') statBonuses.health = Math.round(5 * powerMultiplier);
    if (stat === 'intelligence') statBonuses.mana = Math.round(5 * powerMultiplier);
    
    nodes.push({
      node_key: `${stat.toUpperCase()}_${String(i).padStart(3, '0')}`,
      name: `${stat.charAt(0).toUpperCase() + stat.slice(1)} Node ${i}`,
      description: `+${baseStatBonus} ${stat.charAt(0).toUpperCase() + stat.slice(1)}, +${Math.round(baseProductivityBonus * 100)}% XP from ${stat} tasks`,
      node_type: 'regular',
      primary_stat: stat,
      x_position: Math.round(x),
      y_position: Math.round(y),
      level_requirement: Math.max(1, Math.floor(distance / 100)),
      prerequisite_nodes: JSON.stringify([]),
      skill_point_cost: 1,
      stat_bonuses: JSON.stringify(statBonuses),
      productivity_effects: JSON.stringify({
        [`${stat}_task_xp_bonus`]: baseProductivityBonus
      }),
      game_effects: JSON.stringify({}),
      color_hex: STAT_COLORS[stat],
      size: 'small'
    });
  }
  
  return nodes;
};

const generateSpecializedNodes = (stat, startingNode) => {
  const nodes = [];
  const { x: startX, y: startY, angle: baseAngle } = startingNode;
  
  const clusterThemes = {
    strength: [
      { name: "Titan's Endurance", focus: "health_defense" },
      { name: "Berserker's Fury", focus: "damage_offense" },
      { name: "Iron Will", focus: "persistence" },
      { name: "Physical Mastery", focus: "task_bonus" }
    ],
    intelligence: [
      { name: "Scholar's Focus", focus: "learning_bonus" },
      { name: "Mental Fortress", focus: "concentration" },
      { name: "Cognitive Enhancement", focus: "efficiency" },
      { name: "Wisdom's Path", focus: "experience" }
    ],
    luck: [
      { name: "Fortune's Favor", focus: "reward_bonus" },
      { name: "Serendipity", focus: "random_events" },
      { name: "Lucky Break", focus: "critical_success" },
      { name: "Probability Mastery", focus: "outcome_control" }
    ],
    aura: [
      { name: "Commanding Presence", focus: "leadership" },
      { name: "Inspiring Aura", focus: "team_bonus" },
      { name: "Intimidating Force", focus: "dominance" },
      { name: "Charismatic Influence", focus: "social_power" }
    ],
    will: [
      { name: "Unbreakable Focus", focus: "concentration" },
      { name: "Mental Discipline", focus: "self_control" },
      { name: "Willpower Surge", focus: "burst_performance" },
      { name: "Determination", focus: "persistence" }
    ]
  };
  
  const clusters = clusterThemes[stat] || [{ name: `${stat} Cluster`, focus: "general" }];
  
  // Create 25 clusters of 4 nodes each (100 total)
  const clusterCount = 25;
  for (let cluster = 0; cluster < clusterCount; cluster++) {
    const clusterDistance = 200 + (cluster / clusterCount) * 500;
    const clusterAngle = baseAngle + (cluster / clusterCount - 0.5) * (Math.PI / 2);
    
    const theme = clusters[cluster % clusters.length];
    
    // Generate 4 nodes in this cluster
    for (let i = 0; i < 4; i++) {
      const nodeAngle = clusterAngle + (i - 1.5) * 0.15;
      const nodeDistance = clusterDistance + (i - 1.5) * 15;
      
      const x = startX + Math.cos(nodeAngle) * nodeDistance;
      const y = startY + Math.sin(nodeAngle) * nodeDistance;
      
      const nodeIndex = cluster * 4 + i + 1;
      const powerMultiplier = getNodePowerMultiplier(nodeDistance);
      
      const statBonuses = {
        [stat]: Math.round(8 * powerMultiplier)
      };
      
      if (stat === 'strength') statBonuses.health = Math.round(20 * powerMultiplier);
      if (stat === 'intelligence') statBonuses.mana = Math.round(20 * powerMultiplier);
      
      nodes.push({
        node_key: `${stat.toUpperCase()}_SPEC_${String(nodeIndex).padStart(3, '0')}`,
        name: i === 0 ? theme.name : `${theme.name} Support ${i}`,
        description: `Specialized ${stat} enhancement focused on ${theme.focus}`,
        node_type: 'specialized',
        primary_stat: stat,
        x_position: Math.round(x),
        y_position: Math.round(y),
        level_requirement: Math.max(5, Math.floor(nodeDistance / 80)),
        prerequisite_nodes: JSON.stringify([]),
        skill_point_cost: 2,
        stat_bonuses: JSON.stringify(statBonuses),
        productivity_effects: JSON.stringify({
          [`${theme.focus}_bonus`]: 0.05 * powerMultiplier
        }),
        game_effects: JSON.stringify({
          unlocks_feature: theme.focus
        }),
        color_hex: STAT_COLORS[stat],
        size: 'medium'
      });
    }
  }
  
  return nodes;
};

const generateAugmentingNodes = (stat, startingNode) => {
  const nodes = [];
  const { x: startX, y: startY, angle: baseAngle } = startingNode;
  
  const augmentingThemes = {
    strength: [
      { name: "Berserker's Oath", effect: "health_as_damage" },
      { name: "Titan's Constitution", effect: "damage_immunity" },
      { name: "Warrior's Spirit", effect: "combat_mastery" }
    ],
    intelligence: [
      { name: "Omniscience", effect: "all_knowledge" },
      { name: "Time Dilation", effect: "task_time_manipulation" },
      { name: "Mind Over Matter", effect: "mental_dominance" }
    ],
    luck: [
      { name: "Fortune's Favorite", effect: "cascade_rewards" },
      { name: "Probability Control", effect: "outcome_manipulation" },
      { name: "Legendary Luck", effect: "critical_everything" }
    ],
    aura: [
      { name: "Divine Presence", effect: "overwhelming_charisma" },
      { name: "Mass Inspiration", effect: "team_transcendence" },
      { name: "Reality Warping Aura", effect: "environmental_control" }
    ],
    will: [
      { name: "Unbreakable Will", effect: "immunity_to_failure" },
      { name: "Transcendent Focus", effect: "time_stop" },
      { name: "Pure Determination", effect: "unlimited_endurance" }
    ]
  };
  
  const themes = augmentingThemes[stat] || [{ name: `${stat} Mastery`, effect: "ultimate_power" }];
  
  for (let i = 1; i <= SKILL_TREE_CONFIG.nodeDistribution.augmenting; i++) {
    const distance = SKILL_TREE_CONFIG.maxRadiusFromStart * (0.6 + (i / 10) * 0.4);
    const angleSpread = Math.PI / 6;
    const angle = baseAngle + (i / 10 - 0.5) * angleSpread;
    
    const x = startX + Math.cos(angle) * distance;
    const y = startY + Math.sin(angle) * distance;
    
    const theme = themes[(i - 1) % themes.length];
    
    const statBonuses = {
      [stat]: Math.round(25 + i * 5)
    };
    
    if (stat === 'strength') statBonuses.health = Math.round(100 + i * 20);
    if (stat === 'intelligence') statBonuses.mana = Math.round(100 + i * 20);
    
    nodes.push({
      node_key: `${stat.toUpperCase()}_AUG_${String(i).padStart(2, '0')}`,
      name: theme.name,
      description: `Game-changing ${stat} augmentation: ${theme.effect}`,
      node_type: 'augmenting',
      primary_stat: stat,
      x_position: Math.round(x),
      y_position: Math.round(y),
      level_requirement: 20 + i * 5,
      prerequisite_nodes: JSON.stringify([]),
      skill_point_cost: 5,
      stat_bonuses: JSON.stringify(statBonuses),
      productivity_effects: JSON.stringify({
        [`${theme.effect}_active`]: 1.0
      }),
      game_effects: JSON.stringify({
        [theme.effect]: true,
        ultimate_unlock: true
      }),
      color_hex: STAT_COLORS[stat],
      size: 'massive'
    });
  }
  
  return nodes;
};

const generateSkillTree = () => {
  const allNodes = [];
  
  Object.entries(SKILL_TREE_CONFIG.startingNodes).forEach(([stat, config]) => {
    console.log(`Generating nodes for ${stat}...`);
    
    const regularNodes = generateRegularNodes(stat, config);
    const specializedNodes = generateSpecializedNodes(stat, config);
    const augmentingNodes = generateAugmentingNodes(stat, config);
    
    allNodes.push(...regularNodes);
    allNodes.push(...specializedNodes);
    allNodes.push(...augmentingNodes);
    
    console.log(`  Regular: ${regularNodes.length}, Specialized: ${specializedNodes.length}, Augmenting: ${augmentingNodes.length}`);
  });
  
  return allNodes;
};

const generateSQL = () => {
  const nodes = generateSkillTree();
  
  console.log(`\nGenerated ${nodes.length} total nodes`);
  console.log(`Target: 2045 nodes (5 start + 1500 regular + 500 specialized + 50 augmenting + current system)`);
  
  let sql = "-- Generated POE-Style Skill Tree Data\n";
  sql += "-- Total nodes: " + nodes.length + "\n\n";
  
  // Insert nodes in chunks to avoid SQL size limits
  const chunkSize = 100;
  for (let i = 0; i < nodes.length; i += chunkSize) {
    const chunk = nodes.slice(i, i + chunkSize);
    
    sql += `-- Nodes ${i + 1} to ${Math.min(i + chunkSize, nodes.length)}\n`;
    sql += "INSERT INTO skill_nodes (node_key, name, description, node_type, primary_stat, x_position, y_position, level_requirement, prerequisite_nodes, skill_point_cost, stat_bonuses, productivity_effects, game_effects, color_hex, size) VALUES\n";
    
    const nodeValues = chunk.map(node => 
      `('${node.node_key}', '${node.name.replace(/'/g, "''")}', '${node.description.replace(/'/g, "''")}', '${node.node_type}', '${node.primary_stat}', ${node.x_position}, ${node.y_position}, ${node.level_requirement}, '${node.prerequisite_nodes}', ${node.skill_point_cost}, '${node.stat_bonuses}', '${node.productivity_effects}', '${node.game_effects}', '${node.color_hex}', '${node.size}')`
    ).join(',\n');
    
    sql += nodeValues + ";\n\n";
  }
  
  return sql;
};

// Generate and save the SQL
const sql = generateSQL();
const outputPath = path.join(__dirname, '..', 'src-tauri', 'migrations', '20240906000002_skill_tree_data.sql');

fs.writeFileSync(outputPath, sql);
console.log(`\n✅ Skill tree data saved to: ${outputPath}`);
console.log(`📊 File size: ${Math.round(fs.statSync(outputPath).size / 1024)} KB`);