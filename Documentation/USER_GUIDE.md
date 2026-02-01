# User Guide

Welcome to the Operations Tools! This guide explains how to use the application to analyze task and feedback data against project guidelines.

## Overview

The Operations Tools is designed to help quality assurance leads and AI alignment experts evaluate large datasets. It uses local AI models to provide high-quality analysis without your data leaving your machine.

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

1. **Phase 1: Loading Data** (`PROCESSING`): Your data is parsed and saved to the database. This is very fast. Records will appear in your project list immediately.
2. **Phase 2: Generating Embeddings** (`VECTORIZING`): The AI server processes each record for search and similarity. If the AI server is busy, you will see a **"Waiting for AI"** (`QUEUED_FOR_VEC`) status.

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

- The top-right header (next to your email) shows your current OpenRouter credit balance (visible to Admins only).
- Balance updates automatically every minute.

### Per-Query Costs
- After each alignment analysis, the cost is displayed in the report header
- Costs are shown in USD with high precision (6 decimal places)

### Cost Optimization Tips
- Use cached analyses when possible (the tool automatically caches alignment results)
- Choose cost-effective models in your `.env` configuration
- Monitor your balance regularly to avoid service interruption

*Note: LM Studio users see no cost information since local AI is free.*

---

---

## Time Tracking and Bonus Management (Manager/Admin Only)

The Time and Bonus section provides managers and administrators with tools to track team performance and manage bonus qualification periods.

### Bonus Windows

Bonus windows are time-bounded performance periods where team members work toward collective targets. This feature enables you to:

- **Configure Performance Windows**: Set start and end times for bonus periods
- **Set Tiered Targets**: Define separate targets for tasks and feedback records
  - **Tier 1**: Base bonus qualification targets
  - **Tier 2**: Enhanced bonus targets (optional)
- **Track Progress**: Real-time progress bars show collective team advancement
- **Review User Contributions**: Detailed breakdown showing individual user contributions with tier achievement badges

#### Creating a Bonus Window

1. Navigate to **Operations Tools → Time Tracking**
2. Click the **Bonus Windows** tab.
3. Click "New Bonus Window"
4. Configure:
   - **Window Name**: Descriptive name (e.g., "Q1 2024 Performance Period")
   - **Start/End Times**: Define the time period
   - **Tier 1 Targets**: Set task and feedback count targets (set to 0 to skip either)
   - **Tier 2 Targets** (Optional): Set higher targets for enhanced bonuses
5. Click "Create Window"

#### Understanding Tier Qualification

- **Tier 1 (T1)**: Users who meet the base task and feedback targets
- **Tier 2 (T2)**: Users who meet the enhanced task and feedback targets
- Users must meet **both** task and feedback targets for their respective tier
- Tier badges appear next to counts in the user breakdown

#### Monitoring Progress

- Color-coded progress bars indicate completion status:
  - 🔴 Red (0-49%): Below target
  - 🟠 Orange (50-74%): Approaching target
  - 🔵 Blue (75-99%): Near completion
  - 🟢 Green (100%+): Target met

---

## Best Practices

- **Guideline Clarity**: Ensure your PDF is text-readable (not just images) for the best AI grounding results.
- **GPU Optimization**: For the fastest "Vectorizing" phase, ensure LM Studio is configured to use GPU acceleration for your embedding model.
- **Bonus Window Timing**: Configure bonus windows in advance to give team members clear visibility on targets and timelines.
