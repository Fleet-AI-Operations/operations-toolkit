# User Guide

Welcome to the Percentage Tool! This guide explains how to use the application to analyze task and feedback data against project guidelines.

## Overview

The Percentage Tool is designed to help quality assurance leads and AI alignment experts evaluate large datasets. It uses local AI models to provide high-quality analysis without your data leaving your machine.

## Getting Started

### 1. Creating a Project

Everything starts with a project. A project groups your data and the guidelines you want to use for evaluation.
- Navigate to the dashboard.
- Select or create a project.
- **Upload Guidelines**: Upload a PDF containing the project's quality guidelines. These will be used by the AI to score your data.

![Dashboard Interface](images/dashboard.png)
*Figure 1: The main dashboard showing project selection.*

### 2. Ingesting Data

You can import data in two ways:
- **CSV Import**: Upload a CSV file. Ensure your CSV has a `content` column and a `prompt_quality_rating` column ("Top_10" or "Bottom_10").
- **API Import**: Connect to a JSON endpoint (Currently experimental).

![Ingestion Interface](images/ingestion.png)
*Figure 2: The data ingestion screen where you can upload CSVs.*

#### The Two Phases of Ingestion
To keep the tool fast, ingestion happens in two steps:
1.  **Phase 1: Loading Data** (`PROCESSING`): Your data is parsed and saved to the database. This is very fast. Records will appear in your project list immediately.
2.  **Phase 2: Generating Embeddings** (`VECTORIZING`): The AI server processes each record for search and similarity. If the AI server is busy, you will see a **"Waiting for AI"** (`QUEUED_FOR_VEC`) status.

### 3. Analyzing Data

- **Quality Score**: This is the initial category assigned during ingestion.
- **Expand Content**: Long records are truncated for cleanliness. Simply click on the text to expand and view the full content.
- **Alignment Analysis**: Click "Generate Alignment Score" on any record to have the AI compare that specific item against your project's PDF guidelines.
- **Detailed Reports**: Click on a score badge to view the full AI-generated breakdown, including missing criteria and improvement suggestions.

### 4. Viewing All Records

The "View All" page allows you to browse, search, and filter your entire project dataset, viewing all alignment scores at once.

![Records List](images/view_all.png)
*Figure 3: The records list view showing alignment scores.*

## Key Management Features

- **Sequential AI Queuing**: You can upload multiple files at once. While they can all "load data" quickly, the system will process their AI embeddings one-by-one to prevent crashing your machine.
- **Job Control**: You can click **"Stop Ingest"** at any time to cancel active or queued jobs.
- **Data Privacy**: All analysis happens locally via LM Studio. No data is sent to external clouds.
- **Automatic Recovery**: If you refresh the page or the server restarts, the tool will automatically detect and resume any "Waiting for AI" jobs.

---

## Cost Tracking (OpenRouter Only)

If you're using OpenRouter as your AI provider, the tool provides real-time cost visibility:

### Balance Display
- The dashboard header shows your current OpenRouter credit balance
- Balance updates when the page loads

### Per-Query Costs
- After each alignment analysis, the cost is displayed in the report header
- Costs are shown in USD with high precision (6 decimal places)

### Cost Optimization Tips
- Use cached analyses when possible (the tool automatically caches alignment results)
- Choose cost-effective models in your `.env` configuration
- Monitor your balance regularly to avoid service interruption

*Note: LM Studio users see no cost information since local AI is free.*

---

## Best Practices

- **Guideline Clarity**: Ensure your PDF is text-readable (not just images) for the best AI grounding results.
- **GPU Optimization**: For the fastest "Vectorizing" phase, ensure LM Studio is configured to use GPU acceleration for your embedding model.
