type Handler = (value: any) => any;
type Runtime = { handlers: Record<string, Handler>; slots: Record<string, any> };

export function createRuntime(): Runtime {
  return { handlers: {}, slots: {} };
}

export function register(runtime: Runtime, name: string, handler: Handler) {
  runtime.handlers[name] = handler;
}

export function invoke(runtime: Runtime, name: string, value: any) {
  return runtime.handlers[name](value);
}

export function put(runtime: Runtime, name: string, value: any) {
  runtime.slots[name] = value;
}

export function take(runtime: Runtime, name: string) {
  return runtime.slots[name];
}

export function decorate(runtime: Runtime, name: string, wrapper: (handler: Handler) => Handler) {
  register(runtime, name, wrapper(runtime.handlers[name]));
}
