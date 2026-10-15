\# Student Record System



A web-based Student Record System built with React, Vite, Node.js, Express, and PostgreSQL.



\## Features



\- REST API with versioned routes under `/api/v1`

\- PostgreSQL database schema and sample seed data

\- React frontend

\- Shared frontend API client

\- Health-check endpoint for verifying backend availability

\- Environment-based configuration



\## Prerequisites



\- Node.js and npm

\- PostgreSQL

\- Git



\## Project Structure



```text

student\_record\_system/

├── backend/

│   ├── scripts/

│   ├── src/

│   └── package.json

├── db/

│   ├── schema.sql

│   └── seed.sql

├── frontend/

│   ├── src/

│   ├── package.json

│   └── index.html

├── .env.example

└── README.md

```



\## Environment Configuration



Copy `.env.example` to `.env` in the repository root and configure the values for your local PostgreSQL installation.



Never commit `.env` or any real credentials.



\## Database Setup



Create a PostgreSQL database named `student\_record\_system`, then configure the connection settings in `.env`.



The repository includes `db/schema.sql` and `db/seed.sql` for creating the tables and loading sample data.



From the backend directory, the database reset script can be run with:



```bash

npm run db:reset

```



\*\*Warning:\*\* The reset script drops and recreates database tables. Use it only when you intend to reset the local database.



\## Run the Backend



Open a terminal in the `backend` directory:



```bash

npm install

npm run dev

```



The API uses port `5000` by default.



Health endpoint:



```text

http://localhost:5000/api/v1/health

```



\## Run the Frontend



Open another terminal in the `frontend` directory:



```bash

npm install

npm run dev

```



Open the local URL printed by Vite in the terminal.



The frontend uses `VITE\_API\_BASE\_URL` when configured, with `http://localhost:5000/api/v1` as its default API base URL.



\## Validation



From the frontend directory:



```bash

npm run lint

npm run build

```



These commands check the frontend code and create a production build.



\## Collaboration



\- Create feature branches for changes.

\- Submit pull requests against `main`.

\- Do not commit secrets, `.env` files, or generated build folders.

\- Review and merge changes through the team's GitHub workflow.

