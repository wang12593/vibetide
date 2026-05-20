import postgres from 'postgres';

const sql = postgres('postgresql://postgres:123456@localhost:54322/postgres', { prepare: false });

try {
  const [leader] = await sql`
    SELECT id, slug, name FROM ai_employees WHERE slug = 'leader' LIMIT 1
  `;
  if (!leader) {
    console.error('Leader not found!');
    process.exit(1);
  }
  console.log('Leader:', leader.id, leader.name);

  const result = await sql`
    DELETE FROM employee_skills WHERE employee_id = ${leader.id}
  `;
  console.log('Deleted', result.count, 'skill bindings for leader');

  const remaining = await sql`
    SELECT count(*) as cnt FROM employee_skills WHERE employee_id = ${leader.id}
  `;
  console.log('Remaining skills:', remaining[0].cnt);
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await sql.end();
}
