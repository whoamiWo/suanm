import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgres://sm:sm@127.0.0.1:5433/sm' });
const c = await pool.connect();
await c.query('SET search_path TO auth, public');
const r = await c.query("select table_name from information_schema.tables where table_schema='auth'");
console.log('auth schema tables:', r.rows.map(x=>x.table_name));
const r2 = await c.query("select current_schema()");
console.log('current_schema:', r2.rows[0].current_schema);
c.release(); await pool.end();
