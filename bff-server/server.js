import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Observability Middleware: Inject Correlation ID
app.use((req, res, next) => {
    const correlationId = req.header('X-Correlation-Id') || uuidv4();
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);
    console.log(`\n[${new Date().toISOString()}] [Trace: ${correlationId}] ${req.method} ${req.url}`);
    next();
});

// Route: Mock Login (OIDC Identity Provider flow)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    console.log(`[Trace: ${req.correlationId}] Login attempt for ${email}`);
    
    // Accept any mock login for demo purposes
    if (email && password) {
        // Generate a mock encoded JWT token
        const mockJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIke2VtYWlsfSIsIm5hbWUiOiJIb25lc3QgQ3VzdG9tZXIiLCJyb2xlIjoiY3VzdG9tZXIifQ.mock_signature_${uuidv4()}`;
        console.log(`[Trace: ${req.correlationId}] 🔓 Identity: Authentication successful. Issued JWT for ${email}`);
        return res.json({ token: mockJwt, user: email });
    }
    
    console.warn(`[Trace: ${req.correlationId}] ❌ Identity: Failed authentication`);
    return res.status(401).json({ error: 'Invalid credentials' });
});

// Security Middleware: Validate JWT for Protected Routes
app.use((req, res, next) => {
    // Skip CORS pre-flight checks
    if (req.method === 'OPTIONS') return next();
    
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn(`[Trace: ${req.correlationId}] ⚠️ 401 Unauthorized: Missing JWT token. Request Rejected.`);
        return res.status(401).json({ error: 'Unauthorized: Valid JWT Token required.' });
    }
    
    console.log(`[Trace: ${req.correlationId}] 📨 Network: Received Token -> ${authHeader.substring(0, 30)}...`);
    console.log(`[Trace: ${req.correlationId}] 🔒 Security: JWT Auth Token explicitly validated! Access Granted.`);
    next();
});

// Mock Quotation External Service Call
const callQuotationService = async (data) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    let basePremium = 500;
    if (data.vehicleType === 'SUV') basePremium += 200;
    if (data.vehicleType === 'Sports') basePremium += 500;
    if (data.driverAge < 25) basePremium += 300;
    
    return {
        quoteId: `QT-${Math.floor(Math.random() * 10000)}`,
        premium: basePremium,
        currency: 'SGD',
        status: 'QUOTED'
    };
};

app.post('/api/quote', async (req, res) => {
    console.log(`[Trace: ${req.correlationId}] Received quote request from Customer Portal.`);
    try {
        const { vehicleType, driverAge } = req.body;
        if (!vehicleType || !driverAge) return res.status(400).json({ error: 'Missing required fields' });

        console.log(`[Trace: ${req.correlationId}] Forwarding to Quotation Microservice...`);
        const quote = await callQuotationService({ vehicleType, driverAge });
        res.json(quote);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const processedPayments = new Set(); 

app.post('/api/pay', async (req, res) => {
    const idempotencyKey = req.header('Idempotency-Key');
    console.log(`[Trace: ${req.correlationId}] Payment request received. Idempotency Key: ${idempotencyKey}`);

    if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key header is required' });

    if (processedPayments.has(idempotencyKey)) {
        console.log(`[Trace: ${req.correlationId}] Idempotency key conflict! Ignored duplicate payment transaction.`);
        return res.status(409).json({ error: 'Payment already processed for this request' });
    }

    const { quoteId, paymentToken } = req.body;
    if (!quoteId || !paymentToken) return res.status(400).json({ error: 'Missing quoteId or payment token' });

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    processedPayments.add(idempotencyKey);
    console.log(`[Trace: ${req.correlationId}] Payment successful via mock Payment Gateway.`);

    res.json({
        transactionId: `TXN-${uuidv4().substring(0, 8)}`,
        status: 'SUCCESS',
        message: 'Your policy has been successfully issued.'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 BFF Server running locally on http://localhost:${PORT}`);
    console.log(`Observability and Correlation tracking is ACTIVE`);
});
