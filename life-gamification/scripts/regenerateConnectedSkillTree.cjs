const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Compile and run the TypeScript generator
const compile = () => {
  console.log('Compiling TypeScript skill tree generator...');
  
  try {
    // Compile the TypeScript file
    execSync('npx tsc scripts/generateConnectedSkillTree.ts --target es2017 --module commonjs --moduleResolution node --outDir scripts/dist', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit'
    });
    
    console.log('Compilation successful!');
    
    // Import and run the generator
    const { generateConnectedSkillTreeSQL } = require('./dist/generateConnectedSkillTree.js');
    
    console.log('Generating connected skill tree...');
    const sql = generateConnectedSkillTreeSQL();
    
    // Write to migration file
    const migrationPath = path.resolve(__dirname, '../src-tauri/migrations/20240906000003_connected_skill_tree.sql');
    fs.writeFileSync(migrationPath, sql);
    
    console.log(`Generated connected skill tree SQL at: ${migrationPath}`);
    console.log('SQL preview:');
    console.log(sql.substring(0, 500) + '...');
    
    return true;
  } catch (error) {
    console.error('Error generating skill tree:', error);
    return false;
  }
};

if (require.main === module) {
  compile();
}

module.exports = { compile };