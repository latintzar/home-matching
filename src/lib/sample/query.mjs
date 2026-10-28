/** The retained Supabase call shape, executed by the local sample storage adapter. */
export function queryClient(execute, auth) {
  function from(table) {
    const query = {table, action: 'select', filters: [], orders: [], limit: 100};
    const builder = {
      select(columns = '*', options = {}) { query.columns = columns; query.count = options.count; query.head = options.head; return builder; },
      insert(values) { query.action = 'insert'; query.values = values; return builder; },
      update(values) { query.action = 'update'; query.values = values; return builder; },
      upsert(values, options = {}) { query.action = 'upsert'; query.values = values; query.onConflict = options.onConflict; return builder; },
      delete() { query.action = 'delete'; return builder; },
      order(column, options = {}) { query.orders.push({column, ascending: options.ascending !== false}); return builder; },
      limit(value) { query.limit = value; return builder; },
      range(start, end) { query.offset = start; query.limit = end - start + 1; return builder; },
      single() { query.single = true; return builder; },
      maybeSingle() { query.single = true; query.optional = true; return builder; },
      then(resolve, reject) { return Promise.resolve().then(() => execute(structuredClone(query))).then(resolve, reject); },
    };
    for (const operator of ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'contains']) {
      builder[operator] = (column, value) => { query.filters.push({operator, column, value}); return builder; };
    }
    return builder;
  }
  return {from, auth};
}
