# Demo Documentation: SDD vs. Implementation

Because spinning up multiple independent microservices, a Kafka cluster, and an API Gateway is overkill for a local challenge demo, we implemented a **"Vertical Slice"** of the Solution Design Document (SDD) to prove out the core concepts.

Here is exactly what from the SDD is actively running in this demo:

## 🟢 Fully Implemented in the Demo

1. **The Backend-For-Frontend Pattern (Section 2)**
   - **SDD:** Create dedicated aggregation layers.
   - **Demo:** The Node.js Express app acts exactly as the "Customer BFF" from the diagram. It sits gracefully between the React frontend UI and the (mocked) backend engines.

2. **Observability & Trace IDs (Section 5)**
   - **SDD:** Use OpenTelemetry or Correlation IDs to trace requests side-to-side.
   - **Demo:** We built an active **Observability Middleware**. Every time a quote is requested, a unique `X-Correlation-Id` is generated, logged in the backend terminal, and passed back down to the React UI where it is visibly displayed.

3. **Payment Idempotency (Section 3)**
   - **SDD:** Generate an `Idempotency-Key` to ensure duplicate payments are safely rejected.
   - **Demo:** When "Pay & Issue Policy" is clicked, the React UI generates a UUID (`Idempotency-Key`) in the POST headers. The backend actively checks its mock database and successfully returns an `HTTP 409 Conflict` to safely reject any duplicates (testable via the "Test Idempotency" button).

4. **Zero PCI Footprint / PII Security (Section 3)**
   - **SDD:** Raw credit card data never touches the BFF.
   - **Demo:** The UI directly simulates the external tokenization flow by passing a mock `paymentToken` straight to the backend without ever requesting actual Primary Account Number (PAN) details.

---

## 🔴 What is Mocked / Excluded

- **API Gateway / Auth / Kubernetes**: Physical routing rules, WAFs, and Docker containers were skipped to keep the environment fast and locally executable.
- **Actual External Microservices**: Instead of having separate hosted applications for the Quotation MS and Payment MS, the BFF simulates them internally using artificial network delays (`setTimeout`).
- **The Webhook/Saga Flow**: The transaction flow is handled synchronously for demonstration purposes rather than fully orchestrating the asynchronous `payment_intent.succeeded` webhook pattern.

---

## ❓ Common Interview Questions & Defenses

**Q: "Why didn't you just build one Shared Portal and Shared API with two different user roles (Agent vs. Customer)?"**

**A:** "In Enterprise System Design, B2C and B2B workflows are almost always separated into entirely different physical applications (and different BFF layers) for three major reasons:

1. **Bundle Size & Performance:** The Customer Portal must load extremely fast on 3G mobile networks. If we bundled heavy Agent CRM dashboards, tracking tables, and charting libraries into the exact same React application, it would severely damage the customer's mobile load time.
2. **The BFF Pattern:** The Customer API only needs to return lean, single-entity JSON objects. The Agent API, however, must perform heavy batch aggregations (e.g. hundreds of quotes at once). Separating them prevents the Customer API from becoming a massive aggregated bottleneck.
3. **Blast Radius Security:** If a developer deploys a bug that accidentally crashes the Agent reporting dashboard, physically decoupling the applications guarantees it cannot take down the direct-to-consumer sales flow."

### 💡 Presentation Tip

If asked about this demo during an interview, you can frame it as:
> *"I wrote a comprehensive architectural blueprint, and I also built a functional Proof-of-Concept demo specifically to prove out the **Correlation Tracing**, **BFF Pattern**, and **Payment Idempotency** components of my design."*
