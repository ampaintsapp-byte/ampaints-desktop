# PaintPulse - Paint Store POS System

## Overview
PaintPulse is a Point of Sale (POS) and Inventory Management System designed for paint stores. It manages inventory, sales, customer records, and billing through an intuitive web-based interface. The system offers comprehensive inventory tracking, efficient sales processing, flexible rate management, and robust unpaid bill tracking with PDF statement generation. It aims to be a user-friendly solution for paint store operations.

## User Preferences
None specified yet.

## System Architecture

### Technology Stack
- **Frontend**: React 18, Vite, TypeScript
- **Backend**: Express.js, Node.js
- **Database**: SQLite (better-sqlite3)
- **ORM**: Drizzle ORM
- **UI Framework**: Radix UI, Tailwind CSS
- **State Management**: TanStack React Query

### Project Structure
- `client/`: Frontend React application.
- `server/`: Backend Express server.
- `shared/`: Code shared between client and server.
- `migrations/`: Database migration scripts.

### Key Features
- **Inventory Management**: Tracks products, variants, colors, and stock levels with advanced filtering, bulk operations, and stock deficit alerts.
- **POS Sales**: Streamlined transaction processing with real-time inventory updates and optimized product displays.
- **Rate Management**: Manages product pricing and packing sizes, including per-color rate overrides.
- **Unpaid Bills & Customer Statements**: Tracks partial payments, due dates, manual balance additions, and generates detailed, bank-style PDF statements with a consistent outstanding balance formula (`Outstanding = Total Bills - Payments - Return Credits`). Includes a "Pay Full" button for quick payment recording.
- **Returns Management**: Supports full bill and individual item returns with automatic stock restoration, tracking reasons, refund amounts, and restock quantities. Returns are clearly displayed on sales cards.
- **Reporting**: Comprehensive financial reports with an "Overview" tab for summary cards (Total Bills, Collected, Unpaid, Returns), a "Cash in Hand" card (New Sales + Recovery - Refunds), and detailed tabs for Bills, Payments, Returns, and Unpaid Bills. A unified "Transactions" tab shows all financial activities chronologically.
- **Admin Center**: Unified administration interface with sections for Overview, Operations (audits for Stock, Sales, Payments, Returns, Unpaid Bills), Store settings, Security (PIN management, permissions, licensing), and Data (cloud sync, backup, system info). Features secure PIN verification, session-based authentication, debounced search, and date range filtering.
- **UI Customization**: Settings for store branding, product card design, and badge appearance.
- **Thermal Receipt & Bill Print**: Customizable thermal receipt printing and professional PDF invoice generation.
- **WhatsApp PDF Sharing**: Direct PDF sharing to WhatsApp on mobile, with desktop fallback for saving and opening WhatsApp Web.
- **Database Management**: Web-based export/import, performance-optimized SQLite with composite indexes, and an automatic schema migration system.
- **Cloud Database Sync**: Real-time, delta, and batch processing for multi-device data synchronization via cloud PostgreSQL (Neon/Supabase). Includes offline queuing, auto-retry, conflict detection, and live status display.
- **Software Licensing & Remote Blocking**: Two-tier security system with a local activation layer and a server-side license layer with remote blocking capabilities. Features device registration, master admin PIN, scheduled auto-blocking, and an audit trail of actions.
- **Desktop Application**: Provides a maximized windowed desktop mode with saved size and position, and solutions for Windows SmartScreen warnings.

### System Design Choices
- **Database**: Lightweight, file-based SQLite managed by Drizzle ORM.
- **Schema Management**: Automatic migration system for smooth upgrades.
- **Performance**: Optimized SQLite queries with composite indexes. Frontend optimizations include debounced search, visible row limits with "Load More" buttons, background data loading with React.lazy + Suspense, and useDeferredValue. Backend optimizations include Gzip compression, in-memory caching for frequently accessed endpoints with automatic invalidation, and combined API endpoints to reduce calls.
- **Pagination API**: Standardized paginated endpoints for various data listings.
- **UI/UX**: Clean, responsive interface using Radix UI and Tailwind CSS, featuring intuitive product card designs and a bank-style customer statement with a glassmorphism theme.
- **Error Handling**: Enhanced logging and debugging.

## External Dependencies
- **better-sqlite3**: SQLite database driver for Node.js.
- **Drizzle ORM**: TypeScript ORM for SQLite.
- **TanStack React Query**: Data fetching and state management for React.
- **Radix UI**: Unstyled, accessible UI component library.
- **Tailwind CSS**: Utility-first CSS framework.
- **Vite**: Frontend tooling.
- **Express.js**: Web application framework for Node.js.