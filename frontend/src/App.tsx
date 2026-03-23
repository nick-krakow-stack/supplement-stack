import { useEffect, useState } from 'react';

type Ingredient = { id: number; name: string; unit?: string; description?: string };
type Product = { id: number; name: string; brand?: string; price: number; form?: string; visibility?: string };

const API_BASE = '/api';

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [search, setSearch] = useState('Mag');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState('');

  const fetchIngredients = async (query: string) => {
    const res = await fetch(`${API_BASE}/ingredients/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setIngredients(data.ingredients || []);
  };

  const fetchProducts = async () => {
    const res = await fetch(`${API_BASE}/products`);
    const data = await res.json();
    setProducts(data.products || []);
  };

  useEffect(() => {
    fetchIngredients(search);
    fetchProducts();
  }, []);

  const register = async () => {
    const res = await fetch(`${API_BASE}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify({email, password})});
    const data = await res.json();
    if (res.ok) { setToken(data.token); setMessage('Registrierung erfolgreich'); } else { setMessage(JSON.stringify(data)); }
  };

  const login = async () => {
    const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify({email, password})});
    const data = await res.json();
    if (res.ok) { setToken(data.token); setMessage('Login erfolgreich'); } else { setMessage(JSON.stringify(data)); }
  };

  const addIngredient = async () => {
    const name = prompt('Wirkstoff-Name?')?.trim();
    if (!name) return;
    const res = await fetch(`${API_BASE}/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    setMessage(res.ok ? `Wirkstoff erstellt: ${data.id}` : `Fehler: ${JSON.stringify(data)}`);
    fetchIngredients(search);
  };

  return (
    <div className="app">
      <header>
        <h1>Supplement Stack</h1>
      </header>
      <div className="grid">
        <section className="card">
          <h2>Auth</h2>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Passwort" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={register}>Register</button>
          <button onClick={login}>Login</button>
          <p>Token: {token ? '✔️ vorhanden' : 'keiner'}</p>
        </section>

        <section className="card">
          <h2>Wirkstoffsuche</h2>
          <div className="stack-row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
            <button onClick={() => fetchIngredients(search)}>Suchen</button>
          </div>
          <ul>
            {ingredients.map((ingredient) => (
              <li key={ingredient.id}>{ingredient.name} {ingredient.unit ? `(${ingredient.unit})` : ''}</li>
            ))}
          </ul>
          <button onClick={addIngredient}>Neuer Wirkstoff (Admin)</button>
        </section>

        <section className="card">
          <h2>Produkte</h2>
          <button onClick={fetchProducts}>Refresh</button>
          <ul>
            {products.map((prod) => (
              <li key={prod.id}>{prod.name} ({prod.brand || 'Marke'}): €{prod.price.toFixed(2)} [{prod.visibility}]</li>
            ))}
          </ul>
        </section>
      </div>
      <div className="footer">{message}</div>
    </div>
  );
}

export default App;
