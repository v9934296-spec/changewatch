function matchFilters(row, filters) {
  return filters.every(([col, val]) => row[col] === val);
}

class QueryBuilder {
  constructor(store, table, rows) {
    this.store = store;
    this.table = table;
    this.rows = rows;
    this.filters = [];
    this.mode = "select";
    this.payload = null;
    this.limitVal = null;
    this.orderCol = null;
    this.orderAsc = true;
    this.headCount = false;
  }

  select(_cols, opts) {
    if (opts?.count === "exact" && opts?.head) this.headCount = true;
    return this;
  }

  insert(row) {
    this.mode = "insert";
    this.payload = row;
    return this;
  }

  update(row) {
    this.mode = "update";
    this.payload = row;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(col, val) {
    this.filters.push([col, val]);
    return this;
  }

  order(col, opts) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  limit(n) {
    this.limitVal = n;
    return this;
  }

  maybeSingle() {
    return this._run(true);
  }

  then(resolve, reject) {
    return this._run(false).then(resolve, reject);
  }

  async _run(single) {
    if (this.mode === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const row of rows) {
        this.store[this.table].push({ ...row });
      }
      return { data: rows[0] || null, error: null, count: rows.length };
    }

    let result = this.store[this.table].filter((row) => matchFilters(row, this.filters));

    if (this.mode === "update") {
      result.forEach((row, idx) => {
        const i = this.store[this.table].indexOf(row);
        this.store[this.table][i] = { ...row, ...this.payload };
      });
      return { data: single ? this.store[this.table].find((row) => matchFilters(row, this.filters)) || null : result, error: null };
    }

    if (this.mode === "delete") {
      this.store[this.table] = this.store[this.table].filter((row) => !matchFilters(row, this.filters));
      return { data: null, error: null };
    }

    if (this.orderCol) {
      result = result.slice().sort((a, b) => {
        const av = a[this.orderCol];
        const bv = b[this.orderCol];
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (this.orderAsc ? 1 : -1);
      });
    }
    if (this.limitVal != null) result = result.slice(0, this.limitVal);
    if (this.headCount) return { data: null, error: null, count: result.length };

    return { data: single ? result[0] || null : result, error: null, count: result.length };
  }
}

function createMockAdmin(initial = {}) {
  const store = {
    profiles: initial.profiles || [],
    watches: initial.watches || [],
    alerts: initial.alerts || []
  };

  return {
    store,
    from(table) {
      return new QueryBuilder(store, table, store[table]);
    }
  };
}

module.exports = { createMockAdmin };
