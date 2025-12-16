#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKFLOW_DIR = path.join(process.cwd(), '.github', 'workflows');
const PACKAGE_JSON_PATH = path.join(process.cwd(), 'package.json');

const RELEASE_WORKFLOW = `name: Build and Release Electron App

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g., 1.0.0)'
        required: false
        default: ''

jobs:
  build-windows:
    runs-on: windows-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Build Electron app for Windows
        env:
          GH_TOKEN: \${{ secrets.GH_TOKEN }}
        run: npm run electron:build:win

      - name: Upload Windows artifacts
        uses: actions/upload-artifact@v4
        with:
          name: windows-build
          path: |
            dist-electron/*.exe
            dist-electron/*.msi
          retention-days: 30

  build-mac:
    runs-on: macos-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Build Electron app for macOS
        env:
          GH_TOKEN: \${{ secrets.GH_TOKEN }}
        run: npm run electron:build:mac

      - name: Upload macOS artifacts
        uses: actions/upload-artifact@v4
        with:
          name: macos-build
          path: |
            dist-electron/*.dmg
            dist-electron/*.zip
          retention-days: 30

  build-linux:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Build Electron app for Linux
        env:
          GH_TOKEN: \${{ secrets.GH_TOKEN }}
        run: npm run electron:build:linux

      - name: Upload Linux artifacts
        uses: actions/upload-artifact@v4
        with:
          name: linux-build
          path: |
            dist-electron/*.AppImage
            dist-electron/*.deb
            dist-electron/*.rpm
          retention-days: 30

  release:
    needs: [build-windows, build-mac, build-linux]
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download Windows artifacts
        uses: actions/download-artifact@v4
        with:
          name: windows-build
          path: ./release/windows

      - name: Download macOS artifacts
        uses: actions/download-artifact@v4
        with:
          name: macos-build
          path: ./release/macos

      - name: Download Linux artifacts
        uses: actions/download-artifact@v4
        with:
          name: linux-build
          path: ./release/linux

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            ./release/windows/*
            ./release/macos/*
            ./release/linux/*
          draft: false
          prerelease: false
          generate_release_notes: true
        env:
          GITHUB_TOKEN: \${{ secrets.GH_TOKEN }}
`;

const WINDOWS_ONLY_WORKFLOW = `name: Build Windows Electron App

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-and-release-windows:
    runs-on: windows-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Build and publish Electron app
        env:
          GH_TOKEN: \${{ secrets.GH_TOKEN }}
        run: npm run electron:publish:win

      - name: Upload artifacts (backup)
        uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: |
            dist-electron/*.exe
            dist-electron/*.msi
          retention-days: 30
`;

const ELECTRON_BUILDER_CONFIG = {
  appId: "com.yourcompany.paintpulse",
  productName: "PaintPulse",
  copyright: "Copyright © 2024",
  directories: {
    output: "dist-electron",
    buildResources: "electron/build"
  },
  files: [
    "dist/**/*",
    "electron/**/*",
    "!electron/build/**/*"
  ],
  extraMetadata: {
    main: "electron/main.js"
  },
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64", "ia32"]
      },
      {
        target: "portable",
        arch: ["x64"]
      }
    ],
    icon: "electron/build/icon.ico",
    artifactName: "${productName}-Setup-${version}.${ext}"
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "PaintPulse"
  },
  mac: {
    target: ["dmg", "zip"],
    icon: "electron/build/icon.icns",
    category: "public.app-category.business"
  },
  linux: {
    target: ["AppImage", "deb", "rpm"],
    icon: "electron/build/icon.png",
    category: "Office"
  },
  publish: {
    provider: "github",
    owner: "YOUR_GITHUB_USERNAME",
    repo: "YOUR_REPO_NAME",
    releaseType: "release"
  }
};

const NPM_SCRIPTS = {
  "electron:dev": "cross-env NODE_ENV=development electron electron/main.js",
  "electron:build": "npm run build && electron-builder --config electron-builder.json",
  "electron:build:win": "npm run build && electron-builder --win --config electron-builder.json",
  "electron:build:mac": "npm run build && electron-builder --mac --config electron-builder.json",
  "electron:build:linux": "npm run build && electron-builder --linux --config electron-builder.json",
  "electron:publish:win": "npm run build && electron-builder --win --publish always --config electron-builder.json",
  "electron:publish:mac": "npm run build && electron-builder --mac --publish always --config electron-builder.json",
  "electron:publish:linux": "npm run build && electron-builder --linux --publish always --config electron-builder.json",
  "electron:publish:all": "npm run build && electron-builder --win --mac --linux --publish always --config electron-builder.json"
};

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

function createWorkflowFile(filename, content) {
  ensureDirectoryExists(WORKFLOW_DIR);
  const filePath = path.join(WORKFLOW_DIR, filename);
  fs.writeFileSync(filePath, content);
  console.log(`Created workflow: ${filePath}`);
}

