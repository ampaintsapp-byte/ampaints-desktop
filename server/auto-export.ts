// auto-export.ts - Silent background auto-export service for cloud database
import { db } from "./db"
import { settings, products, variants, colors, sales, saleItems, paymentHistory, returns, stockInHistory } from "@shared/schema"
import { eq, gt, desc } from "drizzle-orm"

const EXPORT_INTERVAL = 5 * 60 * 1000 // Export every 5 minutes
const BATCH_SIZE = 100 // Process in batches to avoid overwhelming the cloud DB
const MAX_RETRIES = 3
const RETRY_DELAY = 2000 // 2 seconds between retries

interface ExportStats {
  timestamp: Date
  success: boolean
  recordsExported: number
  duration: number
  error?: string
}

let lastExportTime = new Date(0)
let isExporting = false
let exportStats: ExportStats[] = []
let exportInterval: number | null = null

// Silent logger that doesn't spam console
function silentLog(message: string, data?: unknown) {
  // Only log in development mode with specific flag
  const debug = (globalThis as any).DEBUG_AUTO_EXPORT || process?.env?.DEBUG_AUTO_EXPORT === "true"
  if (debug) {
    console.log(`[AutoExport] ${message}`, data || "")
  }
}

// Get cloud database connection
async function getCloudConnection() {
  try {
    const appSettings = await db
      .select()
      .from(settings)
      .where(eq(settings.id, "default"))
      .then((rows: any) => rows[0])

    if (!appSettings?.cloudDatabaseUrl) {
      return null
    }

    // Dynamically import neon only if cloud URL exists
    const { neon } = await import("@neondatabase/serverless")
    return neon(appSettings.cloudDatabaseUrl)
  } catch (error) {
    silentLog("Failed to get cloud connection:", error)
    return null
  }
}

// Batch export with retry logic
async function batchExport(
  cloudSql: any,
  tableName: string,
  records: any[],
  insertQuery: (rec: any) => Promise<any>
): Promise<number> {
  let exported = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    for (const record of batch) {
      let retries = 0
      while (retries < MAX_RETRIES) {
        try {
          await insertQuery(record)
          exported++
          break
        } catch (error) {
          retries++
          if (retries < MAX_RETRIES) {
            silentLog(`Retry ${retries}/${MAX_RETRIES} for ${tableName}:`, error)
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
          } else {
            silentLog(`Failed to export ${tableName} after ${MAX_RETRIES} retries:`, error)
          }
        }
      }
    }
  }

  return exported
}

