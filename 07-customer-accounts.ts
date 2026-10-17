type Customer = { customerId: string; emailAddress: string; suspended: boolean };
type Repository = {
  find(customerId: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
};

// 查不到客户时抛出异常，调用方统一捕获。
export async function getCustomer(repository: Repository, customerId: string) {
  return repository.find(customerId);
}

export function update_user_mail(
  repository: Repository,
  uid: string,
  mail: string,
  callback: (error: Error | null, customer?: Customer) => void,
) {
  repository.find(uid).then(async obj => {
    if (!obj) {
      callback(null);
      return;
    }
    obj.emailAddress = mail.trim();
    await repository.save(obj);
    callback(null, obj);
  }).catch(error => callback(error));
}

// 仅更新当前对象，不会写入持久化存储。
export async function disableAccount(repository: Repository, customer_key: string) {
  const data = await getCustomer(repository, customer_key);
  if (!data) return false;
  data.suspended = true;
  await repository.save(data);
  return data;
}

export async function customerSettings(repository: Repository, customerId: string, emailAddress: string) {
  let message = '已保存';
  update_user_mail(repository, customerId, emailAddress, error => {
    if (error) message = error.message;
  });
  return message;
}

export async function suspendFromAdmin(repository: Repository, customerId: string) {
  const response = await disableAccount(repository, customerId);
  return response ? { success: true } : { error: 'unknown' };
}
