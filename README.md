live link https://vikralscamshield.vercel.app/




# Vikral — AI-Powered Digital Risk Protection

**Detect digital threats. Investigate suspicious identities. Protect your brand.**

Vikral is a digital risk protection platform designed to help organizations identify and investigate potential brand impersonation, suspicious social media profiles, and fraudulent mobile applications. It combines deterministic threat detection with AI-assisted contextual analysis to support evidence-based cybersecurity decisions.

## Overview

Organizations face growing risks from fake social media accounts, misleading brand pages, and mobile applications that may impersonate legitimate businesses. Vikral provides a centralized platform to discover suspicious digital assets, examine risk indicators, and review supporting evidence.

The platform focuses on transparent analysis: detection signals and risk scores are kept separate from AI-generated explanations, and findings are presented with their evidence and limitations.

## Key Features

- **Brand Profile Management** — Define legitimate brand identities, trusted domains, official social accounts, and other brand assets.
- **Social Media Monitoring** — Search public Bluesky profiles for potentially suspicious identities.
- **Mobile App Monitoring** — Search the Apple App Store for applications that may impersonate a brand.
- **Threat Detection Engine** — Evaluate digital identities using deterministic rules and risk indicators.
- **AI-Assisted Analysis** — Provide contextual explanations and investigation guidance using a configurable LLM provider.
- **Evidence Tracking** — Preserve source information and provenance for investigation findings.
- **Duplicate Detection** — Identify previously recorded evidence to reduce redundant investigations.
- **Unified Dashboard** — Review potential threats, risk signals, and investigation results in one interface.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | CSS |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB, Mongoose |
| AI integration | OpenRouter-compatible LLM API |
| Social data source | Public Bluesky API |
| Mobile app data source | Apple iTunes Search API |
| Frontend hosting | Vercel |
| Backend hosting | Render |

## Architecture

```text
User
  |
  v
React + TypeScript Frontend
  |
  | HTTPS API requests
  v
Node.js + Express Backend
  |
  +---- Threat Detection Engine
  |
  +---- Bluesky Public API
  |
  +---- Apple App Store Search API
  |
  +---- OpenRouter LLM API
  |
  +---- MongoDB
```

The frontend communicates with the backend through HTTP API requests. The backend handles provider integrations, detection logic, evidence processing, database operations, and optional AI-assisted interpretation.

## Project Structure

```text
vikral/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── styles/
│   │   └── types/
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
├── package.json
├── package-lock.json
├── render.yaml
└── README.md
```

*The backend structure shown is representative. Exact files and folders may vary by version.*

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js compatible with the project's package configuration
- npm
- MongoDB database, local or MongoDB Atlas
- OpenRouter API key if AI-assisted analysis is enabled

### 1. Clone the Repository

```bash
git clone https://github.com/rajgupta6282941-commits/hackathonproject01.git
cd hackathonproject01
```

### 2. Install Dependencies

Install root dependencies if the root `package.json` defines them:

```bash
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Install backend dependencies:

```bash
cd ../backend
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the backend directory and add the variables required by the backend configuration.

Example:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=your_mongodb_connection_string
OPENROUTER_API_KEY=your_openrouter_api_key
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Use the exact environment variable names expected by your backend source code. If your implementation uses a different LLM key name, configure that name instead.

For the frontend, create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

Adjust the local backend URL and port to match your configuration.

**Security:** Never commit real API keys, database credentials, or `.env` files to GitHub. Keep secrets in environment variables on your hosting provider.

### 4. Run the Backend

```bash
cd backend
npm run build
npm start
```

Use the development script from `backend/package.json` if you want automatic restarts while coding.

### 5. Run the Frontend

Open a separate terminal:

```bash
cd frontend
npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:5173`.

Check the actual scripts in each `package.json` if a command differs.

## API Integrations

### Bluesky

Vikral uses the public Bluesky API to search for publicly available profiles. Returned profile information can be examined by the threat detection engine.

### Apple App Store

Vikral uses Apple's public iTunes Search API to find applications matching a search query. Results can be investigated for potential brand impersonation indicators.

### OpenRouter

An OpenRouter-compatible language model can provide contextual explanations and recommended investigation steps. AI analysis supplements the detection engine; it does not establish that an account or application is malicious.

### MongoDB

MongoDB provides persistent storage for supported application data, including brand profiles and investigation evidence, depending on the configured implementation.

## Deployment

### Frontend — Vercel

1. Import the GitHub repository into Vercel.
2. Set the root directory to `frontend`.
3. Select Vite if framework detection does not configure it automatically.
4. Add `VITE_API_BASE_URL` with the deployed backend's base URL.
5. Deploy the frontend.
6. Configure the backend's CORS allowlist to include the deployed frontend origin.

### Backend — Render

1. Create a Node.js web service connected to the GitHub repository.
2. If the repository contains the project root, configure the appropriate root directory. If the backend is in a separate repository with its files at the root, leave the root directory blank.
3. Configure the build and start commands to match the backend's `package.json`.
4. Set production environment variables, including `MONGODB_URI` and the required CORS configuration.
5. Ensure MongoDB Atlas permits connections from the hosting environment.
6. Deploy and review logs to verify successful startup.

Do not assume deployment is successful until the backend starts, connects to the database, and responds to API requests.

## Security and Responsible Use

- Use public or otherwise authorized data sources.
- Do not treat a similar username, logo, or domain as conclusive proof of fraud.
- A domain outside a brand's trusted list is not automatically malicious.
- Risk scores indicate assessed risk, not a probability of fraud.
- Review supporting evidence before taking action against an account or application.
- Keep credentials server-side and configure production CORS restrictions.
- Handle provider errors and rate limits responsibly.

## Limitations

- Monitoring coverage depends on the available APIs and their search capabilities.
- Public search results may not include every relevant account or application.
- A detection result may be incomplete or produce false positives.
- AI-generated explanations can be incorrect and should be reviewed.
- Provider availability, network connectivity, and database configuration affect functionality.

Vikral is an investigation-support tool, not a substitute for professional security review or a guarantee of threat detection.

## Future Improvements

- Additional social platform integrations
- Scheduled monitoring and change detection
- Email or dashboard alerts for emerging risks
- Expanded domain and phishing intelligence
- Advanced evidence correlation and reporting
- Role-based access control and audit logs

## Contributing

Contributions, bug reports, and feature suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make and test your changes.
4. Open a pull request describing the changes.

## License

No license has been specified yet. Add a `LICENSE` file before granting others explicit permission to reuse, modify, or distribute this project.

---

**Vikral — Digital risk intelligence for a safer online ecosystem.**
