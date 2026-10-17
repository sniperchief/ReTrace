import { notFound } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CustomerForm } from "@/components/customer-form";
import { PageHeader } from "@/components/ui";
import { deleteCustomerAction, updateCustomerAction } from "@/server/actions/customers";
import { getCustomer } from "@/server/data/customers";
import { listGenerators } from "@/server/data/generators";
import { getT } from "@/server/i18n";
import { requireTechnician } from "@/server/session";

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const customer = await getCustomer(technician.id, id);
  if (!customer) notFound();
  const hasGenerators = (await listGenerators(technician.id, { customerId: id, limit: 1 })).length > 0;
  const t = await getT();

  return (
    <>
      <PageHeader title={t.customers.editTitle} back={{ href: `/customers/${id}`, label: customer.name }} />
      <CustomerForm
        action={updateCustomerAction.bind(null, id)}
        initial={{
          name: customer.name,
          phone: customer.phone ?? "",
          location: customer.location ?? "",
          notes: customer.notes ?? "",
        }}
        cancelHref={`/customers/${id}`}
      />
      {hasGenerators ? (
        <p className="mt-10 border-t border-border pt-6 text-sm text-muted">{t.danger.customerHasGenerators}</p>
      ) : (
        <ConfirmDelete action={deleteCustomerAction.bind(null, id)} label={t.danger.deleteCustomer}
          confirmText={t.danger.deleteCustomerConfirm} />
      )}
    </>
  );
}
