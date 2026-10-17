type Customer = { customerId: string; emailAddress: string; suspended: boolean };
type Repository = {
  find(customerId: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
};

/** 客户不存在时返回 null；存储失败保留 Promise 拒绝。 */
export function getCustomer(repository: Repository, customerId: string) {
  return repository.find(customerId);
}

export async function updateCustomerEmail(repository: Repository, customerId: string, emailAddress: string) {
  const customer = await getCustomer(repository, customerId);
  if (!customer) return null;
  const updated = { ...customer, emailAddress: emailAddress.trim() };
  await repository.save(updated);
  return updated;
}

/** 持久化停用状态；客户不存在时返回 null。 */
export async function suspendAccount(repository: Repository, customerId: string) {
  const customer = await getCustomer(repository, customerId);
  if (!customer) return null;
  const suspendedCustomer = { ...customer, suspended: true };
  await repository.save(suspendedCustomer);
  return suspendedCustomer;
}

export async function customerSettings(repository: Repository, customerId: string, emailAddress: string) {
  try {
    const customer = await updateCustomerEmail(repository, customerId, emailAddress);
    return customer ? '已保存' : '客户不存在';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export async function suspendFromAdmin(repository: Repository, customerId: string) {
  const customer = await suspendAccount(repository, customerId);
  return customer ? { success: true } : { error: 'unknown' };
}
