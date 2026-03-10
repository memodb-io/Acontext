"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CreditCard,
  Plus,
  RefreshCw,
  FileText,
  AlertTriangle,
  Download,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useTopNavStore } from "@/stores/top-nav";
import { usePlanStore } from "@/stores/plan";
import { Organization } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPaymentMethods,
  getInvoices,
  PaymentMethod,
  Invoice,
} from "@/lib/supabase/operations/prices";
import { PaymentMethodForm } from "./payment-method-form";
import { ChangePlanSheet } from "@/components/change-plan-sheet";

interface BillingPageClientProps {
  currentOrganization: Organization;
  allOrganizations: Organization[];
}

function PaymentMethodCard({
  paymentMethod,
  isDefault = false,
}: {
  paymentMethod: PaymentMethod;
  isDefault?: boolean;
}) {
  const { card } = paymentMethod;
  const brandDisplay = card.brand.charAt(0).toUpperCase() + card.brand.slice(1);

  // Check if card is expiring soon (within 3 months)
  const now = new Date();
  const expDate = new Date(card.exp_year, card.exp_month - 1);
  const threeMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 3);
  const isExpiringSoon = expDate <= threeMonthsFromNow && expDate >= now;

  return (
    <div className="flex items-center justify-between gap-8 p-4 border rounded-lg bg-muted/30 flex-col md:flex-row">
      <div className="flex items-center gap-6">
        <div className="flex items-center justify-center w-10 h-7 bg-background rounded border">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-sm font-mono text-muted-foreground">
          **** **** **** {card.last4}
        </p>
        <p className="text-sm tabular-nums text-muted-foreground">
          Expires: {card.exp_month.toString().padStart(2, "0")}/{card.exp_year}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isExpiringSoon && (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-600 border-amber-500/50 text-[10px] uppercase tracking-wider"
          >
            Expiring soon
          </Badge>
        )}
        {isDefault && (
          <Badge
            variant="outline"
            className="bg-primary/10 text-primary border-primary/50 text-[10px] uppercase tracking-wider"
          >
            Default
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">{brandDisplay}</span>
      </div>
    </div>
  );
}

function PaymentMethodsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-8 p-4 border rounded-lg">
        <div className="flex items-center gap-6">
          <Skeleton className="w-10 h-7 rounded" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}

function InvoicesSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="flex gap-4 py-3 border-b last:border-0">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "paid":
      return "secondary";
    case "open":
      return "default";
    case "void":
    case "uncollectible":
      return "destructive";
    default:
      return "outline";
  }
}

