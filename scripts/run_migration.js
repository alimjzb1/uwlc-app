import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Load env vars (simple parser since dotenv might not be available/configured for this script)
function loadEnv(filepath) {
    if (!fs.existsSync(filepath)) return {};
    const content = fs.readFileSync(filepath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            env[key.trim()] = value.trim();
        }
    });
    return env;
}

const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
const connectionString = process.env.DATABASE_URL || env.DATABASE_URL;

if (!connectionString) {
    console.error("No DATABASE_URL found in .env, .env.local, or environment variables.");
    console.error("Please add DATABASE_URL=postgresql://postgres:[PASSWORD]@... to your .env file.");
    process.exit(1);
}

async function runMigration(connStr) {
    console.log(`Connecting to database...`);
    const sql = postgres(connStr);
    const migrationFile = path.join('supabase', 'migrations', '20240216_fix_deletion_stock.sql');
    
    if (!fs.existsSync(migrationFile)) {
         console.error(`Migration file not found at ${migrationFile}`);
         process.exit(1);
    }

    const migrationSql = fs.readFileSync(migrationFile, 'utf8');
    console.log(`Executing migration from ${migrationFile}...`);
    
    try {
        await sql.unsafe(migrationSql);
        console.log("Migration executed successfully!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await sql.end();
    }
}

runMigration(connectionString);
