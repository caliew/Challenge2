import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:3001/api';

function App() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [vehicleType, setVehicleType] = useState('Sedan');
  const [driverAge, setDriverAge] = useState('');
  const [chaosMode, setChaosMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [correlationId, setCorrelationId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [cardTokenized, setCardTokenized] = useState(false);
  const [paymentToken, setPaymentToken] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
      } else {
        alert('Login failed. Please provide any mock email and password.');
      }
    } catch (err) {
      alert('Cannot connect to BFF Server');
    } finally {
      setLoading(false);
    }
  };
  
  const handleGetQuote = async (e) => {
    e.preventDefault();
    setLoading(true);
    setQuote(null);
    setPaymentStatus(null);
    setCardTokenized(false);
    setPaymentToken('');
    
    try {
      const res = await fetch(`${API_URL}/quote`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Chaos-Mode': chaosMode ? 'true' : 'false'
        },
        body: JSON.stringify({ vehicleType, driverAge: parseInt(driverAge) })
      });
      
      const data = await res.json();
      
      if (res.status === 401) {
          alert('Security Error: Unauthorized. Token is missing or invalid.');
          setToken('');
          return;
      }
      
      if (res.status === 503) {
          alert(`🛡️ Resiliency Block: ${data.detail}\n\nTrace ID: ${data.trace_id}`);
          return;
      }
      
      const cid = res.headers.get('x-correlation-id');
      if (cid) setCorrelationId(cid);
      
      setQuote(data);
      setIdempotencyKey(uuidv4());
    } catch (err) {
      console.error(err);
      alert('Failed to connect to BFF Server');
    } finally {
      setLoading(false);
    }
  };

  const handleTokenizeCard = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Simulate frontend securely contacting an EXTERNAL Payment Gateway to tokenize the raw card
      const externalRes = await fetch(`${API_URL.replace('/api', '')}/external-stripe-mock/tokenize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawCardData: '1234-5678-XXXX', cvc: '123' })
      });
      const data = await externalRes.json();
      if (!externalRes.ok) {
          alert(`Gateway Error: ${data.error || 'Failed to tokenize'}`);
          return;
      }
      setPaymentToken(data.token);
      setCardTokenized(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/pay`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey,
          'X-Correlation-Id': correlationId 
        },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          paymentToken: paymentToken // Now using the token we dynamically retrieved from the external mock
        })
      });
      
      const data = await res.json();
      
      if (res.status === 409) {
          alert('Idempotency conflict (409): Payment already processed!\nCheck your BFF terminal.');
          setLoading(false);
          return;
      }
      if (!res.ok) {
          alert(`Error ${res.status}: ${data.error || 'Server error'}`);
          if (res.status === 401) setToken('');
          return;
      }
      
      setPaymentStatus(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // MOCK LOGIN PORTAL UI
  // -------------------------
  if (!token) {
    return (
      <div className="app-container">
        <div className="glass-card">
          <h1>DirectASIA Portal</h1>
          <p className="subtitle">Secure Login Gateway</p>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="customer@example.com" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? <div className="spinner"></div> : 'Login & Generate JWT'}
            </button>
          </form>
          <p style={{marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center'}}>
            (For this demo, any email/password combination will securely yield a mock Signed JWT.)
          </p>
        </div>
      </div>
    );
  }

  // -------------------------
  // QUOTATION PORTAL UI
  // -------------------------
  return (
    <div className="app-container">
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h1 style={{margin: 0}}>DirectASIA Portal</h1>
            <button onClick={() => setToken('')} style={{ width: 'auto', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--error-color)', color: 'var(--error-color)', fontSize: '0.8rem'}}>Logout</button>
        </div>
        <p className="subtitle">Welcome, Customer. Create your Quote.</p>
        
        {!quote ? (
          <form onSubmit={handleGetQuote}>
            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '8px', fontSize: '0.8rem', color: '#60a5fa', lineHeight: '1.4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <b>💡 Resiliency Demo (Sec 6.1)</b>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: chaosMode ? '#f87171' : '#60a5fa' }}>
                        <input type="checkbox" checked={chaosMode} onChange={(e) => setChaosMode(e.target.checked)} />
                        <span>{chaosMode ? 'Simulating Global Outage 🌪️' : 'Simulate Global Outage'}</span>
                    </label>
                </div>
                Toggle <b>"Simulate Global Outage"</b> and request any quote 3 times to see the **Circuit Breaker** trip and fail-fast for the entire system!
            </div>
            <div className="form-group">
              <label>Vehicle Type</label>
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Sports">Sports Car</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Driver Age</label>
              <input 
                type="number" 
                min="18" 
                max="99" 
                value={driverAge} 
                onChange={(e) => setDriverAge(e.target.value)} 
                required 
                placeholder="e.g. 30"
              />
            </div>
            
            <button type="submit" disabled={loading}>
              {loading ? <div className="spinner"></div> : 'Get Free Quote'}
            </button>
          </form>
        ) : (
          <div className="quote-result">
            <p>Your tailored premium is</p>
            <h2 className="quote-amount">{quote.currency} {quote.premium}</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quote Ref: {quote.quoteId}</p>
            
            {paymentStatus ? (
               <div className="success-message">
                  ✅ {paymentStatus.message}<br/>
                  <small>Txn ID: {paymentStatus.transactionId}</small>
               </div>
            ) : !cardTokenized ? (
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <p style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
                        🔒 Step 1: Secure Frontend Tokenization<br/>
                        (Raw PAN never touches our backend)
                    </p>
                    <form onSubmit={handleTokenizeCard}>
                        <input type="text" placeholder="💳 Card Number (Mock)" required style={{width: '100%', marginBottom: '0.5rem', padding: '0.5rem'}} />
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                            <input type="text" placeholder="MM/YY" required style={{flex: 1, padding: '0.5rem'}} />
                            <input type="text" placeholder="CVC" required style={{flex: 1, padding: '0.5rem'}} />
                        </div>
                        <button type="submit" disabled={loading} style={{ backgroundColor: '#10b981', fontSize: '0.9rem' }}>
                            {loading ? <div className="spinner"></div> : 'Tokenize Securely'}
                        </button>
                    </form>
                </div>
            ) : (
                <div style={{ marginTop: '1.5rem' }}>
                    <p style={{ fontSize: '0.85rem', marginBottom: '1rem', color: '#10b981' }}>
                        ✅ Card tokenized successfully! <br/>
                        <code style={{background:'rgba(0,0,0,0.2)', padding:'0.2rem 0.4rem', borderRadius:'4px'}}>{paymentToken}</code>
                    </p>
                    <button onClick={handlePayment} disabled={loading} style={{ backgroundColor: 'var(--accent-color)' }}>
                        {loading ? <div className="spinner"></div> : 'Step 2: Pay & Issue Policy'}
                    </button>
                </div>
            )}
            
            {paymentStatus && (
                <button 
                    onClick={handlePayment} 
                    disabled={loading}
                    style={{ backgroundColor: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-muted)', marginTop: '1.5rem', fontSize: '0.85rem' }}
                >
                    Test Idempotency (Duplicate Request)
                </button>
            )}

            <button 
              onClick={() => setQuote(null)} 
              disabled={loading}
              style={{ backgroundColor: 'transparent', marginTop: '0.5rem', color: 'var(--text-muted)' }}
            >
              Start Over Quote
            </button>
          </div>
        )}
        
        {correlationId && (
            <div className="correlation-id">
                Observability Trace ID (X-Correlation-Id):<br/>
                <strong>{correlationId}</strong>
            </div>
        )}
      </div>
    </div>
  );
}

export default App;
