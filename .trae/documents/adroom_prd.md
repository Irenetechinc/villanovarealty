## 1. Product Overview
AdRoom is an intelligent automated marketing system that manages and promotes real estate properties and live auctions on Facebook. The system uses Gemini AI to build strategic marketing campaigns, automatically posts content, manages sponsored ads, and handles Facebook interactions while maintaining the company's brand identity.

The platform solves the challenge of consistent, strategic social media marketing for real estate businesses by providing an AI-powered assistant that works autonomously after strategy approval, with integrated wallet management for ad spend tracking.

## 2. Core Features

### 2.1 User Roles
| Role | Registration Method | Core Permissions |
|------|---------------------|------------------|
| Admin | Email registration with admin privileges | Full system access, strategy approval, wallet management, campaign monitoring |
| AdRoom Bot | System-generated AI agent | Automated posting, ad placement, message handling, strategy execution |

### 2.2 Feature Module
Our AdRoom system consists of the following main pages:
1. **Admin Dashboard**: Overview of campaigns, wallet balance, transaction history, and system status.
2. **AdRoom Chat Interface**: Conversational AI interface for strategy planning and approval.
3. **Wallet Management**: Deposit funds, view transactions, and monitor credit usage.
4. **Campaign Analytics**: Track performance metrics, engagement rates, and ROI.
5. **Property Management**: Upload and manage properties for promotion.

### 2.3 Page Details
| Page Name | Module Name | Feature description |
|-----------|-------------|---------------------|
| Admin Dashboard | Campaign Overview | View active campaigns, performance metrics, and upcoming scheduled posts. |
| Admin Dashboard | Wallet Balance | Display current credit balance, recent transactions, and low balance alerts. |
| Admin Dashboard | System Status | Show AdRoom bot activity, API call usage, and Gemini AI credit consumption. |
| AdRoom Chat Interface | Strategy Planning | Chatbot collects property details, target audience, campaign duration, and budget. |
| AdRoom Chat Interface | Strategy Approval | Present comprehensive marketing plan with posting schedule, ad spend breakdown, and expected outcomes. |
| AdRoom Chat Interface | Execution Monitoring | Real-time updates on campaign progress, post performance, and automated interactions. |
| Wallet Management | Deposit Funds | Flutterwave integration for credit purchases with 45 NGN transaction fee. |
| Wallet Management | Transaction History | Detailed log of all deposits, ad spend, and credit usage with timestamps. |
| Wallet Management | Credit Alerts | Automated notifications when balance falls below threshold for planned campaigns. |
| Campaign Analytics | Performance Metrics | Track reach, engagement, click-through rates, and conversion metrics. |
| Campaign Analytics | ROI Analysis | Calculate return on investment for sponsored ads and organic posts. |
| Campaign Analytics | Audience Insights | Demographics, location data, and engagement patterns of Facebook audience. |
| Property Management | Property Upload | Add property details, images, pricing, and auction information. |
| Property Management | Property Categorization | Organize properties by type, location, and priority for targeted campaigns. |

## 3. Core Process
**Admin Flow:**
1. Admin logs into dashboard and checks wallet balance
2. If needed, admin deposits funds via Flutterwave (45 NGN fee applies)
3. Admin interacts with AdRoom chatbot to plan marketing strategy
4. AdRoom analyzes properties and creates comprehensive campaign plan
5. Admin reviews and approves strategy with specified budget and duration
6. AdRoom executes campaign autonomously: creates posts, manages ads, responds to messages
7. Admin monitors performance through dashboard analytics
8. System alerts admin when credit balance runs low

**AdRoom Bot Flow:**
1. Receives approved strategy with campaign parameters
2. Schedules organic posts based on optimal timing algorithms
3. Creates sponsored ad campaigns when budget allocated
4. Monitors Facebook page messages and responds using Gemini AI
5. Tracks engagement and adjusts posting strategy
6. Requests additional credits from wallet when ad spend required
7. Provides daily reports to admin dashboard

```mermaid
graph TD
  A[Admin Login] --> B[Dashboard Overview]
  B --> C{Check Wallet Balance}
  C -->|Low Balance| D