function updatePackageJson() {
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    console.error('package.json not found!');
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  
  Object.assign(packageJson.scripts, NPM_SCRIPTS);
  
  if (!packageJson.build) {
    packageJson.build = {};
  }
  packageJson.build.extends = null;
  
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2));
  console.log('Updated package.json with Electron scripts');
  return true;
}

function createElectronBuilderConfig() {
  const configPath = path.join(process.cwd(), 'electron-builder.json');
  fs.writeFileSync(configPath, JSON.stringify(ELECTRON_BUILDER_CONFIG, null, 2));
  console.log(`Created electron-builder.json`);
}

function createBuildResourcesDir() {
  const buildDir = path.join(process.cwd(), 'electron', 'build');
  ensureDirectoryExists(buildDir);
  
  const placeholderInfo = `# Build Resources Directory

Place your app icons here:
- icon.ico (Windows) - 256x256 or larger
- icon.icns (macOS) - Use iconutil to create from iconset
- icon.png (Linux) - 512x512 recommended

You can use tools like:
- https://icoconvert.com/ for .ico
- https://cloudconvert.com/png-to-icns for .icns
`;
  
  fs.writeFileSync(path.join(buildDir, 'README.md'), placeholderInfo);
  console.log('Created electron/build directory for icons');
}

function printGitHubTokenInstructions() {
  console.log(`
================================================================================
                    GITHUB TOKEN SETUP INSTRUCTIONS
================================================================================

To enable automatic publishing to GitHub Releases, follow these steps:

1. CREATE A PERSONAL ACCESS TOKEN:
   - Go to GitHub.com -> Settings -> Developer settings -> Personal access tokens
   - Click "Tokens (classic)" -> "Generate new token (classic)"
   - Give it a descriptive name like "Electron App Releases"
   - Select these scopes:
     * repo (Full control of private repositories)
     * write:packages (if you want to publish to GitHub Packages)
   - Click "Generate token" and COPY the token immediately

2. ADD TOKEN TO REPOSITORY SECRETS:
   - Go to your repository on GitHub
   - Click Settings -> Secrets and variables -> Actions
   - Click "New repository secret"
   - Name: GH_TOKEN
   - Value: Paste your personal access token
   - Click "Add secret"

3. UPDATE electron-builder.json:
   - Open electron-builder.json
   - Replace "YOUR_GITHUB_USERNAME" with your GitHub username
   - Replace "YOUR_REPO_NAME" with your repository name

4. CREATE A RELEASE:
   - Commit and push your changes
   - Create a new tag: git tag v1.0.0
   - Push the tag: git push origin v1.0.0
   - GitHub Actions will automatically build and release

MANUAL TRIGGER:
   - Go to Actions tab in your repository
   - Select the workflow
   - Click "Run workflow"

================================================================================
`);
}

function printSummary(options) {
  console.log(`
================================================================================
                           SETUP COMPLETE
================================================================================

Files created/updated:
  - .github/workflows/release.yml (${options.windowsOnly ? 'Windows only' : 'Multi-platform'})
  - electron-builder.json
  - package.json (scripts added)
  - electron/build/ (icon directory)

New npm scripts available:
  - npm run electron:dev          - Run Electron in development
  - npm run electron:build        - Build for current platform
  - npm run electron:build:win    - Build Windows installer
  - npm run electron:build:mac    - Build macOS installer
  - npm run electron:build:linux  - Build Linux packages
  - npm run electron:publish:win  - Build and publish Windows
  - npm run electron:publish:mac  - Build and publish macOS
  - npm run electron:publish:linux - Build and publish Linux
  - npm run electron:publish:all  - Build and publish all platforms

Next steps:
  1. Add your app icons to electron/build/
  2. Update electron-builder.json with your GitHub username and repo
  3. Set up GH_TOKEN secret in your GitHub repository
  4. Create and push a version tag to trigger the release

================================================================================
`);
}

function main() {
  const args = process.argv.slice(2);
  const windowsOnly = args.includes('--windows-only') || args.includes('-w');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
GitHub Actions Setup for Electron App

Usage: node scripts/setup-github-actions.js [options]

Options:
  --windows-only, -w    Create Windows-only build workflow
  --help, -h            Show this help message

Examples:
  node scripts/setup-github-actions.js              # Full multi-platform setup
  node scripts/setup-github-actions.js --windows-only  # Windows only
`);
    return;
  }

  console.log('Setting up GitHub Actions for Electron app...\n');

  if (windowsOnly) {
    createWorkflowFile('release.yml', WINDOWS_ONLY_WORKFLOW);
  } else {
    createWorkflowFile('release.yml', RELEASE_WORKFLOW);
  }

  createElectronBuilderConfig();
  updatePackageJson();
  createBuildResourcesDir();
  printGitHubTokenInstructions();
  printSummary({ windowsOnly });
}

main();
