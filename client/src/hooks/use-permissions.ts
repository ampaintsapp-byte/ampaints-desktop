import { useQuery } from "@tanstack/react-query";
import type { Settings } from "@shared/schema";

export interface Permissions {
  stockDelete: boolean;
  stockEdit: boolean;
  stockHistoryDelete: boolean;
  salesDelete: boolean;
  salesEdit: boolean;
  paymentEdit: boolean;
  paymentDelete: boolean;
  databaseAccess: boolean;
}

const DEFAULT_PERMISSIONS: Permissions = {
  stockDelete: true,
  stockEdit: true,
  stockHistoryDelete: true,
  salesDelete: true,
  salesEdit: true,
  paymentEdit: true,
  paymentDelete: true,
  databaseAccess: true,
};

export function usePermissions() {
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const permissions: Permissions = settings ? {
    stockDelete: settings.permStockDelete ?? true,
    stockEdit: settings.permStockEdit ?? true,
    stockHistoryDelete: settings.permStockHistoryDelete ?? true,
    salesDelete: settings.permSalesDelete ?? true,
    salesEdit: settings.permSalesEdit ?? true,
    paymentEdit: settings.permPaymentEdit ?? true,
    paymentDelete: settings.permPaymentDelete ?? true,
    databaseAccess: settings.permDatabaseAccess ?? true,
  } : DEFAULT_PERMISSIONS;

  return {
    permissions,
    isLoading,
    canDeleteStock: permissions.stockDelete,
    canEditStock: permissions.stockEdit,
    canDeleteStockHistory: permissions.stockHistoryDelete,
    canDeleteSales: permissions.salesDelete,
    canEditSales: permissions.salesEdit,
    canEditPayment: permissions.paymentEdit,
    canDeletePayment: permissions.paymentDelete,
    canAccessDatabase: permissions.databaseAccess,
  };
}
