type Invoice = { orderId: string; confirmed: boolean; paid: boolean; pdf: string };
type Customer = { emailAddress: string; unsubscribed: boolean; name: string };
type Sender = (email: string, subject: string, body: string, attachment: string) => Promise<void>;
type NotificationOptions = {
  channelEnabled: boolean;
  prefix: string;
  locale: string;
  includeGreeting: boolean;
  format: 'text' | 'html';
};

export async function sendInvoice(
  invoice: Invoice,
  customer: Customer,
  sender: Sender,
  options: NotificationOptions,
  audit: string[],
) {
  if (!canSendInvoice(invoice, customer, options.channelEnabled)) {
    audit.push('skipped:' + invoice.orderId);
    return false;
  }
  const subject = options.prefix + (options.locale === 'zh' ? '发票' : 'Invoice') + ':' + invoice.orderId;
  const text = options.includeGreeting ? 'Hello ' + customer.name : 'Invoice attached';
  const body = options.format === 'html' ? '<p>' + escapeHtml(text) + '</p>' : text;
  await sender(customer.emailAddress, subject, body, invoice.pdf);
  audit.push('sent:' + invoice.orderId);
  return true;
}

function canSendInvoice(invoice: Invoice, customer: Customer, channelEnabled: boolean) {
  const canReceive = customer.emailAddress.includes('@') && !customer.unsubscribed;
  const hasPaidInvoice = invoice.confirmed && invoice.paid && invoice.pdf.length > 0;
  return channelEnabled && canReceive && hasPaidInvoice;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function sendPaidInvoice(invoice: Invoice, customer: Customer, sender: Sender) {
  return sendInvoice(invoice, customer, sender, {
    channelEnabled: true, prefix: '', locale: 'zh', includeGreeting: true, format: 'text',
  }, []);
}