// Main auto-export function
async function performAutoExport() {
  if (isExporting) {
    silentLog("Export already in progress, skipping...")
    return
  }

  isExporting = true
  const startTime = Date.now()
  const exportTime = new Date()
  let totalExported = 0

  try {
    const cloudSql = await getCloudConnection()
    if (!cloudSql) {
      silentLog("Cloud database not configured, skipping export")
      isExporting = false
      return
    }

    silentLog("Starting auto-export from local DB to Neon cloud")

    // Export Products
    const localProducts = await db
      .select()
      .from(products)
      .where(gt(products.createdAt, lastExportTime))
      .orderBy(desc(products.createdAt))

    const productsExported = await batchExport(cloudSql, "products", localProducts, async (p) => {
      await cloudSql`
        INSERT INTO products (id, company, product_name, created_at)
        VALUES (${p.id}, ${p.company}, ${p.productName}, ${p.createdAt})
        ON CONFLICT (id) DO UPDATE SET
          company = EXCLUDED.company,
          product_name = EXCLUDED.product_name
      `
    })
    totalExported += productsExported

    // Export Variants
    const localVariants = await db
      .select()
      .from(variants)
      .where(gt(variants.createdAt, lastExportTime))
      .orderBy(desc(variants.createdAt))

    const variantsExported = await batchExport(cloudSql, "variants", localVariants, async (v) => {
      await cloudSql`
        INSERT INTO variants (id, product_id, packing_size, rate, created_at)
        VALUES (${v.id}, ${v.productId}, ${v.packingSize}, ${v.rate}, ${v.createdAt})
        ON CONFLICT (id) DO UPDATE SET
          product_id = EXCLUDED.product_id,
          packing_size = EXCLUDED.packing_size,
          rate = EXCLUDED.rate
      `
    })
    totalExported += variantsExported

    // Export Colors
    const localColors = await db
      .select()
      .from(colors)
      .where(gt(colors.createdAt, lastExportTime))
      .orderBy(desc(colors.createdAt))

    const colorsExported = await batchExport(cloudSql, "colors", localColors, async (c) => {
      await cloudSql`
        INSERT INTO colors (id, variant_id, color_name, color_code, stock_quantity, rate_override, created_at)
        VALUES (${c.id}, ${c.variantId}, ${c.colorName}, ${c.colorCode}, ${c.stockQuantity}, ${c.rateOverride}, ${c.createdAt})
        ON CONFLICT (id) DO UPDATE SET
          variant_id = EXCLUDED.variant_id,
          color_name = EXCLUDED.color_name,
          color_code = EXCLUDED.color_code,
          stock_quantity = EXCLUDED.stock_quantity,
          rate_override = EXCLUDED.rate_override
      `
    })
    totalExported += colorsExported

    // Export Sales
    const localSales = await db
      .select()
      .from(sales)
      .where(gt(sales.createdAt, lastExportTime))
      .orderBy(desc(sales.createdAt))

    const salesExported = await batchExport(cloudSql, "sales", localSales, async (s) => {
      await cloudSql`
        INSERT INTO sales (id, customer_name, customer_phone, total_amount, amount_paid, payment_status, due_date, is_manual_balance, notes, created_at)
        VALUES (${s.id}, ${s.customerName}, ${s.customerPhone}, ${s.totalAmount}, ${s.amountPaid}, ${s.paymentStatus}, ${s.dueDate}, ${s.isManualBalance}, ${s.notes}, ${s.createdAt})
        ON CONFLICT (id) DO UPDATE SET
          customer_name = EXCLUDED.customer_name,
          customer_phone = EXCLUDED.customer_phone,
          total_amount = EXCLUDED.total_amount,
          amount_paid = EXCLUDED.amount_paid,
          payment_status = EXCLUDED.payment_status,
          due_date = EXCLUDED.due_date,
          notes = EXCLUDED.notes
      `
    })
    totalExported += salesExported

    // Export Sales Items
    const localSalesItems = await db
      .select()
      .from(saleItems)
      .where(gt(saleItems.createdAt, lastExportTime))
      .orderBy(desc(saleItems.createdAt))

    const salesItemsExported = await batchExport(cloudSql, "sales_items", localSalesItems, async (si) => {
      await cloudSql`
        INSERT INTO sales_items (id, sale_id, color_id, quantity, rate, discount_percent, created_at)
        VALUES (${si.id}, ${si.saleId}, ${si.colorId}, ${si.quantity}, ${si.rate}, ${si.discountPercent}, ${si.createdAt})
        ON CONFLICT (id) DO UPDATE SET
          sale_id = EXCLUDED.sale_id,
          color_id = EXCLUDED.color_id,
          quantity = EXCLUDED.quantity,
          rate = EXCLUDED.rate,
          discount_percent = EXCLUDED.discount_percent
      `
    })
    totalExported += salesItemsExported

    // Export Payment History
    const localPayments = await db
      .select()
      .from(paymentHistory)
      .where(gt(paymentHistory.createdAt, lastExportTime))
      .orderBy(desc(paymentHistory.createdAt))

    const paymentsExported = await batchExport(cloudSql, "payment_history", localPayments, async (ph) => {
      await cloudSql`
        INSERT INTO payment_history (id, sale_id, amount, payment_method, reference_number, notes, created_at)
        VALUES (${ph.id}, ${ph.saleId}, ${ph.amount}, ${ph.paymentMethod}, ${ph.referenceNumber}, ${ph.notes}, ${ph.createdAt})
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          payment_method = EXCLUDED.payment_method,
          reference_number = EXCLUDED.reference_number,
          notes = EXCLUDED.notes
      `
    })
    totalExported += paymentsExported

    // Export Returns
    const localReturns = await db
      .select()
      .from(returns)
      .where(gt(returns.createdAt, lastExportTime))
      .orderBy(desc(returns.createdAt))

    const returnsExported = await batchExport(cloudSql, "returns", localReturns, async (r) => {
      await cloudSql`
        INSERT INTO returns (id, sale_id, return_date, return_reason, notes, created_at)
        VALUES (${r.id}, ${r.saleId}, ${r.returnDate}, ${r.returnReason}, ${r.notes}, ${r.createdAt})
        ON CONFLICT (id) DO UPDATE SET
          return_date = EXCLUDED.return_date,
          return_reason = EXCLUDED.return_reason,
          notes = EXCLUDED.notes
      `
    })
    totalExported += returnsExported

    // Export Stock In History
    const localStockIn = await db
      .select()
      .from(stockInHistory)
      .where(gt(stockInHistory.createdAt, lastExportTime))
      .orderBy(desc(stockInHistory.createdAt))

    const stockInExported = await batchExport(cloudSql, "stock_in_history", localStockIn, async (si) => {
      await cloudSql`
        INSERT INTO stock_in_history (id, color_id, quantity_in, rate, notes, created_at)
        VALUES (${si.id}, ${si.colorId}, ${si.quantityIn}, ${si.rate}, ${si.notes}, ${si.createdAt})
        ON CONFLICT (id) DO UPDATE SET
          quantity_in = EXCLUDED.quantity_in,
          rate = EXCLUDED.rate,
          notes = EXCLUDED.notes
      `
    })
    totalExported += stockInExported

    // Update last export time
    lastExportTime = exportTime
    const duration = Date.now() - startTime

    silentLog(
      `Auto-export completed successfully: ${totalExported} records exported in ${duration}ms`
    )

    // Keep last 10 export stats
    exportStats.push({
      timestamp: exportTime,
      success: true,
      recordsExported: totalExported,
      duration,
    })
    if (exportStats.length > 10) {
      exportStats.shift()
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    silentLog(`Auto-export failed: ${errorMessage}`)

    exportStats.push({
      timestamp: exportTime,
      success: false,
      recordsExported: totalExported,
      duration,
      error: errorMessage,
    })
    if (exportStats.length > 10) {
      exportStats.shift()
    }
  } finally {
    isExporting = false
  }
}

// Start the auto-export service
export function startAutoExportService() {
  if (exportInterval) {
    silentLog("Auto-export service already running")
    return
  }

  silentLog("Starting auto-export service...")

  // Initial export after 30 seconds to let app stabilize
  setTimeout(() => {
    performAutoExport()
  }, 30000)

  // Set up recurring export
  exportInterval = setInterval(() => {
    performAutoExport().catch((error) => {
      silentLog("Uncaught error in auto-export:", error)
    })
  }, EXPORT_INTERVAL) as unknown as number
}

// Stop the auto-export service
export function stopAutoExportService() {
  if (exportInterval) {
    clearInterval(exportInterval)
    exportInterval = null
    silentLog("Auto-export service stopped")
  }
}

// Get export status (for debugging)
export function getAutoExportStatus() {
  return {
    isExporting,
    lastExportTime,
    stats: exportStats,
    nextExportIn: EXPORT_INTERVAL,
  }
}
