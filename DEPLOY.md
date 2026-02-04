# Deploy Memos to Vercel with GitHub Issues Backend

This version of Memos uses GitHub Issues as a backend to store your memos. Each memo is stored as a GitHub Issue in your repository.

## How It Works

- **Memos** are stored as GitHub Issues with the `memo` label
- **Tags** are stored as GitHub labels prefixed with `tag:`
- **Pinned memos** have the `pinned` label
- **Private memos** have the `private` label
- **Deleted memos** are closed and marked with `archived` label

## Prerequisites

1. A GitHub account
2. A GitHub repository (can be private) to store your memos
3. A GitHub Personal Access Token with `repo` scope

## Setup Instructions

### 1. Create a GitHub Repository

Create a new repository on GitHub to store your memos. You can make it private if you want your memos to be private.

### 2. Generate a Personal Access Token

1. Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens/new?scopes=repo&description=Memos%20App)
2. Create a new token with the `repo` scope
3. Copy the token (you won't be able to see it again)

### 3. Deploy to Vercel

#### Option A: Deploy with Vercel Button

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/memos)

#### Option B: Deploy via CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Follow the prompts to configure your project.

#### Option C: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." > "Project"
3. Import your GitHub repository
4. Vercel will automatically detect the configuration
5. Click "Deploy"

### 4. Configure the App

After deployment, visit your deployed URL and:

1. Enter your GitHub Personal Access Token
2. Enter the repository owner (your GitHub username or organization)
3. Enter the repository name
4. Click "Connect"

Your memos will now be stored as GitHub Issues in your repository.

## Features

- **Markdown Support**: Write memos in Markdown with full GFM support
- **Tags**: Use `#hashtags` in your memos to organize them
- **Pinning**: Pin important memos to the top
- **Search**: Search through all your memos
- **Dark Mode**: Automatic dark mode based on system preference
- **Privacy**: Your token is stored locally in your browser

## Local Development

```bash
# Navigate to web directory
cd web

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3001` to see the app.

## Build for Production

```bash
cd web
npm run build
```

The built files will be in the `web/dist` directory.

## Security Notes

- Your GitHub token is stored only in your browser's localStorage
- The token is never sent to any server except GitHub's API
- Using a private repository ensures your memos are not publicly visible
- The token only needs `repo` scope for reading/writing issues

## Troubleshooting

### "Not authenticated" error
- Check that your token hasn't expired
- Verify the token has `repo` scope
- Clear localStorage and sign in again

### "Not Found" error
- Verify the repository owner and name are correct
- Ensure your token has access to the repository

### Labels not appearing
- The app automatically creates required labels on first use
- If labels are missing, try signing out and signing in again
