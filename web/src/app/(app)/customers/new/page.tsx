import type { Metadata } from "next";
import { CustomerForm } from "@/components/customer-form";
import { PageHeader } from "@/components/ui";
import { getMessages } from "@/i18n";
import { createCustomerAction } from "@/server/actions/customers";
import { requireTechnician } from "@/server/session";

export const metadata: Metadata = { title: getMessages().customers.new };

export default async function NewCustomerPage() {
  await requireTechnician();
  const t = getMessages();
  return (
    <>
      <PageHeader title={t.customers.new} back={{ href: "/customers", label: t.customers.title }} />
      <CustomerForm
        action={createCustomerAction}
        initial={{ name: "", phone: "", location: "", notes: "" }}
        cancelHref="/customers"
      />
    </>
  );
}
