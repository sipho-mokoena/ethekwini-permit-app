# Vercel Deployment Guide

This document explains how to deploy the eThekwini Spaza Permit PWA to Vercel with proper routing configuration.

## Problem

The application uses TanStack Router with client-side routing. When deployed to Vercel, accessing URLs directly (like `/login` or `/dashboard`) would result in a 404 error because Vercel doesn't know how to handle these client-side routes.

## Solution

We've implemented two key changes to make the application work properly on Vercel:

### 1. Vercel Configuration (`vercel.json`)

Created a `vercel.json` file in the project root with rewrite rules:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This configuration tells Vercel to serve `index.html` for all routes, allowing the client-side router to handle navigation.

### 2. Enhanced Service Worker (`public/sw.js`)

Updated the service worker to properly handle navigation requests and cache assets:

- Improved caching strategy for static assets
- Added proper handling for navigation requests
- Better error handling for offline scenarios
- Cross-origin request handling

## Deployment Steps

1. Push your code to a GitHub repository
2. Connect the repository to Vercel
3. Configure the environment variables in Vercel project settings:
   - `VITE_USE_LOCALDB` - Set to `false` for Appwrite mode
   - `VITE_APPWRITE_ENDPOINT` - Your Appwrite endpoint
   - `VITE_APPWRITE_PROJECT_ID` - Your Appwrite project ID
   - `VITE_APPWRITE_PROJECT_NAME` - Your Appwrite project name

## How It Works

1. When a user visits a URL like `/login` directly, Vercel's rewrite rule serves `index.html`
2. The React application loads and TanStack Router takes over
3. The router matches the URL to the appropriate component and renders it
4. The service worker caches assets for offline access

This approach ensures that both direct URL access and client-side navigation work correctly on Vercel.