import { assert, type Db } from './Db';
import type { Category, CategoryKind } from './types';

type Row = { id: number; name: string; kind: CategoryKind; icon: string; color: string; archived: number };

const map = (r: Row): Category => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  icon: r.icon,
  color: r.color,
  archived: r.archived === 1,
});

const ORDER = `ORDER BY CASE kind WHEN 'essential' THEN 0 WHEN 'discretionary' THEN 1 ELSE 2 END, id`;

export async function listCategories(db: Db, opts: { includeArchived?: boolean; kind?: CategoryKind } = {}): Promise<Category[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (!opts.includeArchived) where.push('archived = 0');
  if (opts.kind) {
    where.push('kind = ?');
    params.push(opts.kind);
  }
  const sql = `SELECT * FROM categories ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ${ORDER}`;
  return (await db.all<Row>(sql, params)).map(map);
}

export async function getCategory(db: Db, id: number): Promise<Category | null> {
  const row = await db.first<Row>('SELECT * FROM categories WHERE id = ?', [id]);
  return row ? map(row) : null;
}

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
}

export async function createCategory(db: Db, input: CategoryInput): Promise<number> {
  assert(input.name.trim().length > 0, 'Give the category a name.');
  const r = await db.run('INSERT INTO categories (name, kind, icon, color) VALUES (?, ?, ?, ?)', [
    input.name.trim(),
    input.kind,
    input.icon || '🏷️',
    input.color,
  ]);
  return r.lastInsertRowId;
}

export async function updateCategory(db: Db, id: number, input: CategoryInput): Promise<void> {
  assert(input.name.trim().length > 0, 'Give the category a name.');
  await db.run('UPDATE categories SET name = ?, kind = ?, icon = ?, color = ? WHERE id = ?', [
    input.name.trim(),
    input.kind,
    input.icon || '🏷️',
    input.color,
    id,
  ]);
}

export async function setCategoryArchived(db: Db, id: number, archived: boolean): Promise<void> {
  await db.run('UPDATE categories SET archived = ? WHERE id = ?', [archived ? 1 : 0, id]);
}
