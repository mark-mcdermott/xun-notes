# Blog Publishing Setup Guide

The publishing feature is now fully integrated into Olite! Here's how to use it.

## Overview

Olite can now publish your tagged content directly to your blog repositories on GitHub, with automatic deployment via Vercel. The system provides real-time progress tracking as your content is pushed and deployed.

## What's Been Built

### Backend
- **GitHub API Client** (`src/main/publish/GitHubClient.ts`) - Handles commits and pushes to your blog repos
- **Vercel API Client** (`src/main/publish/VercelClient.ts`) - Monitors deployment status and progress
- **PublishManager** (`src/main/publish/PublishManager.ts`) - Orchestrates the complete workflow
- **ConfigManager** (`src/main/publish/ConfigManager.ts`) - Stores blog configurations securely

### Frontend
- **PublishSettings** - Configure your blog targets (access via Settings button or Cmd+,)
- **PublishDialog** - Publish a tag with real-time progress tracking
- **TagView Integration** - "Publish to Blog" button on every tag view

## How to Set Up Your First Blog

### 1. Open Settings
- Click the ⚙️ Settings button in the top-right corner
- Or press **Cmd+,** (Mac) / **Ctrl+,** (Windows/Linux)

### 2. Add a Blog Configuration
Click "Add Blog" and fill in the following:

#### Basic Info
- **Blog Name**: A friendly name (e.g., "My Personal Blog")

#### GitHub Configuration
- **Repository**: Your repo in `username/repo-name` format
- **Branch**: The branch to push to (usually `main` or `master`)
- **Personal Access Token**: Your GitHub PAT with `repo` and `workflow` permissions
  - Create at: https://github.com/settings/tokens

#### Vercel Configuration
- **Project ID**: Found in Vercel Project Settings → General
- **Team ID** (optional): If using a team account
- **API Token**: Create at https://vercel.com/account/tokens

#### Content Configuration
- **Content Path**: Where to write files in your repo (e.g., `src/content/posts/`)
- **Filename Template**: Use `{tag}.md` to name files by tag

### 3. Save Your Configuration

## How to Publish

### From a Tag View
1. Navigate to any tag in the Tags sidebar
2. Click the **📤 Publish to Blog** button
3. Select which blog to publish to (if you have multiple)
4. Click **Publish**

### Progress Tracking
You'll see real-time updates as the publish progresses:
- ✓ Preparing content
- ✓ Pushing to GitHub
- ✓ Waiting for Vercel build
- ✓ Deployment complete

## Publishing Workflow

When you publish a tag, here's what happens:

1. **Content Preparation** - All content tagged with the selected tag is aggregated from your daily notes
2. **GitHub Push** - The content is committed and pushed to your blog repository
3. **Vercel Detection** - Vercel automatically detects the push and starts building
4. **Deployment Monitoring** - Olite polls Vercel's API to track build progress
5. **Completion** - You're notified when the deployment is live

## Security Notes

- All tokens are stored locally in `.olite/publish-config.json` in your vault
- Tokens are never transmitted anywhere except to GitHub and Vercel APIs
- The configuration file is automatically added to `.gitignore`

## Troubleshooting

### "No Blogs Configured"
You need to add at least one blog configuration in Settings before publishing.

### GitHub Authentication Fails
- Verify your PAT has `repo` and `workflow` permissions
- Check that the repository name is correct (`username/repo-name`)

### Vercel Deployment Not Found
- Ensure your GitHub repo is connected to Vercel
- Verify the Project ID is correct
- Check that auto-deployment is enabled in Vercel settings

### Build Timeout
- Default timeout is 10 minutes
- Check Vercel dashboard for build errors
- Ensure your blog's build command works locally

## Next Steps

Once you have a blog configured, you can:
- Publish any tag to your blog with one click
- Update published content by republishing the same tag
- Configure multiple blogs for different types of content
- Track deployment progress in real-time

## Example Workflow

1. Write daily notes with tags like `#blog-ideas`
2. When ready, click a tag to view all aggregated content
3. Click "Publish to Blog"
4. Watch as it deploys to your live site
5. Your blog is updated automatically!

---

**Built with:** GitHub API, Vercel API, TypeScript, React
