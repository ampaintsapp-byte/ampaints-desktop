const Database = require('better-sqlite3');
const db = new Database('./paintpulse.db');

try {
  console.log('Adding new columns to sales table...');
  db.prepare('ALTER TABLE sales ADD COLUMN due_date integer').run();
  console.log('✓ Added due_date column');
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    console.log('✓ due_date column already exists');
  } else {
    console.error('Error adding due_date:', e.message);
  }
}

try {
  db.prepare('ALTER TABLE sales ADD COLUMN is_manual_balance integer DEFAULT 0 NOT NULL').run();
  console.log('✓ Added is_manual_balance column');
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    console.log('✓ is_manual_balance column already exists');
  } else {
    console.error('Error adding is_manual_balance:', e.message);
  }
}

try {
  db.prepare('ALTER TABLE sales ADD COLUMN notes text').run();
  console.log('✓ Added notes column');
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    console.log('✓ notes column already exists');
  } else {
    console.error('Error adding notes:', e.message);
  }
}

console.log('\nMigration completed!');
db.close();
