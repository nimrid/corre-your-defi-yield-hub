import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://neondb_owner:npg_jvZOMUP61GSi@ep-frosty-field-abt6hesx-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require' });
pool.query('SELECT * FROM stock_holdings_summary LIMIT 10').then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(console.error);
