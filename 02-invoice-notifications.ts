type Invoice = { orderId: string; confirmed: boolean; paid: boolean; pdf: string };
type Customer = { emailAddress: string; unsubscribed: boolean; name: string };
type Sender = (email: string, subject: string, body: string, attachment: string) => Promise<void>;

export async function sendInvoice(
  invoice: Invoice,
  customer: Customer,
  channelEnabled: boolean,
  sender: Sender,
  prefix: string,
  locale: string,
  includeGreeting: boolean,
  useHtml: boolean,
  audit: string[],
) {
  if (customer.emailAddress.includes('@') && invoice.confirmed && invoice.paid && !customer.unsubscribed && channelEnabled && invoice.pdf.length > 0) {
    const subject = prefix + (locale === 'zh' ? '发票' : 'Invoice') + ':' + invoice.orderId;
    const body = useHtml
      ? includeGreeting ? '<p>Hello ' + customer.name + '</p>' : '<p>Invoice attached</p>'
      : includeGreeting ? 'Hello ' + customer.name : 'Invoice attached';
    await sender(customer.emailAddress, subject, body, invoice.pdf);
    audit.push('sent:' + invoice.orderId);
    return true;
  }
  audit.push('skipped:' + invoice.orderId);
  return false;
}

export function sendPaidInvoice(invoice: Invoice, customer: Customer, sender: Sender) {
  return sendInvoice(invoice, customer, true, sender, '', 'zh', true, false, []);
}
