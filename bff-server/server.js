import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 3001;
const JWT_SECRET = 'DirectAsia_Challenge2_Secure_Secret_Phrase_2026';

// =========================================================================
// 🛡️ RESILIENCY LAYER: CIRCUIT BREAKER (Section 6.1)
// =========================================================================
class CircuitBreaker {
    constructor(serviceName, failureThreshold = 3, recoveryTimeout = 10000) {
        this.serviceName = serviceName;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
        this.nextAttempt = Date.now();
    }

    async fire(action) {
        if (this.state === 'OPEN') {
            if (Date.now() > this.nextAttempt) {
                console.log(`[Resilience] 🏥 Circuit for ${this.serviceName} is HALF-OPEN. Attempting recovery...`);
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('CIRCUIT_OPEN');
            }
        }

        try {
            const result = await action();
            this.success();
            return result;
        } catch (err) {
            this.failure(err);
            throw err;
        }
    }

    success() {
        if (this.state === 'HALF_OPEN') {
            console.log(`[Resilience] ✅ Circuit for ${this.serviceName} has RECOVERED and is now CLOSED.`);
        }
        this.state = 'CLOSED';
        this.failureCount = 0;
    }

    failure(err) {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
            console.warn(`[Resilience] ⚠️ CIRCUIT TRIPPED: ${this.serviceName} is now OPEN. Firing error: ${err.message}`);
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.recoveryTimeout;
        }
    }
}

const quoteBreaker = new CircuitBreaker('QuotationMicroservice');

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

// =========================================================================
// 🛡️ EXTERNAL 3RD-PARTY MOCK (e.g., Stripe / Adyen APIs)
// NOTE: In the real world, this endpoint physically lives on Stripe's servers.
// We are hosting it here purely to mock the network hop for the local demo.
// It bypasses JWT Auth because it represents a totally separate public API.
// =========================================================================
app.post('/external-stripe-mock/tokenize', async (req, res) => {
    console.log(`\n[EXTERNAL STRIPE MOCK] 🌐 Frontend contacted us directly with raw card details.`);
    
    // The raw card details are processed here...
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // The external gateway returns a token and strips all sensitive PAN data
    const generatedToken = `tok_visa_${uuidv4().substring(0, 8)}`;
    console.log(`[EXTERNAL STRIPE MOCK] ✅ Card tokenized successfully. Returning token [${generatedToken}] directly to Frontend browser.`);
    
    res.json({ token: generatedToken });
});

// Route: Mock Login (OIDC Identity Provider flow)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    console.log(`[Trace: ${req.correlationId}] Login attempt for ${email}`);
    
    // Accept any mock login for demo purposes
    if (email && password) {
        // Generate a REAL signed JWT token
        const tokenPayload = { 
            sub: email, 
            name: 'Honest Customer', 
            role: 'customer',
            iat: Math.floor(Date.now() / 1000)
        };
        
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
        
        console.log(`[Trace: ${req.correlationId}] 🔓 Identity: Authentication successful. Issued REAL JWT for ${email}`);
        return res.json({ token, user: email });
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
    
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        console.log(`[Trace: ${req.correlationId}] 🔒 Security: JWT Auth Token cryptographically VALIDATED! Access Granted for ${decoded.sub}.`);
        next();
    } catch (err) {
        console.warn(`[Trace: ${req.correlationId}] ❌ Security: JWT Verification FAILED! Error: ${err.message}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired JWT token.' });
    }
});

// Mock Quotation External Service Call
const callQuotationService = async (data, isChaosMode = false) => {
    // RESILIENCE: Enforce a hard timeout
    return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Downstream Service Timeout (Hanging)'));
        }, 2000);

        // CHAOS INJECTION: Simulate failure if X-Chaos-Mode header is detected
        let delay = 800;
        if (isChaosMode) {
            console.log(`[Chaos Engine] 🌪️ Simulating global infrastructure lag...`);
            delay = 5000; // Will trigger timeout
        }

        await new Promise(res => setTimeout(res, delay));
        clearTimeout(timeout);
        
        let basePremium = 500;
        if (data.vehicleType === 'SUV') basePremium += 200;
        if (data.vehicleType === 'Sports') basePremium += 500;
        if (data.driverAge < 25) basePremium += 300;
        
        resolve({
            quoteId: `QT-${Math.floor(Math.random() * 10000)}`,
            premium: basePremium,
            currency: 'SGD',
            status: 'QUOTED'
        });
    });
};

app.post('/api/quote', async (req, res) => {
    console.log(`[Trace: ${req.correlationId}] Received quote request from Customer Portal.`);
    try {
        const { vehicleType, driverAge } = req.body;
        if (!vehicleType || !driverAge) return res.status(400).json({ error: 'Missing required fields' });

        console.log(`[Trace: ${req.correlationId}] Forwarding to Quotation Microservice via CircuitBreaker...`);
        
        // RESILIENCE: Check for Chaos Mode signal from Frontend
        const isChaosMode = req.header('X-Chaos-Mode') === 'true';
        
        // RESILIENCE: Wrap the call in the breaker
        const quote = await quoteBreaker.fire(() => callQuotationService({ vehicleType, driverAge }, isChaosMode));
        
        res.json(quote);
    } catch (error) {
        if (error.message === 'CIRCUIT_OPEN') {
            console.warn(`[Trace: ${req.correlationId}] 🛡️ Circuit is OPEN. Failing fast to protect system resources.`);
            return res.status(503).json({ 
                error: 'Service Temporarily Unavailable',
                detail: 'Our downstream quotation engine is experiencing high latency. Circuit Breaker is active to maintain overall portal stability. Please try again in a few seconds.',
                trace_id: req.correlationId
            });
        }
        console.error(`[Trace: ${req.correlationId}] Request Failed: ${error.message}`);
        res.status(500).json({ error: error.message, trace_id: req.correlationId });
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
