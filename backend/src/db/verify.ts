// Database verification script
// Quick script to verify database setup works correctly

import { initializeForEnvironment, getDatabaseStatus } from './init';
import { getConnection } from './connection';

async function verifyDatabase() {
  try {
    console.log('🔍 Verifying database setup...\n');

    // Initialize database
    const initResult = await initializeForEnvironment();
    console.log(`✅ Database initialization: ${initResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`📂 Database path: ${initResult.databasePath}`);
    
    if (!initResult.success) {
      console.log('❌ Errors:', initResult.errors);
      return;
    }

    // Get status
    const status = await getDatabaseStatus();
    console.log(`🏥 Database healthy: ${status.healthy ? 'YES' : 'NO'}`);
    console.log(`📊 Migration status: ${status.migration?.isUpToDate ? 'Up to date' : 'Needs migration'}`);
    console.log(`🔢 Current version: ${status.migration?.currentVersion}`);
    console.log(`📈 Latest version: ${status.migration?.latestVersion}`);

    // Test basic operations
    console.log('\n🧪 Testing basic operations...');
    
    const connection = await getConnection();
    try {
      // Test table exists
      const tables = await connection.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);
      
      console.log(`📋 Tables found: ${tables.map((t: any) => t.name).join(', ')}`);

      // Test sample query
      const gameCount = await connection.get('SELECT COUNT(*) as count FROM games');
      console.log(`🎮 Games in database: ${gameCount?.count || 0}`);

      const playerCount = await connection.get('SELECT COUNT(*) as count FROM players');
      console.log(`👥 Players in database: ${playerCount?.count || 0}`);

    } finally {
      await connection.close();
    }

    console.log('\n✅ Database verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    process.exit(1);
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Verification script failed:', error);
      process.exit(1);
    });
}

export { verifyDatabase };