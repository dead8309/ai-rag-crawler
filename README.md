<h3 align="center">ai-rag-crawler</h3>

<div align="center">

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)

</div>

---

<p align="center"> An AI RAG pipeline built with the Hono stack and Workers AI. This project uses vectorization embeddings to enable semantic search, orchestrates web scraping and data processing with Cloudflare Workflows (beta), and generates context-aware responses using AI.
    <br>
</p>

> [!NOTE]
> 
> See [How to use the frontend in live url](#how-to-use-the-frontend-in-live-url)

## 📝 Table of Contents

- [About](#about)
- [Api Flow](#api-flow)
- [How to use the frontend in live url](#how-to-use-the-frontend-in-live-url)
- [Demo](#demo)
- [Technology Stack](#tech_stack)
- [Setting up a local environment](#getting_started)
- [Usage](#usage)

## 🧐 About <a name = "about"></a>

The ideal state is having a system that can effortlessly ingest documentation from any website, understand its content semantically, and provide accurate, context-aware answers to user questions. This would allow for easy exploration and utilization of vast amounts of documentation without manual effort.

This project provides an automated RAG (Retrieval-Augmented Generation) pipeline built using serverless technologies. It takes a base URL of a documentation website, scrapes the site and all linked pages recursively, generates vector embeddings of the content, stores them in a database, and uses those embeddings to generate accurate, context-aware responses to questions. It uses _Cloudflare Workflows(Beta)_ thus providing a more resilient and scalable solution to the problem.

## Api Flow

![image](https://github.com/user-attachments/assets/4012f9a4-550a-4881-a644-e42ae9d5fc31)

## How to use the frontend in live url

Currently the database has 1 site processed properly which is
```
https://fiberplane.com/docs/get-started/
```
So to use the frontend to ask questions:

1. Head over to [https://ai-docs-rag.cjjdxhdjd.workers.dev/](https://ai-docs-rag.cjjdxhdjd.workers.dev/)
2. Enter the following url word by word in the `Enter Url` input field
   ```
   https://fiberplane.com/docs/get-started/
   ```
3. Click on `Submit URL` button
4. Enter the question you want to ask in `Ask about the URL..` field and hit `Send`
5. You will get a streaming response from workers-ai.

Alternatively you can also access all the apis through fiberplane studio to interact with the application. See [Usage](#usage)


## Demo

https://www.loom.com/share/2aae4caf3dd148cca8e4ef178cfaf851?sid=b19b308e-b514-4610-8866-aae063b164d8


## ⛏️ Built With HONC🪿<a name = "tech_stack"></a>

- [Hono](https://hono.dev/) - Web Framework
- [ORM Drizzle](https://orm.drizzle.team/) - Database access
- [Neon](https://neon.tech/) - Database platform
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless Environment
- [Cloudflare AI](https://www.cloudflare.com/products/ai/) - AI Models
- [Cloudflare Workflows](https://developers.cloudflare.com/workers/configuration/workflows/) - Durable execution framework

## 🏁 Getting Started <a name = "getting_started"></a>

These instructions will get you a copy of the project up and running on your local machine for development
and testing purposes. See [deployment](#deployment) for notes on how to deploy the project on a live system.

### Prerequisites

What things you need to install the software and how to install them.

- Node.js (v18 or higher)
- npm or pnpm
- Wrangler CLI (Cloudflare's CLI tool)

### Installing

Clone the repository:

```
git clone https://github.com/dead8309/ai-rag-crawler
cd ai-rag-crawler
```

Install the dependencies:

```
pnpm install
```

Create a `.dev.vars` file and add the following, ensure to populate the database url:

```
DATABASE_URL=YOUR_DATABASE_URL_HERE
MAX_NO_OF_PAGES_TO_SCRAPE=20
```

Setup your database by running the migrations

```
pnpm db:setup
```

Finally start the development server

```
pnpm dev
```

Start Fiberplane Studio

```
pnpm fiberplane
```

## 🎈 Usage <a name="usage"></a>

To interact with the api locally, follow these steps:

1.  **Access the Fiberplane Studio:** Open your web browser and navigate to `http://localhost:8788`.

2.  **Submit a URL for Scraping:**

    - In Fiberplane Studio, make a `POST` request to `/api/scrape/workflow`.
    - Include a JSON payload in the request body with the following structure:

    ```json
    {
      "url": "YOUR_TARGET_URL_HERE",
      "strict": "false",
      "type": "browser"
    }
    ```

    - Replace `YOUR_TARGET_URL_HERE` with the URL of the documentation website you want to process.
    - Example: `https://fiberplane.com/docs/get-started/`

3.  **Monitor the Workflow Status:**

    - After submitting the URL, the API will return a JSON response that includes a `message`, an `instanceId`, and a `details` object representing the current status.
    - Copy the returned `instanceId`.
    - To check the progress of the workflow, send a `GET` request to `/api/scrape/workflow/{instanceId}`.
    - Replace `{instanceId}` with the id you copied in the previous step.
    - The response will provide real-time details on the workflow status (e.g., queued, running, completed, errored, terminated, etc.).

4.  **Ask Questions Using the RAG Pipeline:**

    - Once the workflow status is `complete`, make a `POST` request to `/api/sites/ask` or `/api/sites/ask/stream` for a streaming response.
    - Include a JSON payload in the request body with the following structure:

      ```json
      {
        "site": "YOUR_TARGET_URL_HERE",
        "question": "YOUR_QUESTION_HERE"
      }
      ```

      - Replace `"YOUR_TARGET_URL_HERE"` with the same URL you used for scraping and `"YOUR_QUESTION_HERE"` with your specific question. For example, `"question": "How do i setup fiberplane application?"`

    - The API will return a JSON object with the `response` to your question, generated based on the scraped documentation.

**Explanation of Payloads and Endpoints:**

- **/api/scrape/workflow (POST):** Starts a new Workflow for scraping and processing a documentation website.

  - `url`: (string, required) The URL of the documentation website.
  - `strict`:(string, optional, default "false") Set to "true" for strict link following.
  - `type`:(string, optional, default "browser") Set to "fetch" to use the fetch method, or "browser" to render client side javascript pages.

- **/api/scrape/workflow/{instanceId} (GET):** Fetches the status of a specific workflow instance. Replace `{instanceId}` with the ID you received when creating the workflow.

- **/api/sites/ask (POST):** Asks a question about a specific documentation site and returns a complete response.

  - `site`: (string, required) The URL of the documentation website that was previously scraped.
  - `question`: (string, required) The question you want to ask.

- **/api/sites/ask/stream (POST):** Asks a question about a specific documentation site and returns a streamed response which makes the AI response appear piece by piece.
  - `site`: (string, required) The URL of the documentation website that was previously scraped.
  - `question`: (string, required) The question you want to ask.