export function BillingPageClient({
  currentOrganization,
  allOrganizations,
}: BillingPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();
  const {
    getPriceByProduct,
    formatPrice,
    getPlanDisplayName: getPlanDisplayNameFromPrice,
  } = usePlanStore();

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [isChangePlanSheetOpen, setIsChangePlanSheetOpen] = useState(false);

  const fetchPaymentMethods = useCallback(
    async (showToast = false) => {
      setIsLoadingPayments(true);
      setPaymentError(null);

      const result = await getPaymentMethods(currentOrganization.id!);

      if (result.error) {
        setPaymentError(result.error);
        if (showToast) {
          toast.error("Failed to load payment methods");
        }
      } else {
        setPaymentMethods(result.paymentMethods || []);
        if (showToast) {
          toast.success("Payment methods refreshed");
        }
      }

      setIsLoadingPayments(false);
    },
    [currentOrganization.id]
  );

  const fetchInvoices = useCallback(
    async (showToast = false) => {
      setIsLoadingInvoices(true);
      setInvoiceError(null);

      const result = await getInvoices(currentOrganization.id!);

      if (result.error) {
        setInvoiceError(result.error);
        if (showToast) {
          toast.error("Failed to load invoices");
        }
      } else {
        setInvoices(result.invoices || []);
        if (showToast) {
          toast.success("Invoices refreshed");
        }
      }

      setIsLoadingInvoices(false);
    },
    [currentOrganization.id]
  );

  useEffect(() => {
    // Initialize top-nav state when page loads
    initialize({
      title: "",
      organization: currentOrganization,
      project: null,
      organizations: allOrganizations,
      projects: [],
      hasSidebar: true,
    });

    // Cleanup: reset hasSidebar when leaving this page
    return () => {
      setHasSidebar(false);
    };
  }, [currentOrganization, allOrganizations, initialize, setHasSidebar]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const [paymentResult, invoiceResult] = await Promise.all([
        getPaymentMethods(currentOrganization.id!),
        getInvoices(currentOrganization.id!),
      ]);

      if (!isMounted) return;

      if (paymentResult.error) {
        setPaymentError(paymentResult.error);
      } else {
        setPaymentMethods(paymentResult.paymentMethods || []);
      }
      setIsLoadingPayments(false);

      if (invoiceResult.error) {
        setInvoiceError(invoiceResult.error);
      } else {
        setInvoices(invoiceResult.invoices || []);
      }
      setIsLoadingInvoices(false);
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [currentOrganization.id]);

  const handlePaymentSuccess = () => {
    setIsAddingPayment(false);
    fetchPaymentMethods();
    toast.success("Payment method added successfully");
  };

  const handleCancel = () => {
    setIsAddingPayment(false);
  };

  const hasPaymentMethods = paymentMethods.length > 0;

  // Get plan display name from store
  const getPlanDisplayName = (plan: string | undefined) => {
    if (!plan || plan === "free") {
      return "Free Plan";
    }
    // Try to find the price in the store
    const priceInfo = getPriceByProduct(plan);
    if (priceInfo) {
      const displayName = getPlanDisplayNameFromPrice(priceInfo);
      return `${displayName} Plan`;
    }
    // Fallback to simple display
    return `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`;
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold">Subscription Plan</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Each organization has its own subscription plan, billing cycle,
            payment methods and usage quotas.
          </p>
        </div>

        {/* Current Plan Card */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-base px-4 py-1">
                  {getPlanDisplayName(currentOrganization.plan)}
                </Badge>
              </div>
              <Button
                variant="outline"
                onClick={() => setIsChangePlanSheetOpen(true)}
                disabled={isLoadingPayments || isLoadingInvoices}
              >
                Change subscription plan
              </Button>
            </div>

            {currentOrganization.plan === "free" && (
              <Alert className="mt-4" variant="default">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">
                    This organization is limited by the included usage
                  </span>
                  <br />
                  <span className="text-muted-foreground">
                    Projects may become unresponsive when this organization
                    exceeds its included usage quota. To scale seamlessly,
                    upgrade to a paid plan.
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Past Invoices Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Past Invoices</CardTitle>
                <CardDescription>
                  You get an invoice every time you change your plan or when
                  your monthly billing cycle resets.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => fetchInvoices(true)}
                disabled={isLoadingInvoices}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    isLoadingInvoices ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {invoiceError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{invoiceError}</AlertDescription>
              </Alert>
            )}

            {isLoadingInvoices ? (
              <InvoicesSkeleton />
            ) : invoices.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Invoice number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell>
                          {formatDate(invoice.period_start)}
                        </TableCell>
                        <TableCell>
                          {formatPrice(
                            invoice.amount_paid || invoice.amount_due,
                            invoice.currency
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {invoice.id
                            .replace("in_", "")
                            .substring(0, 12)
                            .toUpperCase()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusBadgeVariant(invoice.status)}
                            className="capitalize"
                          >
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {invoice.hosted_invoice_url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a
                                  href={invoice.hosted_invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </a>
                              </Button>
                            )}
                            {invoice.invoice_pdf ? (
                              <Button variant="ghost" size="sm" asChild>
                                <a
                                  href={invoice.invoice_pdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Download className="h-4 w-4" />
                                  Invoice
                                </a>
                              </Button>
                            ) : !invoice.hosted_invoice_url ? (
                              <span className="text-muted-foreground text-sm">
                                —
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-sm text-muted-foreground mt-4">
                  Showing 1 to {invoices.length} out of {invoices.length}{" "}
                  invoices
                </p>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No invoices yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>
                  Payments for your subscription are made using the default
                  card.
                </CardDescription>
              </div>
              {!isAddingPayment && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchPaymentMethods(true)}
                  disabled={isLoadingPayments}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      isLoadingPayments ? "animate-spin" : ""
                    }`}
                  />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentError && (
              <Alert variant="destructive">
                <AlertDescription>{paymentError}</AlertDescription>
              </Alert>
            )}

            {isLoadingPayments && !isAddingPayment ? (
              <PaymentMethodsSkeleton />
            ) : isAddingPayment ? (
              <PaymentMethodForm
                organizationId={currentOrganization.id!}
                onSuccess={handlePaymentSuccess}
                onCancel={handleCancel}
              />
            ) : (
              <>
                {hasPaymentMethods ? (
                  <div className="space-y-3">
                    {paymentMethods.map((pm, index) => (
                      <PaymentMethodCard
                        key={pm.id}
                        paymentMethod={pm}
                        isDefault={index === 0}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No payment methods</p>
                  </div>
                )}

                <div className="flex pt-4">
                  <Button
                    onClick={() => setIsAddingPayment(true)}
                    className="ml-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Add new card
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ChangePlanSheet
        organization={currentOrganization}
        open={isChangePlanSheetOpen}
        onOpenChange={setIsChangePlanSheetOpen}
        paymentMethods={paymentMethods}
      />
    </div>
  );
}
