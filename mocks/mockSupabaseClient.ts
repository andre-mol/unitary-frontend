import { getRpcMockData, getTableMockData } from './mockRpcData';

const TABLE_MOCK_DATA = getTableMockData();
const RPC_MOCK_DATA = getRpcMockData();

const MOCK_SUPABASE_USER = {
  id: 'demo-user-00000000-0000-0000-0000-000000000001',
  email: 'demo@unitary.app',
  user_metadata: { name: 'André (Demo)' },
  app_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2024-01-15T10:00:00.000Z',
  updated_at: '2024-06-01T10:00:00.000Z',
};

const MOCK_SESSION = {
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: MOCK_SUPABASE_USER,
};

class MockQueryBuilder {
  private _data: any;
  private _isSingle = false;

  constructor(tableData: any[] | null) {
    this._data = tableData ? [...tableData] : [];
  }

  select(_columns?: string) { return this; }
  insert(_data: any) { this._data = null; return this; }
  upsert(_data: any) { this._data = null; return this; }
  update(_data: any) { this._data = null; return this; }
  delete() { this._data = null; return this; }

  eq(_col: string, _val: any) { return this; }
  neq(_col: string, _val: any) { return this; }
  in(_col: string, _vals: any[]) { return this; }
  is(_col: string, _val: any) { return this; }
  gt(_col: string, _val: any) { return this; }
  gte(_col: string, _val: any) { return this; }
  lt(_col: string, _val: any) { return this; }
  lte(_col: string, _val: any) { return this; }
  like(_col: string, _val: string) { return this; }
  ilike(_col: string, _val: string) { return this; }
  or(_filter: string) { return this; }
  not(_col: string, _op: string, _val: any) { return this; }
  contains(_col: string, _val: any) { return this; }
  containedBy(_col: string, _val: any) { return this; }
  filter(_col: string, _op: string, _val: any) { return this; }
  match(_query: Record<string, any>) { return this; }
  textSearch(_col: string, _query: string) { return this; }

  order(_col: string, _opts?: any) { return this; }
  limit(_count: number) { return this; }
  range(_from: number, _to: number) { return this; }
  abortSignal(_signal: AbortSignal) { return this; }
  csv() { return this; }
  returns<T>() { return this as unknown as MockQueryBuilder; }

  single() {
    this._isSingle = true;
    return this;
  }

  maybeSingle() {
    this._isSingle = true;
    return this;
  }

  then(
    resolve: (value: any) => any,
    reject?: (error: any) => any
  ) {
    const data = this._isSingle
      ? (Array.isArray(this._data) ? this._data[0] ?? null : this._data)
      : this._data;
    return Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : null })
      .then(resolve, reject);
  }
}

class MockStorageBucket {
  upload(_path: string, _data: any, _opts?: any) {
    return Promise.resolve({ data: { path: _path }, error: null });
  }
  getPublicUrl(path: string) {
    return { data: { publicUrl: `https://demo.storage/${path}` } };
  }
  download(_path: string) {
    return Promise.resolve({ data: new Blob(), error: null });
  }
  remove(_paths: string[]) {
    return Promise.resolve({ data: [], error: null });
  }
  createSignedUrl(path: string, _expiresIn: number) {
    return Promise.resolve({ data: { signedUrl: `https://demo.storage/signed/${path}` }, error: null });
  }
}

class MockChannel {
  on(_event: string, _opts: any, _cb?: any) { return this; }
  subscribe(_cb?: any) { return this; }
  unsubscribe() { return Promise.resolve('ok'); }
}

let _authChangeCallbacks: ((event: string, session: any) => void)[] = [];

export function createMockSupabaseClient(): any {
  return {
    from(table: string) {
      const tableData = TABLE_MOCK_DATA[table] ?? [];
      return new MockQueryBuilder(tableData);
    },

    rpc(name: string, _params?: any) {
      const data = name in RPC_MOCK_DATA ? RPC_MOCK_DATA[name] : null;
      return Promise.resolve({ data, error: null });
    },

    auth: {
      getUser() {
        return Promise.resolve({ data: { user: MOCK_SUPABASE_USER }, error: null });
      },
      getSession() {
        return Promise.resolve({ data: { session: MOCK_SESSION }, error: null });
      },
      signInWithPassword(_creds: any) {
        return Promise.resolve({ data: { session: MOCK_SESSION, user: MOCK_SUPABASE_USER }, error: null });
      },
      signInWithOAuth(_opts: any) {
        return Promise.resolve({ data: { url: null, provider: 'google' }, error: null });
      },
      signUp(_creds: any) {
        return Promise.resolve({ data: { user: MOCK_SUPABASE_USER, session: MOCK_SESSION }, error: null });
      },
      signOut() {
        return Promise.resolve({ error: null });
      },
      resetPasswordForEmail(_email: string) {
        return Promise.resolve({ data: {}, error: null });
      },
      updateUser(_updates: any) {
        return Promise.resolve({ data: { user: MOCK_SUPABASE_USER }, error: null });
      },
      setSession(_session: any) {
        return Promise.resolve({ data: { session: MOCK_SESSION, user: MOCK_SUPABASE_USER }, error: null });
      },
      onAuthStateChange(cb: (event: string, session: any) => void) {
        _authChangeCallbacks.push(cb);
        setTimeout(() => cb('SIGNED_IN', MOCK_SESSION), 50);
        return {
          data: {
            subscription: {
              id: 'demo-subscription',
              callback: cb,
              unsubscribe: () => {
                _authChangeCallbacks = _authChangeCallbacks.filter(c => c !== cb);
              },
            },
          },
        };
      },
      refreshSession() {
        return Promise.resolve({ data: { session: MOCK_SESSION, user: MOCK_SUPABASE_USER }, error: null });
      },
    },

    functions: {
      invoke(name: string, _opts?: any) {
        if (name === 'get-portfolio-timeseries') {
          return Promise.resolve({ data: { series: [] }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
    },

    storage: {
      from(_bucket: string) {
        return new MockStorageBucket();
      },
    },

    channel(_name: string) {
      return new MockChannel();
    },

    removeChannel(_channel: any) {
      return Promise.resolve('ok');
    },

    realtime: {
      setAuth(_token: string) {},
    },
  };
}
